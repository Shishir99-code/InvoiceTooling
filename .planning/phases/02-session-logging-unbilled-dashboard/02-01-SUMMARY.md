---
phase: 02-session-logging-unbilled-dashboard
plan: 01
subsystem: database, ui
tags: [drizzle, postgres, neon, nextjs-app-router, shadcn, base-ui, tailwind]

# Dependency graph
requires:
  - phase: 01-foundation-auth-gate-student-roster
    provides: students table, middleware auth gate, StudentTable component, shadcn base-nova style setup
provides:
  - sessions Drizzle table live in Neon (studentId FK -> students.id, onDelete restrict)
  - lib/format.ts shared formatCents/formatDuration helpers
  - four shadcn Base UI primitives (combobox, select, popover, calendar) + react-day-picker
  - app/(app)/ route group with TopNav (Students/Dashboard/Sessions) wrapping every authenticated page
  - reachable placeholder Dashboard and Sessions page shells
affects: [02-02-session-logging, 02-03-unbilled-dashboard]

# Tech tracking
tech-stack:
  added: [react-day-picker (transitive via shadcn calendar), shadcn combobox/select/popover/calendar/textarea/input-group primitives]
  patterns: ["route-group layout (app/(app)/layout.tsx) for shared authenticated-page chrome", "usePathname()-driven active-link nav", "shared lib/format.ts money+duration helpers instead of per-component inline formatting"]

key-files:
  created:
    - lib/format.ts
    - components/top-nav.tsx
    - "app/(app)/layout.tsx"
    - "app/(app)/dashboard/page.tsx"
    - "app/(app)/sessions/page.tsx"
    - components/ui/combobox.tsx
    - components/ui/select.tsx
    - components/ui/popover.tsx
    - components/ui/calendar.tsx
  modified:
    - lib/db/schema.ts
    - components/student-table.tsx
    - "app/(app)/page.tsx (moved from app/page.tsx)"
    - "app/(app)/archived/page.tsx (moved from app/archived/page.tsx)"

key-decisions:
  - "sessions.amountCents is a write-time snapshot computed server-side, not derived live from the student's current rate (per 02-RESEARCH.md Assumptions Log A1) — schema only, computation lands in 02-02"
  - "sessions.studentId FK uses onDelete: restrict, never cascade, so archived-student history is preserved and an accidental hard delete errors loudly"
  - "TopNav computes Students-tab active state for both / and /archived (Archived stays a nested sub-tab, not a 4th top-level nav item, per D-02)"

requirements-completed: []  # NOT marked complete in REQUIREMENTS.md — see note below (mirrors Phase 01 precedent)

# Metrics
duration: ~10min
completed: 2026-07-05
---

# Phase 2 Plan 1: Foundation - Sessions Schema & Route-Group Nav Summary

**Added the `sessions` table (live in Neon) and shared `lib/format.ts` helpers, installed four shadcn Base UI primitives, and restructured authenticated pages into an `app/(app)/` route group behind a new Students/Dashboard/Sessions top nav.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-07-05T15:06:54Z
- **Completed:** 2026-07-05T15:14:09Z
- **Tasks:** 3 completed (Task 2 was a DB-only push, no source commit)
- **Files modified:** 17

## Accomplishments
- `sessions` table defined in `lib/db/schema.ts` and pushed live to Neon (`drizzle-kit push`), verified via `to_regclass` and FK inspection
- `lib/format.ts` extracts `formatCents` from `student-table.tsx`'s inline `formatRate` and adds `formatDuration` matching the UI-SPEC's "{h} hr(s) {m} min" convention
- Four shadcn Base UI primitives installed (`combobox`, `select`, `popover`, `calendar`) plus transitive `textarea`/`input-group`, with `react-day-picker` confirmed in `package.json`
- Authenticated pages moved into `app/(app)/` under a new `TopNav` (Students/Dashboard/Sessions); root layout and `/login` remain nav-free; `/dashboard` and `/sessions` are reachable placeholder shells for 02-03/02-02

## Task Commits

Each task was committed atomically:

1. **Task 1: Add sessions table, extract format helpers, install shadcn primitives** - `9b6b73e` (feat)
2. **Task 2: [BLOCKING] Push schema — create the sessions table in Neon** - no source commit (DB-only `drizzle-kit push`, schema.ts already committed in Task 1); verified via `to_regclass('public.sessions')` and FK inspection scripts
3. **Task 3: Route-group restructure + top nav (D-01, D-02)** - `4d555df` (feat)
4. Deferred-item logging (out-of-scope middleware deprecation warning found during Task 3 build) - `9d9ecc4` (docs)

**Plan metadata:** _(added after this summary is committed)_

_Note: Task 2 intentionally has no code commit — it is a live database mutation (`drizzle-kit push`) against Neon, not a source file change._

## Files Created/Modified
- `lib/db/schema.ts` - Added `sessions` pgTable (studentId FK restrict, date/durationMinutes/amountCents/notes/billed/createdAt columns)
- `lib/format.ts` - New: `formatCents(cents)` and `formatDuration(minutes)` shared display helpers
- `components/student-table.tsx` - Imports `formatCents` from `@/lib/format`, removed local `formatRate`
- `components/ui/combobox.tsx`, `select.tsx`, `popover.tsx`, `calendar.tsx`, `textarea.tsx`, `input-group.tsx` - shadcn Base UI primitives (base-nova style)
- `package.json` / `package-lock.json` - Added `react-day-picker` (transitive, via `shadcn add calendar`)
- `components/top-nav.tsx` - New `"use client"` TopNav using `usePathname()`, three links (Students/Dashboard/Sessions), Students active for `/` and `/archived`
- `app/(app)/layout.tsx` - New route-group layout rendering `TopNav` + `<main>{children}</main>`
- `app/(app)/page.tsx`, `app/(app)/archived/page.tsx` - Moved verbatim from `app/page.tsx`/`app/archived/page.tsx` (URLs unchanged: `/`, `/archived`)
- `app/(app)/dashboard/page.tsx`, `app/(app)/sessions/page.tsx` - New placeholder page shells (filled by 02-03/02-02)
- `.planning/phases/02-session-logging-unbilled-dashboard/deferred-items.md` - New: logs the pre-existing `middleware.ts` deprecation warning (out of scope for this plan)

## Decisions Made
- Kept the nested Students/Archived sub-tab pair inlined in `app/(app)/page.tsx`/`archived/page.tsx` unchanged, exactly as D-02 requires — Archived is not promoted to the top-level nav
- `TopNav`'s Students link treats both `/` and `/archived` as "active" so the sub-tab pair and top nav never disagree about which top-level section is highlighted
- Left `components/ui/textarea.tsx` and `input-group.tsx` (transitive files pulled by `shadcn add combobox`) in place even though not explicitly named in the plan's file list — they are shadcn-generated dependencies of the requested components, not hand-authored scope creep

## Deviations from Plan

None — plan executed exactly as written. The `textarea.tsx`/`input-group.tsx` files were pulled automatically by the `shadcn add combobox` command itself (not a manual addition) and are within the spirit of "install the shadcn UI primitives" from the objective.

## Issues Encountered
- `npm run build` surfaced a pre-existing Next.js 16 deprecation warning ("middleware" file convention → "proxy") originating from Phase 1's `middleware.ts`, unrelated to this plan's changes. Logged in `deferred-items.md` per the scope-boundary rule rather than fixed inline.
- Local port 3000 was occupied by another process during manual verification; dev server auto-selected port 3001 — verification (Playwright script) was run against `localhost:3001` with no functional impact.

## User Setup Required

None - no external service configuration required. The `sessions` table push used the same `.env.local`/Neon connection already configured in Phase 1.

## Requirements Note

SESS-01 and SESS-05 are listed in this plan's frontmatter `requirements` field, but
only the *schema groundwork* for them ships here (the `sessions` table, the
FK/column shapes, and `lib/format.ts`'s display helpers). The actual "log a
session via autocomplete/date/hours" flow (SESS-01) and the write-time
`amountCents` computation (SESS-05) are implemented in Plan 02-02. Marking
these complete in `REQUIREMENTS.md` now would be a false positive — mirroring
the exact precedent set in Phase 01 (STUD-01..04/AUTH-04 were left unmarked
after 01-01 for the same reason). Left unmarked; 02-02's SUMMARY should mark
them complete instead.

## Next Phase Readiness
- `sessions` table, `lib/format.ts`, the four shadcn primitives, and the `app/(app)/` route group + `TopNav` are all in place and verified live (Neon) and in the browser (Playwright: login has no nav, authenticated routes show nav + correct headings, `/archived` still resolves under the Students tab).
- 02-02 (session logging) and 02-03 (unbilled dashboard) can now build directly on this schema, format helpers, shadcn primitives, and the `/sessions`/`/dashboard` placeholder routes without further scaffolding.
- No blockers identified.

---
*Phase: 02-session-logging-unbilled-dashboard*
*Completed: 2026-07-05*

## Self-Check: PASSED

All claimed files and commit hashes verified present on disk and in `git log`. No missing items.
