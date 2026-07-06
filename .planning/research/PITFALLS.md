# PITFALLS Research — TutorInvoice v1.1 (Scheduling & Automation)

> Produced inline. Common mistakes when adding scheduling/automation to THIS stack (Vercel Hobby cron + Neon http/db.batch + iron-session + integer-cents). Each has a concrete prevention and a target phase.

## P1 — Timezone: cron runs in UTC, classes are local

**Failure:** the daily cron computes "today's classes" using UTC. Near midnight, or across DST, it logs Tuesday's class on Monday (or misses it), and the monthly invoice fires a day early/late.
**Prevention:** store the tutor's **IANA timezone** in Settings (e.g. `America/New_York`). In the cron, resolve "today" and the cadence-day check in that timezone (`date-fns-tz` or `Intl.DateTimeFormat`). IANA handles DST automatically — never store a fixed offset.
**Target phase:** timezone setting lands in the schema-foundation phase (04); consumed by the auto-log (05) and invoicing (06) crons.

## P2 — Idempotency / duplicate writes

**Failure:** Vercel can invoke a cron more than once; or a manual action overlaps the auto run — producing duplicate sessions for the same slot, or a second invoice.
**Prevention:**
- Auto-log: a **DB unique constraint** on `(studentId, date, scheduleId)` (or `+startTime`) plus `INSERT … ON CONFLICT DO NOTHING`, inside a `db.batch`. The constraint — not app-side checks — is the guarantee.
- Invoicing: reuse the **existing billed/invoiceId double-billing guard**, and add `lastInvoiceRunAt` so the cadence can't re-fire within its window. **Skip students with zero unbilled sessions** (no empty/duplicate invoices).
**Target phase:** auto-log 05, invoicing 06.

## P3 — Cron endpoint auth bypass (security-critical)

**Failure:** the cron route must skip the iron-session gate (it has no cookie) — if it's merely allowlisted in middleware and not otherwise secured, **anyone** can `GET /api/cron` and trigger invoice generation / session writes.
**Prevention:** verify `Authorization: Bearer $CRON_SECRET` as the first line of the handler; `401` otherwise. Vercel auto-sends this header on cron calls. Allowlist `/api/cron` in middleware **and** enforce the secret in the handler. Treat as a STRIDE (Spoofing/Tampering) item in the phase threat model.
**Target phase:** whichever phase introduces the cron route (05).

## P4 — Vercel Hobby cron limits

**Failure:** designing for minute/hour granularity or many cron jobs, then deploys silently don't fire as expected on Hobby.
**Prevention:** **daily** granularity, **one dispatcher** route branching by task (auto-log always; invoicing only on the cadence day). If finer cadence is genuinely needed, that's a **Vercel Pro billing decision**, not a redesign. Verify current limits in Vercel docs at build time.
**Target phase:** cron-introducing phase (05); note in ARCHITECTURE.

## P5 — Pop-up blocker kills the auto-opened email tab

**Failure:** opening the email draft with `window.open()` **after** the Generate Server Action resolves loses the "user gesture" context → the browser blocks the pop-up, and nothing opens.
**Prevention:** navigate the **current tab** to the `mailto:`/compose URL (`location.href` is not blocked), or open a blank tab **synchronously on the click** and set its `location` once the action returns. Don't rely on a post-await `window.open`.
**Target phase:** auto-open-email phase (04).

## P6 — neon-http atomicity broken under automation

**Failure:** batch auto-logging or multi-student scheduled generation done as separate awaited writes (or via `db.transaction()`, which throws on neon-http) → a mid-run failure leaves partial state (sessions logged but invoice not, or invoice without billed sessions).
**Prevention:** each atomic unit stays in **one `db.batch`** (the established primitive). Auto-log for a day can be one batched multi-row insert; scheduled invoicing loops **one `db.batch` per student** (reusing the extracted `generateInvoiceForStudent`), never one giant cross-student transaction (batch-size + partial-failure blast radius).
**Target phase:** 05 (auto-log), 06 (invoicing).

## P7 — Auto-billing a cancelled class

**Failure:** an auto-logged session for a class that didn't happen gets swept into an auto-generated invoice before the tutor deletes it → she over-bills a parent.
**Prevention:** (a) scheduled invoicing generates the snapshot but **sending stays manual** — she reviews before it reaches a parent, catching stragglers; (b) optionally **exclude same-day auto-created sessions** from an auto-invoice so there's always an edit window; (c) make deviation editing/deletion prominent on the dashboard. Product decision to confirm during phase discussion.
**Target phase:** invoicing 06 (coordinate with auto-log 05).

## P8 — Rate snapshot drift on auto-logged sessions

**Failure:** auto-logged sessions computed from a stale/hard-coded rate instead of the student's current `rateCents`, silently mis-billing.
**Prevention:** the cron computes `amountCents` from a **fresh `students.rateCents` read at write time** — identical to the manual session rule (D-14 precedent). Never trust cached rate.
**Target phase:** auto-log 05.
