---
phase: 02-session-logging-unbilled-dashboard
plan: 03
subsystem: dashboard, aggregate-query, ui

# Dependency graph
requires:
  - phase: 02-session-logging-unbilled-dashboard
    plan: 01
    provides: sessions table, lib/format.ts (formatCents/formatDuration), app/(app)/ route group + TopNav, /dashboard placeholder shell
  - phase: 02-session-logging-unbilled-dashboard
    plan: 02
    provides: SessionFormDialog (edit mode), StudentComboboxOption type, sessions CRUD Server Actions
provides:
  - Unbilled-dashboard aggregate query (LEFT JOIN + GROUP BY + FILTER billed=false) in app/(app)/dashboard/page.tsx
  - DashboardTable component (per-student unbilled rows, expandable to unbilled sessions with an edit path)
affects: []  # last plan of Phase 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Drizzle sql<number>`...filter (where ...)` aggregate reused in both select and orderBy — verified TS inference compiles cleanly on drizzle-orm 0.45.2 (no alias error, RESEARCH.md MEDIUM-confidence flag resolved)"
    - "LEFT JOIN + aggregate FILTER (not INNER JOIN / not WHERE billed) so $0 and billed-only students still render at $0 (Pitfall 4)"
    - "Record<number, Row[]> (plain object, not Map) for per-student session grouping so it serializes across the Server->Client Component boundary"

key-files:
  created:
    - components/dashboard-table.tsx
  modified:
    - "app/(app)/dashboard/page.tsx"

key-decisions:
  - "Individual unbilled-session rows (for the expanded-row Edit path) are fetched with a plain WHERE billed=false — correct here because that query lists rows and does not need to preserve $0/no-session students the way the aggregate roster query does; only the aggregate roster query uses LEFT JOIN + FILTER"
  - "hasAnySessions (for the zero-sessions info note) is computed from a dedicated count(*) over sessions rather than inferred from the aggregate rows — the aggregate always returns one row per active student even when zero sessions exist, so it cannot distinguish 'no sessions' from 'all $0'"
  - "Dashboard expanded rows expose Edit only (no Delete) — Delete stays on the Sessions page to avoid two destructive entry points for the same row (D-11 says 'a path to edit'; UI-SPEC Surface 4 resolves this explicitly)"

requirements-completed: [DASH-01, DASH-02]

# Metrics
duration: ~15min
completed: 2026-07-05
---

# Phase 2 Plan 3: Unbilled Dashboard Summary

**A glance-able, money-aware roster: every active student's total unbilled hours and amount owed, computed via a `LEFT JOIN + GROUP BY + FILTER (WHERE billed = false)` aggregate so $0/no-session students still appear (sorted to the bottom, de-emphasized) while billed sessions are excluded from the sums, each row expandable to its underlying unbilled sessions with an edit path.**

## Performance

- **Duration:** ~15 min (includes recovery from a mid-turn API connection error — both files were already written and verified before the interruption; no rework, only re-verification + the commits themselves)
- **Completed:** 2026-07-05
- **Tasks:** 2 completed
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- `app/(app)/dashboard/page.tsx` runs the DASH-01/DASH-02 aggregate: `db.select({...}).from(students).leftJoin(sessions, eq(sessions.studentId, students.id)).where(eq(students.archived, false)).groupBy(students.id, students.name).orderBy(desc(unbilledAmountExpr), asc(students.name))`, with `unbilledMinutesExpr`/`unbilledAmountExpr` = `coalesce(sum(...) filter (where billed = false), 0)`. Verified the same `sql` expression object reused in both `select` and `orderBy` compiles cleanly under drizzle-orm 0.45.2 (RESEARCH.md flagged this as version-nuanced — no alias error occurred, no fallback re-expression needed).
- The page also fetches the active student list (for the edit dialog's combobox), the individual unbilled session rows (grouped into a `Record<number, SessionRow[]>` by studentId for each expanded row), and a `count(*)` over sessions to drive the "No sessions logged yet — amounts will appear here…" de-emphasized info note (rendered under the h1 only when zero sessions exist app-wide; the full roster still renders below at $0.00 / 0 min).
- `components/dashboard-table.tsx` (`"use client"`) renders every active student as a collapsible row mirroring `session-table.tsx`'s affordance (chevron, `min-h-11` 44px tap target, collapsed by default). Collapsed content shows `formatDuration(unbilledMinutes)` + `formatCents(unbilledAmountCents)` side by side; $0/0-hour students still render but with `text-zinc-600` de-emphasis instead of `text-zinc-900`. Expanded content lists only that student's unbilled sessions (responsive table md+/card below md) with a single `SessionFormDialog mode="edit"` action per row — no Delete. Rows are rendered in the server-provided order (no client re-sort).

## Task Commits

Each task was committed atomically:

1. **Task 1: Unbilled aggregate query + Dashboard page shell** - `37883df` (feat)
2. **Task 2: DashboardTable — per-student unbilled rows, expandable with edit** - `575f71d` (feat)

## Files Created/Modified
- `app/(app)/dashboard/page.tsx` - Filled in: LEFT JOIN + GROUP BY + FILTER aggregate query, active-student + unbilled-session fetches, zero-session info note, `DashboardTable` wiring
- `components/dashboard-table.tsx` - New: per-student expandable unbilled rows, $0 de-emphasis, expanded-row Edit path

## Decisions Made
- The individual unbilled-session rows (for the expanded-row Edit path) are fetched with a plain `where(eq(sessions.billed, false))` — this is correct because that query *lists rows*; only the roster aggregate query needs the `LEFT JOIN + FILTER` combination to keep $0/no-session students visible (Pitfall 4 applies to the roster query, not the row-listing query).
- `hasAnySessions` is computed from a dedicated `count(*)` over `sessions`, not inferred from the aggregate rows — the aggregate always returns one row per active student even at zero sessions, so it cannot distinguish "no sessions logged" from "all students at $0".
- Dashboard expanded rows expose Edit only (no Delete), keeping the single destructive entry point on the Sessions page (UI-SPEC Surface 4 / D-11).

## Deviations from Plan

None — plan executed exactly as written. The RESEARCH.md MEDIUM-confidence flag about reusing an `sql` aggregate expression in `orderBy` was checked and required no workaround (TS inference compiled cleanly; no switch to an inner join or JS re-sort was needed).

## Issues Encountered
- The turn was interrupted by an API connection error after both files were written and all verification (grep gates, `npx tsc --noEmit`, `npm run build`) had passed, but before any commit. Resumed on the same main working tree: re-verified the uncommitted changes, re-ran the grep gates, and committed atomically — no code rework was required.
- `npm run build` still emits the pre-existing Next.js 16 "middleware → proxy" deprecation warning logged in `deferred-items.md` (from 02-01); unrelated to this plan, not re-fixed (scope boundary).
- `.planning/config.json` carries a pre-existing out-of-scope local modification (`workflow._auto_chain_active: false`); left uncommitted per the coordinator's instruction.

## User Setup Required

None — this plan only added a read-only aggregate page and its table component against the already-live `sessions`/`students` tables. No external service configuration.

## Requirements Note

DASH-01 (each student's total unbilled hours + amount owed at a glance) and DASH-02 (billed sessions excluded from the unbilled totals) are now fully implemented and marked complete in `REQUIREMENTS.md`. This completes Phase 2's requirement set (SESS-01..05 from 02-02, DASH-01..02 here).

## Next Phase Readiness
- The `sessions.billed` flag now has a live consumer (the dashboard's `FILTER (WHERE billed = false)`), so Phase 3's invoicing — which will flip `billed` to true on generate — will automatically reflect in the dashboard's unbilled totals via the existing `revalidatePath("/dashboard")` calls in the session Server Actions.
- `formatCents`/`formatDuration` and the collapsible-row + responsive table/card patterns are reused, not reinvented; Phase 3 can build invoice generation on the same aggregate-query and component idioms.
- No blockers identified.

---
*Phase: 02-session-logging-unbilled-dashboard*
*Completed: 2026-07-05*

## Self-Check: PASSED

Both claimed files verified present on disk (`components/dashboard-table.tsx`,
`app/(app)/dashboard/page.tsx`) and both commit hashes (`37883df`, `575f71d`)
found in `git log`. `npx tsc --noEmit` and `npm run build` both exit 0. All
grep gates from 02-03-PLAN.md pass (leftJoin, `filter (where`,
`eq(students.archived, false)`, `desc(`, no inner-join/WHERE-billed; DashboardTable,
formatDuration, formatCents, SessionFormDialog, min-h-11, text-zinc-600, no
SessionDeleteConfirmDialog). No missing items.
