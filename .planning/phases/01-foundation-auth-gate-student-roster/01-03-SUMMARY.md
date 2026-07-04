---
phase: 01-foundation-auth-gate-student-roster
plan: 03
subsystem: ui
tags: [nextjs, react19, server-actions, zod, drizzle-zod, shadcn, base-ui, useActionState]

# Dependency graph
requires:
  - phase: 01-02
    provides: middleware.ts auth gate, app/page.tsx protected roster Server Component reading students WHERE archived=false ORDER BY name
provides:
  - studentFormSchema (zod v4 + drizzle-zod validation for name/rateDollars/parentEmail)
  - addStudentAction + editStudentAction Server Actions (validated writes to students table)
  - StudentFormDialog client component (shadcn/base-ui Dialog + useActionState, shared add/edit modal)
  - StudentTable Server Component (responsive table/cards + D-15 empty state)
  - Interactive app/page.tsx roster (Add Student CTA + StudentTable)
affects: [01-04, 01-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "drizzle-zod createInsertSchema(students, {...}).pick({name:true}).extend({...}) as the single validation schema shared by add and edit forms"
    - "zod v4 top-level z.email() + z.flattenError(error).fieldErrors (not the deprecated .email()/.flatten()/.errors)"
    - "Math.round(rateDollars * 100) at the Server Action boundary — dollars-in, cents-stored, never a raw float"
    - "useActionState + form noValidate — server-side zod is the sole validation source of truth; native HTML5 constraint validation is disabled so it can't intercept submission before the server round-trip"
    - "React 19 'adjust state during render' pattern (compare to a tracked prevState) instead of setState-in-useEffect to close a Dialog after a successful action — avoids the react-hooks/set-state-in-effect lint rule's cascading-render warning"
    - "Base UI (@base-ui/react/dialog) render prop convention: children go on the Primitive wrapper (DialogTrigger/DialogClose), the `render` element carries only style/variant props — Base UI's mergeProps keeps outer children over the render element's (empty) children"

key-files:
  created: [lib/validation/student.ts, lib/actions/students.ts, components/student-form-dialog.tsx, components/student-table.tsx]
  modified: [app/page.tsx]

key-decisions:
  - "Added noValidate to the add/edit <form> after live Playwright testing showed the browser's native type=\"email\" constraint validation silently blocked submission of malformed emails, preventing the D-16 'Enter a valid email.' server message from ever being reached."
  - "Fixed a react-hooks/set-state-in-effect ESLint error by switching from useEffect+setOpen(false) to React's documented 'adjust state during render' pattern (compare state to a tracked prevState during render, call setOpen conditionally) — avoids a cascading-render anti-pattern flagged by the project's lint config."
  - "editStudentAction's `id` field is validated via a locally-extended zod schema (studentFormSchema.extend({id: z.coerce.number().int().positive()})) kept inside lib/actions/students.ts rather than exported from lib/validation/student.ts, so the validation module's public surface stays scoped to the add/edit form fields only."

patterns-established:
  - "Single StudentFormDialog component parameterized by mode: \"add\" | \"edit\" drives both the add and edit modals from one useActionState-wired form — the pattern later archive/session/invoice CRUD dialogs in Phases 2-3 can reuse."

requirements-completed: [STUD-01, STUD-02, STUD-04]

# Metrics
duration: ~15min
completed: 2026-07-04
---

# Phase 1 Plan 3: Student Roster CRUD — Add/Edit via Zod-Validated Server Actions Summary

**Interactive student roster: `useActionState`-driven shadcn/Base-UI Dialog for add/edit, backed by `addStudentAction`/`editStudentAction` Server Actions validated with a `drizzle-zod`-derived zod v4 schema, converting plain-dollar input to integer cents via `Math.round`**

## Performance

- **Duration:** ~15 min active execution across 2 tasks, including live Playwright browser verification against a running `next dev` server and two real bugs found/fixed mid-flight
- **Started:** 2026-07-03T20:24:00-04:00 (approx)
- **Completed:** 2026-07-03T20:35:48-04:00
- **Tasks:** 2/2 completed
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments
- `studentFormSchema` (`lib/validation/student.ts`): `drizzle-zod`'s `createInsertSchema(students, {...})` picks the table-derived `name` rule, extended with `rateDollars` (positive number, custom "Rate must be a positive number." message) and `parentEmail` (`z.email(...)`, required per D-13)
- `addStudentAction` / `editStudentAction` (`lib/actions/students.ts`): both `safeParse` `FormData` through the shared schema, return `{ fieldErrors }` via zod v4's `z.flattenError` on failure, convert dollars to integer cents with `Math.round` (never a float) on success, and `revalidatePath("/")`; no duplicate-name check exists (D-09)
- `StudentFormDialog` (`components/student-form-dialog.tsx`): one client component serves both add and edit via a `mode` prop, driven by `useActionState`; inline destructive-red error text under each field (D-16); primary button reads "Add Student"/"Save Changes", "Adding…"/"Saving…" while pending; closes automatically on a successful submit
- `StudentTable` (`components/student-table.tsx`): Server Component rendering a `shadcn` `Table` on `md:`+ and stacked cards below it (D-14 mobile-friendly), or the D-15 "No students yet" empty state with a centered Add Student button
- `app/page.tsx`: top-right "Add Student" CTA (shown once students exist) + `<StudentTable>`, still reading `students WHERE archived=false ORDER BY name` (D-08) from Plan 02
- Verified end-to-end with a real Chromium browser (Playwright) against a live `next dev` server: login → empty state → invalid submit (all 3 D-16 messages, dialog stays open) → valid submit (dialog closes, row appears) → duplicate name allowed (D-09) → alphabetical sort (D-08) → edit prefill + persist

## Task Commits

Each task was committed atomically:

1. **Task 1: studentFormSchema + add/edit Server Actions** - `b864cba` (feat)
2. **Task 2: Roster table + empty state + add/edit modal dialog** - `304f9e1` (feat)

**Plan metadata:** (this commit) `docs(01-03): complete student roster CRUD plan`

## Files Created/Modified
- `lib/validation/student.ts` - `studentFormSchema`: drizzle-zod-derived `name` rule + zod v4 `rateDollars`/`parentEmail` extensions
- `lib/actions/students.ts` - `addStudentAction`, `editStudentAction`: parse → `Math.round` cents conversion → Drizzle insert/update → `revalidatePath("/")`
- `components/student-form-dialog.tsx` - client Dialog, `useActionState(addStudentAction | editStudentAction)`, shared add/edit modal, inline field errors
- `components/student-table.tsx` - Server Component: responsive table/cards or empty state
- `app/page.tsx` - wires the "Add Student" CTA + `<StudentTable>` into the protected roster page

## Decisions Made
- **`noValidate` on the form (Rule 1 bug fix):** Live Playwright testing showed the browser's native `type="email"` constraint validation intercepted and blocked submission of a malformed email before the request ever reached the server, so the exact D-16 "Enter a valid email." message never appeared — only the browser's own validation tooltip did. Added `noValidate` to the `<form>` so server-side zod validation (already the documented source of truth per RESEARCH.md Pattern 3) is what actually runs, matching the "client never duplicates validation rules" design intent.
- **`useEffect`+`setOpen` replaced with the "adjust state during render" pattern (Rule 1 lint fix):** The project's ESLint config (`react-hooks/set-state-in-effect`) flagged calling `setOpen(false)` inside a `useEffect` as a cascading-render anti-pattern. Replaced with React's documented alternative — compare the current `useActionState` result against a tracked `prevState` during render and call `setOpen` conditionally in that comparison, not inside an Effect.
- **Base UI `render`-prop children convention followed from the existing `dialog.tsx`:** Verified via `@base-ui/react`'s `mergeProps` source that children belong on the `DialogTrigger`/`DialogClose` wrapper (not the element passed to `render`), matching the convention already established in the shipped `components/ui/dialog.tsx` file (its `DialogClose` fallback and `showCloseButton` implementation both follow this shape).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Native `type="email"` HTML5 validation blocked the D-16 malformed-email error path**
- **Found during:** Task 2 — live Playwright end-to-end verification of the invalid-submit scenario against a running `next dev` server
- **Issue:** With `<Input type="email" required>` and no `noValidate` on the form, submitting `"notanemail"` never reached `editStudentAction`/`addStudentAction` at all — the browser's own constraint validation blocked the submit client-side, so the server's custom "Enter a valid email." message was unreachable, silently failing the plan's exact D-16 acceptance criterion
- **Fix:** Added `noValidate` to the `<form>` in `components/student-form-dialog.tsx`, making the zod-based Server Action validation the sole gate (consistent with RESEARCH.md's explicit "client never duplicates validation rules" framing for this form)
- **Files modified:** `components/student-form-dialog.tsx`
- **Verification:** Re-ran the Playwright script after the fix — invalid name/rate/email submission now shows all three exact D-16 messages inline and the dialog stays open; a corrected, valid resubmission closes the dialog and the row appears
- **Committed in:** `304f9e1` (Task 2 commit)

**2. [Rule 1 - Bug] `setOpen(false)` inside `useEffect` triggered an ESLint `react-hooks/set-state-in-effect` error**
- **Found during:** Task 2 — running the project's ESLint config against the new component before committing
- **Issue:** The original close-on-success implementation called `setOpen(false)` inside a `useEffect([state])`, which ESLint's `react-hooks/set-state-in-effect` rule flags as a cascading-render anti-pattern
- **Fix:** Replaced the Effect with React's documented "adjust state during render" pattern — track the previously-seen `useActionState` result in a `prevState` state variable and call `setOpen` conditionally during render when the reference changes, not inside an Effect
- **Files modified:** `components/student-form-dialog.tsx`
- **Verification:** `npx eslint components/student-form-dialog.tsx` passes with zero errors; Playwright re-verification confirms the dialog still closes correctly on successful submit and stays open on validation failure
- **Committed in:** `304f9e1` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 - bugs)
**Impact on plan:** Both fixes were necessary for the plan's own D-16 acceptance criterion and for a clean lint pass; no scope creep, no architectural change. Both were found only because live browser + lint verification was carried out before committing, not by code review alone.

## Issues Encountered
None beyond the two auto-fixed bugs documented above.

## User Setup Required
None - no external service configuration required. `.env.local` was already populated in Plan 01-01.

## Next Phase Readiness

Verified end-to-end with a live Chromium browser (Playwright) against a running `next dev` server, not just `tsc`/grep:
- `npx tsc --noEmit` exits 0; `npx eslint` clean on all new/modified files
- Login → roster renders "No students yet" + empty-state Add Student button (fresh DB)
- Empty-state Add Student opens a modal titled "Add Student"
- Submitting blank name / rate "0" / "notanemail" shows all three exact D-16 messages inline; dialog stays open, no DB write
- Valid submit ("Ada Lovelace", "19.99", "parent@example.com") closes the dialog; roster shows "Ada Lovelace", "$19.99", "parent@example.com"
- A second student named "Ada Lovelace" saves without any blocking (D-09)
- Roster is alphabetically sorted after adding "Aaron Zed" (D-08)
- Edit dialog prefills existing values (name/rate-as-dollars/email) correctly; changing name + rate persists and re-renders live
- Test data cleared from the Neon `students` table after verification; dev server stopped

Ready for 01-04 — the roster/table/dialog patterns and `students` CRUD Server Actions this plan built are the base the archive/restore flow (STUD-03, D-10/D-11/D-12) and any further roster work will extend.

---
*Phase: 01-foundation-auth-gate-student-roster*
*Completed: 2026-07-04*

## Self-Check: PASSED

All created files verified present: lib/validation/student.ts, lib/actions/students.ts, components/student-form-dialog.tsx, components/student-table.tsx.
app/page.tsx modification verified present.
All referenced commits verified present in git log: b864cba, 304f9e1.
