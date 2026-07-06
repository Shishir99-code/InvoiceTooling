---
phase: 03-invoicing-email-history
plan: 04
subsystem: invoicing
tags: [drizzle, next-server-components, date-fns, responsive-table]

# Dependency graph
requires:
  - phase: 03-invoicing-email-history (Plan 02)
    provides: invoices table live in Neon, shared invoice-view.tsx + /history/[id] route
  - phase: 03-invoicing-email-history (Plan 03)
    provides: deleteInvoiceAction's redirect("/history") target (this plan creates that route)
provides:
  - components/invoice-history-table.tsx (InvoiceHistoryTable) — flat newest-first responsive list + empty state
  - app/(app)/history/page.tsx — /history route reading invoices desc(generatedAt) leftJoin students
  - Notes-are-parent-facing hint in components/session-form-dialog.tsx (D-02)
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "InvoiceHistoryTable is a plain Server Component (no \"use client\") — rows are non-interactive besides a per-row Link, so no client state is needed, unlike the accordion-based Dashboard/Sessions tables"
    - "Outline Link-as-button rendered via cn(buttonVariants({variant, size})) directly on a next/link Link, not the Button primitive — matches how invoice-view.tsx already styles its accent <a> anchor"

key-files:
  created:
    - components/invoice-history-table.tsx
    - app/(app)/history/page.tsx
  modified:
    - components/session-form-dialog.tsx

key-decisions:
  - "InvoiceHistoryRow.studentName typed string | null (leftJoin shape) with a \"Unknown student\" fallback at render time, mirroring the existing sessions/page.tsx leftJoin idiom, even though the invoices.studentId FK is onDelete: restrict and in practice never orphaned"

requirements-completed: [HIST-01, HIST-02]

# Metrics
duration: ~10min
completed: 2026-07-06
---

# Phase 3 Plan 4: Invoice History List + Notes Parent-Facing Hint Summary

**Flat, newest-first Invoice History list (StudentTable's responsive table/cards clone) linking each row to the existing frozen invoice view, plus a one-line D-02 hint warning the tutor that session notes are parent-facing.**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-07-06T01:49:26Z
- **Tasks:** 2/2 completed
- **Files modified:** 3 (1 modified, 2 created)

## Accomplishments
- `app/(app)/history/page.tsx` reads every invoice newest-first (`orderBy(desc(invoices.generatedAt))`, `leftJoin` students for the name column) and renders `InvoiceHistoryTable` — closing the loop HIST-01/HIST-02 required: the tutor can now see everything she's billed and reopen any invoice.
- `InvoiceHistoryTable` clones `StudentTable`'s exact responsive `hidden md:block` table / `flex flex-col gap-3 md:hidden` cards split and `py-16` empty state verbatim, with Student/Period/Total/Generated/Actions columns and an outline "View" `Link` per row to `/history/{id}` — reusing Plan 02's shared invoice view (with its Email/Copy/Delete affordances from Plans 02/03) with zero new route code.
- Empty state ("No invoices yet") includes an outline "Go to Dashboard" `Link`, mirroring `StudentTable`'s `emptyState.action` convention.
- `session-form-dialog.tsx` now shows "Notes appear on invoices sent to parents." between the "Notes (optional)" label and the textarea in both add and edit modes (D-02) — a labeling-only change with no schema/validation impact.
- The top nav's "History" tab (already wired to `/history` since Plan 01/foundation) now resolves to a real page instead of 404ing, which also unblocks `deleteInvoiceAction`'s `redirect("/history")` from Plan 03.

## Task Commits

Each task was committed atomically:

1. **Task 1: Invoice History list table + /history route** - `5e2abce` (feat)
2. **Task 2: Notes-are-parent-facing hint in the session dialog** - `f488e34` (feat)

## Files Created/Modified
- `components/invoice-history-table.tsx` - `InvoiceHistoryTable`, `InvoiceHistoryRow` type — responsive table(md+)/cards(mobile) + empty state, Server Component
- `app/(app)/history/page.tsx` - `/history` route, reads invoices desc(generatedAt) leftJoin students
- `components/session-form-dialog.tsx` - adds the one-line notes-are-parent-facing hint (D-02)

## Decisions Made
- Typed `InvoiceHistoryRow.studentName` as `string | null` (the natural shape of a `leftJoin`) with an "Unknown student" fallback at render time, following the same defensive pattern already used in `app/(app)/sessions/page.tsx`, even though `invoices.studentId`'s `onDelete: restrict` FK means this branch is effectively unreachable in practice.
- Rendered the "View" and "Go to Dashboard" links as plain `next/link` `Link` elements styled with `cn(buttonVariants({variant, size}))` rather than wrapping them in the `Button` primitive — matches the precedent already set by `invoice-view.tsx`'s "Email Invoice" anchor, since `Button`'s underlying `@base-ui/react` primitive renders a `<button>`, not an `<a>`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. All automated verify commands (`tsc --noEmit`, `npm run lint`, `npm run build`, and the plan's own source-grep assertions) passed on the first attempt for both tasks.

## User Setup Required

None - no external service configuration required. This plan only added application code against the already-live schema and components from Plans 01/02/03.

## Known Stubs

None. The `/history` route reads real data from the live `invoices`/`students` tables; every row's View link opens the real frozen invoice view. No placeholder/mock data paths.

## Next Phase Readiness
- This was the final plan of Phase 3 (`03-invoicing-email-history`). All four HIST/INV/MAIL/SET requirement groups for the phase are now code-complete: INV-01..04, MAIL-01..04, SET-01/02, HIST-01/02.
- **Deferred to end-of-phase human verification** (per `human_verify_mode: "end-of-phase"` in config.json): this plan's own manual check — generate two invoices for different students, confirm History lists them newest-first with the correct columns, click View to confirm it opens the frozen snapshot with Email/Copy/Delete affordances intact, delete all invoices and confirm the empty state renders with a working "Go to Dashboard" link, and confirm the notes hint appears in both Log Session and Edit Session dialogs. This is a live-browser check, not blocking this plan's automated completion.
- With `/history` now live, Plan 03's `deleteInvoiceAction` `redirect("/history")` (previously would have 404'd) is fully functional end-to-end.

---
*Phase: 03-invoicing-email-history*
*Completed: 2026-07-06*

## Self-Check: PASSED

All created/modified files verified present on disk; all task commit hashes (5e2abce, f488e34) verified in git log.
