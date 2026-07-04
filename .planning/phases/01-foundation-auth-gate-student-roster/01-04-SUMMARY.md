---
phase: 01-foundation-auth-gate-student-roster
plan: 04
subsystem: ui
tags: [nextjs, react19, server-actions, drizzle, soft-delete, shadcn, base-ui]

# Dependency graph
requires:
  - phase: 01-03
    provides: StudentTable/StudentFormDialog patterns, addStudentAction/editStudentAction, interactive app/page.tsx roster reading students WHERE archived=false
provides:
  - archiveStudentAction + restoreStudentAction Server Actions (soft-delete toggles on the `archived` boolean, never a hard DELETE)
  - ArchiveConfirmDialog client component (D-12 confirm-before-archive)
  - app/archived/page.tsx (Archived view, single-click Restore, own empty state)
  - StudentTable generalized to a renderActions/emptyState prop API shared by both the active roster and the archived view
  - Students/Archived tab pair on both `/` and `/archived`
affects: [01-05, phase-02, phase-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Arg-bound Server Actions used directly as a <form action={fn.bind(null, id)}> — no client component, no useTransition needed for simple one-argument mutations (restore, and the archive-confirm dialog's submit)"
    - "StudentTable takes `renderActions(student)` + `emptyState` props instead of being hardcoded to one action set — lets the active roster (Edit + Archive) and the archived view (Restore) share identical table/card layout and typography tokens without duplicating markup"
    - "Server Action-level defense-in-depth: archiveStudentAction/restoreStudentAction re-validate `id` with Number.isInteger + positivity checks before using it in a parameterized eq() predicate, since Server Actions are network-reachable POST endpoints regardless of the TypeScript signature at the call site"

key-files:
  created: [components/archive-confirm-dialog.tsx, app/archived/page.tsx]
  modified: [lib/actions/students.ts, components/student-table.tsx, app/page.tsx]

key-decisions:
  - "StudentTable's props were changed from a fixed student list to a renderActions/emptyState API (rather than a variant='active'|'archived' switch with hardcoded action buttons inside the component) so the component stays agnostic of which Server Actions or dialogs exist — the caller (app/page.tsx or app/archived/page.tsx) owns exactly which actions render per row."
  - "The Students/Archived tab pair is inlined directly in each page (not extracted to a shared component) per the plan's explicit fallback ('inline in each page') — keeps each page's active-tab styling unambiguous and avoids an extra shared component for two links."
  - "Restore uses a plain <form action={restoreStudentAction.bind(null, student.id)}> with zero client-side JS, since restoring is a single, non-destructive click (D-11) with no confirmation step and no pending-state UI requirement worth a 'use client' component."

patterns-established:
  - "renderActions/emptyState prop pattern on StudentTable — any future roster-adjacent list (e.g. sessions-per-student in Phase 2) needing table+card responsive layout with per-row actions can follow this same shape instead of forking the table component."

requirements-completed: [STUD-03]

# Metrics
duration: ~8min
completed: 2026-07-04
---

# Phase 1 Plan 4: Archive/Restore Soft-Delete Slice Summary

**Archive-not-delete flow: a D-12 confirm dialog before archiving, `archived` flag toggled via parameterized UPDATE (never DELETE), and an `/archived` view with one-click Restore, both gated by the existing middleware.**

## Performance

- **Duration:** ~8 min active execution across 2 tasks, including a full live Playwright/Chromium end-to-end run against a running `next dev` server
- **Started:** 2026-07-03T20:39:00-04:00 (approx, immediately after Plan 03's metadata commit)
- **Completed:** 2026-07-03T20:47:00-04:00
- **Tasks:** 2/2 completed
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments
- `archiveStudentAction(id)` / `restoreStudentAction(id)` (`lib/actions/students.ts`): parameterized `UPDATE students SET archived = {true|false} WHERE id = $1`, `id` re-validated as a positive integer at the Server Action boundary; both `revalidatePath("/")` and `revalidatePath("/archived")`; the file contains no `db.delete(students...)` call anywhere (verified by grep gate)
- `ArchiveConfirmDialog` (`components/archive-confirm-dialog.tsx`): shadcn/Base UI `Dialog` with title "Archive [Name]?", reassuring body copy, destructive-red "Archive Student" confirm (arg-bound Server Action form) and neutral "Keep on Roster" dismiss that performs no write
- `StudentTable` (`components/student-table.tsx`): generalized from a fixed active-roster table to a `renderActions`/`emptyState`-driven component, reused unmodified by both the active roster and the archived view
- `app/page.tsx`: visible "Archive" text-label action on every active-roster row (desktop table cell and mobile card), plus a Students/Archived tab pair with "Students" active in accent blue
- `app/archived/page.tsx`: new protected route querying `students WHERE archived = true ORDER BY name`, single-click "Restore" per row (no confirm dialog), "Archived" tab active, and its own "No archived students" / "Students you archive will show up here." empty state
- Verified end-to-end with a real Chromium browser (Playwright, fetched via `npx` for this one-off verification run only — not added to `package.json`) against a live `next dev` server: login → add test student → open Archive dialog → dismiss via "Keep on Roster" (student stays) → confirm "Archive Student" (student leaves active roster) → `/archived` shows the student with a Restore button → Restore (student leaves archived view, reappears on active roster) → archived-view empty state renders correctly with no archived rows remaining

## Task Commits

Each task was committed atomically:

1. **Task 1: archive + restore Server Actions + confirm dialog + roster Archive action** - `a50dedb` (feat)
2. **Task 2: Archived view route + Students/Archived tabs + restore** - `26b9315` (feat)

**Plan metadata:** (this commit) `docs(01-04): complete archive/restore soft-delete plan`

## Files Created/Modified
- `lib/actions/students.ts` - added `archiveStudentAction`/`restoreStudentAction`: validated `id` → parameterized UPDATE toggling `archived` → dual `revalidatePath`
- `components/archive-confirm-dialog.tsx` - new client component: D-12 confirm-before-archive dialog
- `components/student-table.tsx` - generalized to `renderActions`/`emptyState` props, shared by both roster views
- `app/page.tsx` - wires the Archive action into `renderActions`, adds the Students/Archived tab pair
- `app/archived/page.tsx` - new Archived Students route: query, Restore action, tab pair, empty state

## Decisions Made
- **`renderActions`/`emptyState` prop API over a hardcoded `variant` switch:** Keeps `StudentTable` fully decoupled from which Server Actions or dialog components exist — each page supplies its own action buttons (Edit+Archive vs. Restore) and empty-state copy/CTA, while the table/card layout and typography stay identical across both views.
- **Tabs inlined per page, not extracted to a shared `<RosterTabs>` component:** The plan explicitly allowed either approach ("a small shared header snippet or inline in each page"); inlining keeps each page's active/inactive tab styling trivially readable without an extra abstraction for two links.
- **Restore implemented as a plain `<form action={restoreStudentAction.bind(null, id)}>` with no `"use client"` wrapper:** Restoring is single-click and non-destructive (D-11) with no pending-state UX requirement, so the zero-JS arg-bound Server Action form pattern (documented Next.js pattern) is sufficient — avoids an unnecessary client component.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Anti-pattern grep gate false-positive from an explanatory comment**
- **Found during:** Task 1 — running the plan's own automated verify command before committing
- **Issue:** An explanatory code comment above `archiveStudentAction` literally contained the substring `db.delete(students`, which tripped the plan's own negative-match verification gate (`! grep -q 'db.delete(students'`) even though no such call exists in the actual code — the gate matches comments as well as executable code.
- **Fix:** Reworded the comment to describe the same intent ("this file must never issue a hard DELETE on the students table") without containing the literal disallowed substring.
- **Files modified:** `lib/actions/students.ts`
- **Verification:** Re-ran the exact verify command from the plan; grep now finds zero matches for `db.delete(students`, `tsc --noEmit` still passes.
- **Committed in:** `a50dedb` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 - bug, verification-tooling only, no behavioral change)
**Impact on plan:** No scope creep, no architectural change — purely a comment wording fix caught by running the plan's own verify script before committing, exactly as intended by the plan's automated gate.

## Issues Encountered
None beyond the one auto-fixed comment/grep collision documented above.

## User Setup Required
None - no external service configuration required. Playwright's Chromium browser binary was downloaded locally purely to run this plan's live end-to-end verification and is not a project dependency (not added to `package.json`/`package-lock.json`).

## Next Phase Readiness

Verified end-to-end with a live Chromium browser (Playwright) against a running `next dev` server, not just `tsc`/grep:
- `npx tsc --noEmit` exits 0; `npx eslint .` clean on all new/modified files
- Login → add a test student → active roster shows an "Archive" text-label action on the row
- Clicking Archive opens the confirm dialog titled "Archive [Name]?"; "Keep on Roster" dismiss performs no write, student remains
- Confirming "Archive Student" removes the student from the active roster; row is preserved in the DB (`archived = true`), never hard-deleted
- `/archived` lists the archived student with a single-click "Restore" button (no confirm dialog)
- Restoring returns the student to the active roster and removes it from the archived view
- Archived-view empty state renders "No archived students" / "Students you archive will show up here." once nothing is archived
- Students/Archived tab pair navigates between `/` and `/archived` on both pages, active tab in accent blue; `/archived` is gated by the existing `middleware.ts` choke point (unauthenticated requests redirect to `/login`, same as `/`)
- Test data (`ZZZ Archive Test Student`) deleted directly from the Neon `students` table after verification; dev server stopped

STUD-03 is now fully delivered: removing a student always archives (soft-hides), never hard-deletes, and history is preserved with a one-click restore path. Ready for 01-05, the final plan of Phase 1.

---
*Phase: 01-foundation-auth-gate-student-roster*
*Completed: 2026-07-04*

## Self-Check: PASSED

All created files verified present: components/archive-confirm-dialog.tsx, app/archived/page.tsx.
lib/actions/students.ts, components/student-table.tsx, app/page.tsx modifications verified present.
All referenced commits verified present in git log: a50dedb, 26b9315.
