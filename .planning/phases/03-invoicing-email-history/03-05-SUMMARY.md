---
phase: 03-invoicing-email-history
plan: 05
subsystem: invoicing
tags: [drizzle, neon-http, postgres, cte, zod, transactions, financial-correctness]

# Dependency graph
requires:
  - phase: 03-invoicing-email-history (Plan 02)
    provides: generateInvoiceAction, invoices table + sessions.billed/invoiceId, invoice-preview-dialog redirect to /history/{id}
provides:
  - Atomic generateInvoiceAction — invoice INSERT + sessions mark-billed UPDATE commit in ONE db.batch transaction (INV-03 atomicity restored)
  - Double-billing guard — INSERT gated on all target sessions still unbilled; UPDATE gated on billed=false AND EXISTS(ins); race-loss returns a field error
  - invoices.rendered_subject widened varchar(500) -> text (schema + applied to Neon), so a merged subject can't overflow the atomic INSERT
  - Settings validation .max() bounds (zelleHandle 255, subjectTemplate 500, bodyTemplate 5000) so oversized input is a field error, not a raw Postgres error
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single data-modifying CTE (WITH target / ins AS INSERT...RETURNING / UPDATE) run via db.execute(sql`...`) inside ONE db.batch([...]) — the atomicity primitive on the neon-http driver (db.transaction() throws at runtime here)"
    - "Optimistic double-billing guard: INSERT ... SELECT ... WHERE (count of still-unbilled targets) = expected; zero rows inserted => EXISTS(ins) false => UPDATE no-ops => action returns a 'already invoiced, refresh' field error instead of a duplicate invoice"
    - "Narrow try/catch around the atomic write returns a generic user-facing field error rather than an uncaught DB error page (T-03-05-03) — scoped to this action, not the deferred broad WR-04 pass"

key-files:
  created:
    - .planning/phases/03-invoicing-email-history/03-05-SUMMARY.md
  modified:
    - lib/actions/invoices.ts
    - lib/db/schema.ts
    - lib/validation/settings.ts

key-decisions:
  - "Used a raw single-statement CTE via db.execute inside db.batch (not drizzle's .with() query builder) — keeps the whole INSERT+UPDATE in one statement/transaction and lets the double-billing guard live in SQL where the count check is atomic with the write"
  - "Applied the varchar->text widening to Neon via drizzle-kit push (direct apply, non-destructive) rather than a generated migration — push reported changes applied, and a follow-up push reported 'No changes detected'"

patterns-established:
  - "Atomic multi-write server actions on neon-http use one db.batch wrapping one data-modifying CTE; never db.transaction()"
  - "Guard-in-SQL for concurrency: gate the INSERT on a still-valid precondition (count of unbilled targets) so a lost race produces zero rows, surfaced as a field error"

requirements-completed: [INV-03]

# Metrics
duration: ~25min
completed: 2026-07-06
---

# Phase 03 Plan 05: Atomic Invoice Generation Summary

**Invoice generation now commits the invoice INSERT and the sessions mark-billed UPDATE as one transaction with a double-billing guard — a mid-request crash or two-tab race can no longer leave sessions un-billed under a persisted invoice or bill the same sessions twice.**

## Performance

- **Duration:** ~25 min (across a session-limit interruption; Task 1 was recovered from the interrupted executor's uncommitted work and completed inline)
- **Completed:** 2026-07-06
- **Tasks:** 3 of 3
- **Files modified:** 3

## Accomplishments

- **Task 1 (WR-01, blocker):** Replaced the two-round-trip write (standalone `INSERT...RETURNING` + a separate `db.batch` UPDATE) in `generateInvoiceAction` with a single data-modifying CTE inside one `db.batch` call. The INSERT is gated on `count(unbilled targets) = expected`; the UPDATE is gated on `billed = false AND EXISTS(ins)`. Race-loss (zero rows) returns a field error; a scoped try/catch returns a generic error instead of an uncaught DB page.
- **Task 2 (WR-03 / WR-02):** Widened `invoices.rendered_subject` from `varchar(500)` to `text` (mirroring `rendered_body`) so a `{student}` merge can't overflow the atomic INSERT. Added `.max()` bounds to Settings validation (255 / 500 / 5000) so oversized input is an inline field error.
- **Task 3 (blocking):** Applied the widening to the live Neon DB via `npx drizzle-kit push` ("Changes applied"); a confirming second push reported "No changes detected".

## Verification

- `npx tsc --noEmit` — passes
- `npx eslint` on the 3 changed files — clean
- `npm run build` (next build) — compiled successfully, all routes generated
- `grep -rn "db.transaction" lib/` — 0 matches (neon-http constraint held)
- `generateInvoiceAction` contains exactly one `db.batch` wrapping both writes; no INSERT executes outside it
- Sessions UPDATE guarded on `billed = false`; concurrent double-submit yields a field error, not a duplicate invoice
- `text("rendered_subject")` present in schema.ts and applied on Neon (idempotent push)
- `lib/validation/settings.ts` enforces `.max()` on all three fields

## Deviations

- **Execution model:** The initial `gsd-executor` subagent was cut off by a session limit mid-Task-1, leaving an uncommitted (but coherent and type-checking) implementation. Rather than re-spawn (risking another cutoff), the orchestrator adopted the recovered Task 1 edit, verified it, and completed Tasks 2–3 inline under the same execute-plan disciplines (atomic per-task commits, full verification, this SUMMARY, tracking updates). Worktree isolation was unavailable in this environment, so execution ran sequentially on `main`.

## Out of scope (deferred, not gaps)

- WR-04 (broad try/catch + typed error state across all actions and their UI consumers) and info items IN-01/IN-02/IN-03 were explicitly deferred by the plan and not touched here.
