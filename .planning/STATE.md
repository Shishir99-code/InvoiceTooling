---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: — Scheduling & Automation
status: phase-complete
stopped_at: Phase 7 all plans executed (bulk email sending complete, ready for v1.1 freeze)
last_updated: "2026-07-08T12:30:00.000Z"
last_activity: 2026-07-08 -- Phase 07 execution complete — all 4 waves delivered (schema + mailer, settings UI, invoice history UI, bulk send action)
progress:
  total_phases: 7
  completed_phases: 7
  total_plans: 32
  completed_plans: 32
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-03)

**Core value:** Go from "I tutored these sessions" to "an invoice is in the parent's inbox asking them to Zelle me" in a couple of clicks — without touching a spreadsheet.
**Current focus:** Phase 07 — bulk-email-sending-gmail-smtp

## Current Position

Phase: 07 (bulk-email-sending-gmail-smtp) — **ALL 4 PLANS COMPLETE**
Status: **v1.1 Feature Complete — Ready for Deployment**
Wave Summary:
  - Wave 1 (Plan 01): Schema + backend mailer foundation ✅
  - Wave 2 (Plan 02): Settings UI gmail credential setup ✅
  - Wave 3 (Plan 03): Invoice history UI bulk selection & dialog ✅
  - Wave 4 (Plan 04): Bulk send action & error handling polish ✅
Last activity: 2026-07-30 — Completed quick task 260730-hjn: Replace cron automation with calendar tab and bulk email sending

## Performance Metrics

**Velocity:**

- Total plans completed: 15
- Average duration: ~15 min
- Total execution time: ~109 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 5 | - | - |
| 02 | 4 | - | - |

**Recent Trend:**

- Last 5 plans: 6min, ~25min, 15min, ~8min, ~20min
- Trend: stabilizing; Plan 05's ~20min was mostly waiting on external Vercel deploy/verification, not code work

*Updated after each plan completion*
| Phase 01 P01 | 6min | 3 tasks | 31 files |
| Phase 01 P02 | ~25min | 2 tasks | 4 files |
| Phase 01 P03 | 15min | 2 tasks | 5 files |
| Phase 01 P04 | ~8min | 2 tasks | 5 files |
| Phase 01 P05 | ~20min | 1 tasks | 0 files |
| Phase 02 P01 | 10min | 3 tasks | 17 files |
| Phase 02 P02 | ~20min | 3 tasks | 8 files |
| Phase 02 P03 | ~15min | 2 tasks | 2 files |
| Phase 02 P04 | 35min | 2 tasks | 2 files |
| Phase 03 P01 | ~10min | 3 tasks | 8 files |
| Phase 03 P02 | ~15min | 3 tasks | 8 files |
| Phase 03 P03 | 5min | 3 tasks | 4 files |
| Phase 03 P04 | ~10min | 2 tasks | 3 files |
| Phase 03 P05 | ~25min | 3 tasks | 3 files |
| Phase 06 P01 | ~18min | 2 tasks | 2 files |
| Phase 06 P02 | ~22min | 2 tasks | 3 files |
| Phase 06 P03 | ~20min | 2 tasks | 2 files |
| Phase 06 P05 | ~18min | 2 tasks | 2 files |
| Phase 06 P06 | ~15min | 4 tasks | 6 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: Settings (SET-01, SET-02) deliberately placed in Phase 3 (not Phase 1/2) — first consumed by invoice generation, avoids building against placeholder template text.
- Roadmap: Deployment/auth hardening (rate limiting, secure cookies) folded into Phase 1 rather than a separate phase — no standalone v1 requirement backs a dedicated hardening phase under coarse granularity.
- Roadmap: Invoice snapshot immutability (INV-03/INV-04) and integer-cents money math (SESS-05) called out explicitly in phase success criteria as the highest-risk design points.
- [Phase 01]: shadcn 'new-york' style replaced by preset 'nova' (Lucide/Geist, neutral) — shadcn CLI moved from named styles to a preset system; nova satisfies the substantive UI-SPEC requirement
- [Phase 01]: STUD-01..04/AUTH-04 not marked complete in REQUIREMENTS.md despite 01-01 frontmatter listing them — Only DB schema exists in 01-01; functional login/CRUD UI is delivered in 01-02/01-03/01-04 — marking complete now would be a false positive
- [Phase 01]: drizzle.config.ts explicitly loads .env.local instead of relying on dotenv/config default — dotenv/config only auto-reads a literal .env file; Next.js convention uses .env.local, which was never being injected, breaking drizzle-kit push
- [Phase 01, Plan 02]: @vercel/functions' ipAddress() must be called as ipAddress({ headers: hdrs }), not ipAddress(hdrs), when hdrs comes from next/headers' headers() on Next.js 16.2.10 — the HeadersAdapter Proxy's `has` trap answers true for "headers" in hdrs, routing ipAddress() into the wrong branch (reads undefined instead of calling .get()). Found via live end-to-end testing, not code review.
- [Phase 01]: [Phase 01, Plan 03]: Added noValidate to the add/edit student form — Native type="email" HTML5 constraint validation was silently blocking submission of malformed emails before the server-side zod D-16 validation could run; server-side zod is now the sole validation gate (found via live Playwright testing).
- [Phase 01]: [Phase 01, Plan 03]: Replaced setState-in-useEffect with React's 'adjust state during render' pattern — Satisfies the project's react-hooks/set-state-in-effect ESLint rule when closing the Dialog after a successful add/edit submit.
- [Phase 01, Plan 04]: StudentTable generalized to a `renderActions`/`emptyState` prop API instead of a hardcoded active/archived variant switch — keeps the shared table/card component agnostic of which Server Actions or dialogs each page wires in, while both the active roster (Edit+Archive) and the archived view (Restore) reuse identical layout/typography.
- [Phase 01, Plan 04]: Restore implemented as a zero-JS `<form action={restoreStudentAction.bind(null, id)}>` (arg-bound Server Action, no client component) — restoring is single-click/non-destructive per D-11 with no pending-state UX requirement.
- [Phase 01, Plan 04]: Students/Archived tab pair inlined directly in each page rather than extracted into a shared component — the plan explicitly allowed either approach; inlining keeps each page's active-tab styling unambiguous for a two-link nav.
- [Phase 01, Plan 05]: Vercel env vars (DATABASE_URL, APP_PASSWORD, SESSION_SECRET) scoped to both Production and Preview to avoid preview-deploy build failures in future phases
- [Phase 01, Plan 05]: lib/db/index.ts calls neon(process.env.DATABASE_URL!) at module import time -- first Vercel build failed until DATABASE_URL was set in Vercel env; candidate future hardening is lazy-init the Neon client (not implemented, out of scope for 01-05)
- [Phase 02]: sessions.amountCents is a write-time snapshot, not derived live from the student's current rate — Per 02-RESEARCH.md Assumptions Log A1 -- schema only in 02-01, computation lands in 02-02
- [Phase 02]: sessions.studentId FK uses onDelete: restrict, never cascade — Preserves archived-student session history; an accidental hard delete errors loudly instead of silently wiping sessions
- [Phase 02]: TopNav treats both / and /archived as the Students tab's active state — Archived stays a nested sub-tab under Students (D-02), not a 4th top-level nav item, so the two nav layers never disagree
- [Phase 02]: SESS-01/SESS-05 not marked complete in REQUIREMENTS.md despite 02-01 frontmatter listing them — Only schema/format-helper groundwork ships in 02-01; the actual session-logging form and write-time amountCents computation land in 02-02 -- marking complete now would be a false positive (mirrors Phase 01 precedent)
- [Phase 02]: [Phase 02, Plan 02]: StudentCombobox requires itemToStringLabel in addition to itemToStringValue — Base UI Combobox resolves the displayed input label via itemToStringLabel separately from itemToStringValue; omitting it showed a serialized/garbled value instead of Name-parent email after selection (found via live SSR verification).
- [Phase 02]: [Phase 02, Plan 02]: amountCents is always computed server-side from a fresh students.rateCents re-fetch on both add and edit — Client-submitted rate/amount is never trusted or read from FormData (T-02-01 mitigation); mirrors Phase 1's money-integrity precedent.
- [Phase 02]: [Phase 02, Plan 02]: deleteSessionAction is a guarded hard DELETE (D-10), not a soft archive like students — Individual session rows are low-stakes and don't need a recoverable archive view; id must be a positive integer or the action throws before any DB write.
- [Phase 02]: [Phase 02, Plan 03]: Unbilled dashboard uses LEFT JOIN + GROUP BY + aggregate FILTER (WHERE billed=false), not INNER JOIN / WHERE billed — so $0 and billed-only students still appear at $0 (D-12) while billed sessions are excluded from the sums (DASH-02, Pitfall 4)
- [Phase 02]: [Phase 02, Plan 03]: Reusing the same Drizzle sql aggregate expression in both select and orderBy compiles cleanly on drizzle-orm 0.45.2 — the RESEARCH.md version-nuance flag required no workaround
- [Phase 02]: [Phase 02, Plan 03]: Dashboard expanded rows expose Edit only (no Delete) — the single destructive entry point stays on the Sessions page (D-11 / UI-SPEC Surface 4)
- [Phase 02]: 02-04: dropped export of initialSessionActionState from sessions.ts (use-server file) after runtime crash discovered during checkpoint verification — A "use server" file may only export async functions; the unused plain-object export crashed /sessions at module evaluation, which npm run build did not catch
- [Phase ?]: [Phase 03, Plan 01]: Single schema push for the whole phase (invoices + settings + sessions.invoiceId) so Waves 2-4 build against an already-pushed schema — no further push needed
- [Phase ?]: [Phase 03, Plan 01]: invoices.lineItems left as jsonb without a TS generic since InvoiceLineItem's shape is owned by lib/invoice/render.ts (Plan 02, not yet created)
- [Phase 03]: [Phase 3, Plan 02]: Pitfall 1 resolution 1 (single INSERT...RETURNING id, then a separate db.batch for the sessions UPDATE) used for generateInvoiceAction — Appropriate atomicity tradeoff for a single-user, low-concurrency app; db.transaction throws at runtime on neon-http
- [Phase 03]: [Phase 3, Plan 02]: invoice-view.tsx destructures only the props it currently uses, keeping invoiceId/parentEmail/sessionCount in the exported InvoiceViewProps interface — Avoids unused-var lint noise while wiring the full prop surface Plan 03 needs for Email/Delete
- [Phase 03]: [Phase 3, Plan 03]: Email Invoice styled with cn(buttonVariants({variant:'default'}), 'bg-blue-600 text-white hover:bg-blue-700') to match this codebase's existing accent-button convention rather than the Button primitive's default CVA color
- [Phase 03]: [Phase 3, Plan 03]: deleteInvoiceAction mirrors generateInvoiceAction's db.batch atomicity approach (never db.transaction, which throws at runtime on neon-http) for the un-bill + delete flow
- [Phase ?]: InvoiceHistoryTable renders View/Go-to-Dashboard links via cn(buttonVariants) on next/link Link rather than the Button primitive (which renders a <button>, not an <a>), matching invoice-view.tsx's existing anchor precedent — Consistency with Plan 03's Email Invoice anchor styling convention
- [Phase 03]: [Phase 3, Plan 05]: generateInvoiceAction's non-atomic write (Plan 02's "single INSERT...RETURNING then separate db.batch UPDATE") REPLACED with one db.batch wrapping a single data-modifying CTE (INSERT invoice + UPDATE sessions) — closes the INV-03 atomicity gap (03-VERIFICATION SC3 / 03-REVIEW WR-01). A double-billing guard gates the INSERT on all targets still being unbilled; a lost race returns a field error, not a duplicate invoice. Supersedes the "appropriate tradeoff" note under Plan 02.
- [Phase 03]: [Phase 3, Plan 05]: invoices.rendered_subject widened varchar(500) -> text (applied to Neon via drizzle-kit push) so a {student} merge can't overflow the atomic INSERT; Settings validation gained .max() bounds (WR-02/WR-03)

### Pending Todos

None yet.

### Blockers/Concerns

- REQUIREMENTS.md's original Traceability section stated "26 total" v1 requirements, but the actual v1 list (AUTH×4, STUD×4, SESS×5, DASH×2, INV×4, MAIL×4, SET×2, HIST×2) totals 27. Corrected during roadmap creation — see updated Coverage counts in REQUIREMENTS.md.
- ~~Plan 01-01 paused at checkpoint:human-action (Task 3)~~ RESOLVED 2026-07-04 — Neon DB provisioned and `.env.local` populated; `drizzle-kit push` succeeded, tables live.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260730-hjn | Replace cron automation with calendar tab and bulk email sending — removed all cron/auto-log/auto-send machinery (Phases 6/7 async paths superseded); added Calendar tab with derived pending occurrences + confirm-to-log | 2026-07-30 | 9060c1e | [260730-hjn-replace-cron-automation-with-calendar-ta](./quick/260730-hjn-replace-cron-automation-with-calendar-ta/) |
| fast | Force dynamic rendering on all data pages — Vercel served build-time prerendered snapshots, so DB writes not routed through a Server Action (e.g. cron-logged sessions) never appeared on the deployed site | 2026-07-30 | 4cc0e51 | — |

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-07-06T21:32:55.564Z
Stopped at: Phase 6 context gathered
Resume file: .planning/phases/06-scheduled-invoice-generation/06-CONTEXT.md
