---
phase: 02-session-logging-unbilled-dashboard
reviewed: 2026-07-05T00:00:00Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - app/(app)/archived/page.tsx
  - app/(app)/dashboard/page.tsx
  - app/(app)/layout.tsx
  - app/(app)/page.tsx
  - app/(app)/sessions/page.tsx
  - components/dashboard-table.tsx
  - components/date-picker-field.tsx
  - components/session-delete-confirm-dialog.tsx
  - components/session-form-dialog.tsx
  - components/session-table.tsx
  - components/student-combobox.tsx
  - components/student-table.tsx
  - components/top-nav.tsx
  - components/ui/calendar.tsx
  - components/ui/combobox.tsx
  - components/ui/popover.tsx
  - components/ui/select.tsx
  - lib/actions/sessions.ts
  - lib/db/schema.ts
  - lib/format.ts
  - lib/validation/session.ts
findings:
  critical: 1
  warning: 5
  info: 3
  total: 9
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-07-05
**Depth:** standard
**Files Reviewed:** 21
**Status:** issues_found

## Summary

Reviewed the session-logging feature: the Server Actions (`lib/actions/sessions.ts`),
Zod validation (`lib/validation/session.ts`), the schema (`lib/db/schema.ts`), the
sessions/dashboard/archived pages, and the supporting client components plus copied
shadcn/Base-UI primitives.

The SQL is correctly parameterized (no injection surface), the amount snapshot is
computed server-side with `Math.round` (no float drift), and the dashboard aggregate
correctly uses a LEFT JOIN + `FILTER (WHERE billed = false)` so $0 students still show.

However there is **one core-workflow-breaking defect**: the "close the dialog on
success" logic uses reference-equality against a shared module-level constant, so the
Add-Session dialog stops auto-closing after the first successful add. Since the app's
whole reason for existing is logging *several* sessions in a row, this hits on every
2nd+ save. Additional warnings cover the frozen-snapshot recompute-on-edit behavior,
missing defense-in-depth auth on the Server Actions, and unbounded server-side
duration input.

## Critical Issues

### CR-01: Add/Edit dialog stops closing after the first successful submit

**File:** `lib/actions/sessions.ts:83`, `lib/actions/sessions.ts:124`, `components/session-form-dialog.tsx:93-99`

**Issue:** On success both `addSessionAction` and `editSessionAction` return the
**same module-level object** `initialSessionActionState` (defined once at line 15).
The dialog decides whether to close by comparing references:

```ts
const [prevState, setPrevState] = useState(state);
if (state !== prevState) {
  setPrevState(state);
  if (state.fieldErrors === null) setOpen(false);
}
```

Trace for repeated adds (the `SessionFormDialog` in the page header stays mounted
across opens, so `prevState` persists):

1. First success: action returns `initialSessionActionState` (ref A); `prevState`
   is the component's own `initialState` literal (ref B, line 41). `A !== B` → true →
   dialog closes. Works.
2. Second success: action returns `initialSessionActionState` again — **the exact
   same ref A**. Now `prevState === A`, so `A !== A` → false → `setOpen(false)`
   never runs. **The dialog stays open even though the session was saved.**

The tutor's primary flow is logging multiple sessions consecutively, so this
misfires on essentially every session after the first. The same defect applies to
editing the same session twice in one sitting.

**Fix:** Return a fresh object on each success so the reference always changes,
instead of the shared constant:

```ts
// addSessionAction and editSessionAction — success paths
return { fieldErrors: null };
```

(Alternatively, drive the close off an explicit success token/counter rather than
reference identity. Note: `lib/actions/students.ts` returns the shared
`initialStudentActionState` the same way — the student dialogs have the identical
latent bug and should be fixed together.)

## Warnings

### WR-01: Server Actions have no auth re-check (defense-in-depth gap)

**File:** `lib/actions/sessions.ts:45`, `:86`, `:129`

**Issue:** `addSessionAction`, `editSessionAction`, and `deleteSessionAction` perform
DB writes with no session/authorization check of their own — they rely entirely on
`middleware.ts` gating the route. Server Actions are independently-invocable POST
endpoints. CLAUDE.md itself flags middleware-auth-bypass history (CVE-2025-29927) and
warns that Server Actions "are callable like normal functions but are a network
boundary." A single middleware misconfiguration or matcher regression would expose
unauthenticated writes/deletes with no second line of defense.

**Fix:** Add a cheap session assertion at the top of each action (read the
`iron-session` cookie via `cookies()` and throw/redirect if not authenticated), e.g.
a shared `await requireAuth()` guard called first in every action.

### WR-02: Editing recomputes the "frozen" amount at the current rate

**File:** `lib/actions/sessions.ts:105-107`

**Issue:** `schema.ts:19` documents `amountCents` as a "frozen snapshot, computed
server-side once at write time" (D-14). But `editSessionAction` re-fetches the
student's **current** `rateCents` and recomputes `amountCents` on every edit — even
edits that only touch `notes` or `date`. If the student's rate changed after the
session was logged, correcting a typo in the notes silently repriced a historical
session at the new rate, contradicting the frozen-snapshot contract and potentially
changing what a parent is billed.

**Fix:** Decide the intended semantics explicitly. If the snapshot must stay frozen,
only recompute when `durationMinutes` actually changes, or persist the per-session
rate and recompute from that stored rate rather than the live `students.rateCents`.

### WR-03: Server accepts arbitrary duration; no upper bound or increment check

**File:** `lib/validation/session.ts:19-21`

**Issue:** `durationMinutes` is validated only as a positive integer. The UI constrains
it to 0–8 hours in 15-minute increments (`session-form-dialog.tsx:45-46`), but the
Server Action is a network boundary and a crafted POST can submit any positive
integer (e.g. 999999), producing an absurd `amountCents`. The validator is the sole
server-side guard and does not enforce the domain constraints the UI implies.

**Fix:** Bound and constrain in the Zod schema, e.g.
`.max(600)` (10h ceiling) and `.refine((m) => m % 15 === 0, "Use 15-minute increments.")`,
so the server enforces the same rules the UI shows.

### WR-04: Add-mode form retains stale values after a successful submit

**File:** `components/session-form-dialog.tsx:82-89`

**Issue:** After a successful add the dialog closes but the component stays mounted, so
`date`, `hours`, `minutes`, and `selectedStudent` keep their previous values (and any
prior `state.fieldErrors` remain rendered on reopen). The next Add opens pre-filled
with the last session's student and, more importantly, the **previously chosen date
rather than today** — easy to silently log a session against the wrong date. The
`initialDate = new Date()` default only applies at first mount.

**Fix:** Reset the local field state after a successful submit (in the same
success branch that calls `setOpen(false)`), or key/remount the form on close so add
mode re-initializes to today with no student selected.

### WR-05: Edit/delete silently succeed against a non-existent id

**File:** `lib/actions/sessions.ts:111-120`, `:135`

**Issue:** `editSessionAction`'s `UPDATE ... WHERE id = ?` and `deleteSessionAction`'s
`DELETE ... WHERE id = ?` affect 0 rows when the id does not exist, but the actions
report success (dialog closes, `revalidatePath` runs) with no signal that nothing
changed. Combined with `session-delete-confirm-dialog.tsx:55`'s optimistic
`onSubmit={() => setOpen(false)}`, a failed/no-op delete looks identical to a real one.

**Fix:** Check the affected-row count (Drizzle `.returning()` / result rowCount) and
surface an error state when zero rows matched, rather than assuming success.

## Info

### IN-01: Dead defensive fallbacks for student join

**File:** `app/(app)/sessions/page.tsx:47-48`

**Issue:** `row.studentName ?? "Unknown student"` and `row.studentArchived ?? false`
guard against a missing joined student, but `sessions.studentId` is a NOT-NULL FK with
`onDelete: "restrict"` and students are only ever soft-archived (`schema.ts:14-16`),
so the joined student is guaranteed present. The fallbacks are unreachable.

**Fix:** Harmless, but consider dropping the fallbacks (or switch to an inner join) to
avoid implying a nullable relationship that cannot occur.

### IN-02: Dashboard over-fetches unbilled sessions

**File:** `app/(app)/dashboard/page.tsx:41`

**Issue:** `unbilledSessionRows` selects every unbilled session across all students,
including archived students, then groups by studentId. Only active students appear in
`dashboardRows`, so archived students' rows are grouped into `sessionsByStudentId` and
never rendered. Not a correctness bug (out-of-scope performance-wise), just wasted work
and a slightly confusing data shape.

**Fix:** Optionally constrain the row query to active students (join/filter on
`students.archived = false`) to match the roster query.

### IN-03: `as number` assertions bypass Select typing

**File:** `components/session-form-dialog.tsx:164`, `:181`

**Issue:** `onValueChange={(value) => setHours(value as number)}` (and the minutes
equivalent) cast the Base-UI value straight to `number`. If the option value type ever
changes, the cast hides the mismatch from the type checker.

**Fix:** Type the callback via the generic Select value, or narrow with a runtime check
before `setHours`/`setMinutes`.

---

_Reviewed: 2026-07-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
