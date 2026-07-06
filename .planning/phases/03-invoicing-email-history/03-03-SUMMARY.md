---
phase: 03-invoicing-email-history
plan: 03
subsystem: invoicing
tags: [gmail-compose-url, db-batch, next-server-actions, mailto]

# Dependency graph
requires:
  - phase: 03-invoicing-email-history (Plan 02)
    provides: invoice-view.tsx shared component (invoiceId/parentEmail/sessionCount already in props), generateInvoiceAction, /history/[id] route
provides:
  - lib/invoice/mailto.ts pure functions (buildGmailComposeUrl, isGmailUrlTooLong, GMAIL_URL_MAX_LEN)
  - deleteInvoiceAction — atomic un-bill + delete via db.batch
  - components/invoice-delete-confirm-dialog.tsx (InvoiceDeleteConfirmDialog)
  - invoice-view.tsx Email Invoice button + over-length guard + Delete Invoice trigger
affects: [03-04-invoice-history]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gmail compose deep link built exclusively via URLSearchParams({view:'cm',fs:'1',to,su,body}).toString() — never manual string concatenation, so a stray &/#/newline in a note or template cannot inject query params or truncate the URL"
    - "Over-length guard computed client-side (url.length > 1800) before rendering the Email anchor — an over-length Gmail URL doesn't error, it silently truncates, so the anchor is omitted entirely rather than risk a corrupted draft"
    - "deleteInvoiceAction mirrors generateInvoiceAction's atomicity approach: db.batch([...]) for the un-bill UPDATE + invoice DELETE, never db.transaction (throws at runtime on neon-http)"
    - "Accent anchor styled as a Button via cn(buttonVariants({variant:'default'}), 'bg-blue-600 text-white hover:bg-blue-700') — matches this codebase's existing bg-blue-600 accent convention (session/student/settings forms) rather than the Button primitive's default accent color"

key-files:
  created:
    - lib/invoice/mailto.ts
    - components/invoice-delete-confirm-dialog.tsx
  modified:
    - lib/actions/invoices.ts
    - components/invoice-view.tsx

key-decisions:
  - "Email Invoice rendered as a plain <a> styled with cn(buttonVariants({variant:'default'}), 'bg-blue-600...') rather than buttonVariants alone — grepping the existing codebase (session-form-dialog, student-form-dialog, settings-form, invoice-preview-dialog, login page) showed every primary/accent action in this app already uses the literal bg-blue-600/hover:bg-blue-700 override, not the Button primitive's default CVA color; matching that convention keeps the Email button visually consistent with every other primary action"
  - "InvoiceDeleteConfirmDialog is a near-verbatim clone of SessionDeleteConfirmDialog (same Dialog shell, bound-Server-Action-on-submit, trigger-neutral/confirm-red) with no onSuccess navigation wired client-side — deleteInvoiceAction's server-side redirect(\"/history\") makes that unnecessary, mirroring the plan's own note that the action returns void unlike generate (which must return the new id)"

requirements-completed: [MAIL-01, MAIL-02, MAIL-04]

# Metrics
duration: ~5min
completed: 2026-07-05
---

# Phase 3 Plan 3: Gmail Compose Handoff + Delete/Un-bill Recovery Summary

**One-click Gmail compose deep link (URLSearchParams-built, over-length-guarded) plus atomic delete-and-un-bill recovery via `db.batch`, both wired into the shared invoice view.**

## Performance

- **Duration:** ~5 min
- **Completed:** 2026-07-06T01:44:47Z
- **Tasks:** 3/3 completed
- **Files modified:** 4 (2 modified, 2 created)

## Accomplishments
- `lib/invoice/mailto.ts` is a pure, dependency-free module: `buildGmailComposeUrl` builds the D-10-locked `https://mail.google.com/mail/?view=cm&fs=1&to=…&su=…&body=…` deep link via `URLSearchParams` (never manual concatenation, so notes/template text containing `&`, `#`, or newlines can't inject params or break the URL — Pitfall 6), and `isGmailUrlTooLong`/`GMAIL_URL_MAX_LEN=1800` give a conservative safety margin below the ~2,000-char practical ceiling the research flagged (Pitfall 5).
- `deleteInvoiceAction` is the sole mistake-recovery path (D-16): a positive-integer id guard, then a single `db.batch([...])` that un-bills every session referencing the invoice (`billed: false, invoiceId: null`) and deletes the invoice row atomically — no `db.transaction` anywhere (it throws at runtime on this project's `neon-http` driver), then `revalidatePath` on both `/dashboard` and `/history` before a server-side `redirect("/history")`.
- `InvoiceDeleteConfirmDialog` clones `SessionDeleteConfirmDialog`'s shell exactly — bound Server Action on submit, "Keep Invoice" (neutral) / "Delete Invoice" (red) footer — with copy naming the exact student, period, and session count being returned to unbilled.
- `invoice-view.tsx`'s action row now computes the Gmail URL once per render and either shows an accent "Email Invoice" anchor (`target="_blank" rel="noopener noreferrer"`, styled to match the app's existing `bg-blue-600` accent convention) or, when over-length, hides it and shows an inline guard message above the always-present Copy button. The Delete Invoice trigger is the third and only action, matching the plan's "sole delete entry point" requirement.

## Task Commits

Each task was committed atomically:

1. **Task 1: Gmail compose URL builder + over-length guard** - `a4f999e` (feat)
2. **Task 2: deleteInvoiceAction (atomic un-bill + delete) + delete-confirm dialog** - `208b7c6` (feat)
3. **Task 3: Wire Email Invoice + over-length guard + Delete trigger into the invoice view** - `645abaf` (feat)

## Files Created/Modified
- `lib/invoice/mailto.ts` - `buildGmailComposeUrl`, `isGmailUrlTooLong`, `GMAIL_URL_MAX_LEN` — pure, no React/DB import
- `lib/actions/invoices.ts` - adds `deleteInvoiceAction` (db.batch atomic un-bill + delete, redirect to /history)
- `components/invoice-delete-confirm-dialog.tsx` - `InvoiceDeleteConfirmDialog`, clone of the session delete-confirm pattern
- `components/invoice-view.tsx` - adds Email Invoice accent anchor, over-length guard message, Delete Invoice trigger; destructures the previously-unused `invoiceId`/`parentEmail`/`sessionCount` props Plan 02 wired in for this purpose

## Decisions Made
- Matched the codebase's existing literal `bg-blue-600 text-white hover:bg-blue-700` accent-button convention (used identically in `session-form-dialog.tsx`, `student-form-dialog.tsx`, `settings-form.tsx`, `invoice-preview-dialog.tsx`, and `app/login/page.tsx`) rather than relying on the Button primitive's default CVA variant color, so the new Email Invoice anchor is visually consistent with every other primary action in the app.
- No client-side navigation is wired into `InvoiceDeleteConfirmDialog`'s submit handler beyond closing the dialog — `deleteInvoiceAction`'s server-side `redirect("/history")` handles navigation, exactly as the plan specified.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. All automated verify commands (`tsc --noEmit`, `npm run lint`, `npm run build`, and the plan's own source-grep assertions for each task) passed on the first attempt.

## User Setup Required

None - no external service configuration required. This plan only added application code against the already-live schema and components from Plans 01/02.

## Known Stubs

None. The Email Invoice button builds a real Gmail compose URL from live invoice data (parent email, frozen subject/body) and Delete Invoice performs a real atomic DB write — no placeholder/mock data paths.

## Next Phase Readiness
- `/history` (the flat list route) does not exist yet — `deleteInvoiceAction`'s `redirect("/history")` will 404 until Plan 04 creates `app/(app)/history/page.tsx`. This is expected: Plan 04 is the next plan in this phase and owns that route.
- **Deferred to end-of-phase human verification** (per `human_verify_mode: "end-of-phase"` in config.json): Task 3's plan-specified manual check — open a generated invoice, click Email Invoice and confirm a Gmail compose tab opens pre-filled with the parent's email/subject/body (line breaks intact); delete that invoice and confirm it lands on `/history` (once Plan 04 exists) with the student's sessions restored to unbilled on the Dashboard; and, if a very long invoice is available, confirm the Email button is replaced by the over-length message while Copy still works. This is a live-browser check against Google's unofficial, undocumented Gmail compose URL behavior (03-RESEARCH.md Open Question 1/A3), not blocking this plan's automated completion.

---
*Phase: 03-invoicing-email-history*
*Completed: 2026-07-05*

## Self-Check: PASSED

All created/modified files verified present on disk; all task commit hashes (a4f999e, 208b7c6, 645abaf) verified in git log.
