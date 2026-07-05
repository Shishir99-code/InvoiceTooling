---
phase: 02-session-logging-unbilled-dashboard
reviewed: 2026-07-05T20:50:01Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - lib/actions/sessions.ts
  - lib/actions/students.ts
findings:
  critical: 0
  warning: 3
  info: 1
  total: 4
status: issues_found
---

# Phase 02: Code Review Report (re-review of CR-01 fix)

**Reviewed:** 2026-07-05T20:50:01Z
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Re-review of the two Server Action files changed by gap-closure plan 02-04 (CR-01):
`lib/actions/sessions.ts` and `lib/actions/students.ts`.

**CR-01 is resolved.** Both `addSessionAction`/`editSessionAction` (and the student
equivalents) now return a fresh `{ fieldErrors: null }` object literal on every success
instead of a shared module-level constant. This is the correct pattern for `useActionState`,
which detects state transitions by referential inequality — a fresh object guarantees the
consuming dialog's "close on success" reference check fires on the 2nd+ consecutive save.
Dropping `export` from the `initialSessionActionState` binding is also required, since a
`"use server"` module may only export async functions.

However, the fix left the now-orphaned constants in place. In both files the de-exported
constant is **dead code** — never referenced internally and never exported — producing a
`@typescript-eslint/no-unused-vars` warning (the rule is set to `'warn'` in the project's
`next/typescript` config; confirmed in `eslint-config-next/dist/typescript.js`). Separately,
both edit actions silently report success against a non-existent row id. No security
vulnerabilities, no data-loss risks, and no BLOCKER-severity issues were found.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: Dead, unused constant `initialSessionActionState` left behind by the CR-01 fix

**File:** `lib/actions/sessions.ts:18-20`
**Issue:** After the `export` keyword was removed, `initialSessionActionState` is no longer
referenced anywhere — not internally, not by consumers.
`components/session-form-dialog.tsx:41` defines its own
`const initialState: SessionActionState = { fieldErrors: null }`. The constant is now pure
dead code. Under the project's ESLint config (`next/typescript` sets
`@typescript-eslint/no-unused-vars: 'warn'`) this emits a lint warning on every `next lint` /
CI run. It does not fail the build (tsconfig has no `noUnusedLocals`), but it is unnecessary
surface area whose explanatory comment now documents a binding that has no reason to exist.
**Fix:** Delete the binding; fold the rationale into the interface comment instead:
```ts
export interface SessionActionState {
  fieldErrors: Record<string, string[]> | null;
}
// No shared initial-state constant is exported: a "use server" module may only
// export async functions. Consumers define their own literal — see
// components/session-form-dialog.tsx (mirrors lib/actions/students.ts).
```

### WR-02: Dead, unused constant `initialStudentActionState`

**File:** `lib/actions/students.ts:15`
**Issue:** Identical defect to WR-01. `initialStudentActionState` is declared but never used
or exported; `components/student-form-dialog.tsx:27` supplies its own `initialState` literal.
Emits an `@typescript-eslint/no-unused-vars` warning. Since the sessions.ts comment points to
this file as the pattern it mirrors, both should be cleaned up together for consistency.
**Fix:** Delete line 15 (`const initialStudentActionState: StudentActionState = { fieldErrors: null };`).

### WR-03: Edit actions report success for a non-existent row id (silent no-op)

**File:** `lib/actions/sessions.ts:114-127`, `lib/actions/students.ts:74-84`
**Issue:** Both `editSessionAction` and `editStudentAction` run
`db.update(...).set(...).where(eq(<table>.id, parsed.data.id))` and then unconditionally
return `{ fieldErrors: null }` without checking the affected-row count. If the submitted `id`
passes Zod validation (positive integer) but matches no row — e.g. a stale form for a
since-deleted session, or a crafted request against this network boundary — the UPDATE
affects zero rows and the caller is told the edit succeeded (dialog closes, `revalidatePath`
runs). `editSessionAction` even validates the foreign `studentId` (lines 99-106) but never
verifies the session it is editing exists. Low-probability in normal single-user flow, but a
correctness gap for a directly-invocable Server Action.
**Fix:** Inspect the affected rows via Drizzle `.returning()` and surface a field error when
nothing matched:
```ts
const updated = await db
  .update(sessions)
  .set({ /* ... */ })
  .where(eq(sessions.id, parsed.data.id))
  .returning({ id: sessions.id });

if (updated.length === 0) {
  return { fieldErrors: { id: ["Session no longer exists."] } };
}
```
Apply the equivalent guard in `editStudentAction`.

## Info

### IN-01: No error handling around database writes; non-finite rate not rejected

**File:** `lib/actions/sessions.ts:60-82, 99-123, 138`; `lib/actions/students.ts:52-58, 74-81, 96-99, 112-115`; `lib/validation/student.ts:18-20`
**Issue:** None of the DB calls are wrapped in `try/catch`. A transient Neon failure, or an
out-of-range value reaching an integer column, throws a raw error that surfaces to the client
as a generic unhandled Server Action error rather than a controlled `fieldErrors` response.
Note in particular that `rateDollars` is validated as
`z.coerce.number(...).positive(...)` with no `.finite()` — `Number("Infinity")` coerces to
`Infinity`, passes `.positive()`, and `Math.round(Infinity * 100)` would then flow into the
`rateCents` integer insert. This is consistent across the codebase and acceptable for a solo,
low-traffic app, hence Info rather than a defect.
**Fix (optional hardening):** Add `.finite()` to the `rateDollars` schema and wrap DB writes
in a `try/catch` returning `{ fieldErrors: { _form: ["Something went wrong, try again."] } }`.

---

_Reviewed: 2026-07-05T20:50:01Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
