---
quick_id: 260802-uqy
description: Calendar discard, editable session price, makeup tag, and bulk-invoice send verification
status: complete
date: 2026-08-02
files_modified:
  - lib/db/schema.ts
  - lib/validation/calendar.ts
  - lib/validation/session.ts
  - lib/actions/calendar.ts
  - lib/actions/sessions.ts
  - app/(app)/calendar/page.tsx
  - components/calendar-view.tsx
  - components/session-form-dialog.tsx
  - components/session-table.tsx
  - components/invoice-history-table.tsx
  - components/bulk-send-confirmation-dialog.tsx
  - drizzle/0002_blue_wilson_fisk.sql
---

# Summary

Four requested items. All verified end-to-end against an isolated test database
(`tutorinvoice_test`) — 30/30 checks passing.

## 1. Calendar "Discard" now discards

The button previously only closed the dialog; the pending chip came straight
back on the next render, because pending occurrences are *derived* from
`schedule_slots` on every request and never stored. "Don't show this one again"
therefore had nowhere to live.

Added `dismissed_occurrences` (slot + date, unique) and filtered the derived
pending list against it. The confirm dialog now has three outcomes instead of
two: **Cancel** (close, change nothing), **Discard** (record that the class
didn't happen), **Log Session**. Discarded classes render struck-through and
click to restore, so a mis-click is one click to undo. Discarded occurrences are
excluded from "Log all pending".

`onConflictDoNothing` on the unique index makes a double-click a no-op.
Dismissing an already-logged occurrence is rejected with a message pointing at
Sessions, since that's a real session row, not a chip.

## 2. Session price editable after logging

`sessionFormSchema` gained an optional `amountDollars`. Blank means "use the
rate", so untouched forms behave exactly as before; a value overrides and is
rounded to integer cents at the action boundary (never a stored float).

Per the decision taken: **the price locks once the session is billed onto an
invoice.** `editSessionAction` re-reads the live row (never trusts the form) and
rejects an amount change when `billed || invoiceId !== null`; the dialog shows
the frozen amount plus a "Locked" explanation instead of an input. Everything
else — date, duration, notes, makeup — stays editable. This keeps a sent
invoice's frozen total from ever disagreeing with the sessions it was built
from.

## 3. Makeup tag

`sessions.makeup` boolean, default false. Checkbox in the add/edit session
dialog, violet "Makeup" badge in the sessions list.

Per the decision taken it is **label-only** (no price effect) and **internal
only**. Confirmed internal by construction: `lib/invoice/render.ts` builds line
items from date/duration/amount/notes only, and the E2E asserts neither the
invoice preview nor the stored `rendered_body` contains "makeup".

## 4. Bulk invoice sending

**The feature was already built and works.** The reason multi-select was
impossible: the checkboxes only render for unsent invoices, and the account had
**zero invoices** — nothing to select. Gmail was already verified, so nothing
was misconfigured. Generating invoices makes the checkboxes appear.

Two real defects fixed while verifying:

- **No refresh after sending.** `handleConfirmSend` had a `// In a real app,
  would revalidate the data here` placeholder, so rows kept a stale "Not sent
  yet" badge and stayed selectable — a second click would re-send invoices that
  had already gone out. Now calls `router.refresh()`.
- **Confirmation modal was a bare `<div>`** — no `role="dialog"`, no focus trap,
  and no Escape. On the one screen that sends real email, there was no way to
  back out with the keyboard. Rebuilt on the shared `Dialog` primitive; Escape
  is ignored while a send is in flight so the result message isn't stranded.

## Verification

`tsc --noEmit` clean. Lint 12 → 11 problems (all remaining are pre-existing;
`calendar-view` count unchanged at baseline).

30/30 E2E checks against `tutorinvoice_test`, covering: Cancel-vs-Discard,
dismissal persistence across reload, exclusion from "Log all pending", restore,
price override, billed-price lock, makeup badge, makeup absent from invoice
body, two-invoice multi-select, select-all toggle, and the confirmation dialog.

## Notes / hazards found

- **`.env.local` DATABASE_URL is the production database.** There is no separate
  dev database. Anything run locally — including `npm test`
  (`tests/e2e-core-flows.spec.ts` reads `DATABASE_URL` straight from
  `.env.local`) — writes to live data. All work here used a separate
  `tutorinvoice_test` database created inside the same Neon project.
- **Production has no drizzle migration ledger** (`drizzle.__drizzle_migrations`
  is empty) — it was provisioned with `drizzle-kit push`, so `drizzle-kit
  migrate` would fail against it. Schema for this change was applied to
  production with hand-written idempotent DDL matching `0002_blue_wilson_fisk.sql`.
