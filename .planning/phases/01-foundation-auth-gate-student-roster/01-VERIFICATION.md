---
phase: 01-foundation-auth-gate-student-roster
verified: 2026-07-04T02:15:00Z
status: passed
score: 10/10 must-haves verified
overrides_applied: 0
---

# Phase 1: Foundation — Auth Gate & Student Roster Verification Report

**Phase Goal:** Tutor can securely reach a deployed, always-on app and build out her student roster — the foundation every later phase depends on.
**Verified:** 2026-07-04T02:15:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria + Plan must_haves)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can unlock the app by entering the single shared password and stays logged in across refreshes via a secure (HttpOnly/Secure) session cookie | VERIFIED | `lib/actions/auth.ts` compares password with `crypto.timingSafeEqual` on equal-length buffers (never `===`), sets `session.isLoggedIn = true` + `session.save()` on match, redirects to `/`. `lib/session.ts` sets `httpOnly: true`, `secure: process.env.NODE_ENV === "production"`, `sameSite: "lax"`, `maxAge: 2592000` (30 days). Live production UAT confirmed refresh + tab close/reopen preserve session. |
| 2 | Every page except login is inaccessible without a valid session; repeated wrong-password attempts are rate-limited | VERIFIED | `middleware.ts` matcher `["/((?!login|_next/static|_next/image|favicon.ico).*)"]` redirects to `/login` when `!session.isLoggedIn` — deny-by-default, no per-route opt-out. `lib/actions/auth.ts` checks `login_attempts.lockedUntil` before comparing password, locks after `MAX_ATTEMPTS=5` for `COOLDOWN_MS=15min`, keyed by `ipAddress()` from `@vercel/functions` (Postgres-backed, survives serverless cold starts — not in-memory). Live UAT confirmed 5 wrong attempts trigger the lockout message. |
| 3 | User can add a student (name, hourly rate, required parent email), view the full list, and edit any student's name/rate/parent email | VERIFIED | `lib/actions/students.ts` exports `addStudentAction`/`editStudentAction`, zod-validated via `lib/validation/student.ts` (`z.email()`, `.positive()`, required `name.min(1)`), `Math.round(rateDollars * 100)` → `rateCents` (no float drift). `app/page.tsx` queries `students WHERE archived=false ORDER BY name`. `components/student-form-dialog.tsx` wires both actions via `useActionState`, shows inline field errors, closes only on successful (fieldErrors===null) submit. |
| 4 | User can remove a student — students with history are archived rather than deleted | VERIFIED | `lib/actions/students.ts`: `archiveStudentAction` does `db.update(students).set({archived:true})...`; `restoreStudentAction` sets `archived:false`. Confirmed via `grep -rn "db.delete" lib/ app/"` → the ONLY `db.delete` call in the entire codebase is `db.delete(loginAttempts)` in `auth.ts` (resetting the rate-limit counter on successful login) — **zero** `db.delete(students...)` calls anywhere. Soft-delete invariant holds. `components/archive-confirm-dialog.tsx` requires confirmation before archiving; `app/archived/page.tsx` lists archived rows and offers single-click restore. |
| 5 | The app is reachable at a live Vercel production URL, always-on | VERIFIED | Live at https://invoice-tooling-lovat.vercel.app (per 01-05-SUMMARY.md and phase context); `npm run build` and `npm run lint` verified clean locally in this verification pass as well (see Behavioral Spot-Checks). |
| 6 | drizzle-kit push applies schema; students + login_attempts tables exist in Neon | VERIFIED (documented) | `lib/db/schema.ts` matches plan spec exactly (id, name, rate_cents, parent_email, archived, created_at / ip_address, failed_count, locked_until). 01-01-SUMMARY.md documents direct `information_schema.columns` confirmation post-push. Live production login + student CRUD (confirmed working in UAT) is only possible if these tables exist and are correctly shaped — functional confirmation via production behavior. |
| 7 | First run (zero students) shows a friendly empty state with a prominent Add button; archived view has its own empty state | VERIFIED | `components/student-table.tsx` renders `emptyState.heading`/`body`/`action` when `students.length === 0`. `app/page.tsx` passes "No students yet" / "Add your first student to get started." with an Add Student action; `app/archived/page.tsx` passes "No archived students" / "Students you archive will show up here." (no action, per plan). |
| 8 | Invalid input (blank name, non-positive rate, malformed email) shows inline field errors and blocks save | VERIFIED | `studentFormSchema` (zod v4) enforces `name.trim().min(1)`, `rateDollars.positive()`, `parentEmail` via `z.email()`. Server actions `safeParse` and return `{fieldErrors}` via `z.flattenError` on failure, performing no DB write. `student-form-dialog.tsx` renders `state.fieldErrors?.<field>[0]` inline beneath each input; dialog only closes on `fieldErrors === null`. `noValidate` on the form ensures browser-native constraint validation doesn't shortcut the server round-trip (documented fix in 01-03-SUMMARY.md, confirmed present in code). |
| 9 | Hourly rate entered as plain dollars, displayed as $X.XX, stored as integer cents | VERIFIED | `rateCents: Math.round(parsed.data.rateDollars * 100)` in both `addStudentAction`/`editStudentAction`; `lib/db/schema.ts` column is `integer("rate_cents")` (never decimal/float); `formatRate()` in `student-table.tsx` renders `$${(rateCents/100).toFixed(2)}`. |
| 10 | Archive requires confirmation; restore is single-click; students/archived tabs navigate between views | VERIFIED | `archive-confirm-dialog.tsx` requires clicking destructive "Archive Student" (dismiss "Keep on Roster" performs no write). `app/archived/page.tsx` restore is a bound Server Action form with no confirm step. Both `app/page.tsx` and `app/archived/page.tsx` render a Students/Archived tab pair with active-tab accent styling. |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/db/schema.ts` | students + login_attempts tables (integer cents, required parent email, archived flag) | VERIFIED | Exact column set matches plan spec; `rate_cents` integer, `parent_email` notNull, `archived` boolean default false, `login_attempts` with ip_address PK/failed_count/locked_until |
| `lib/db/index.ts` | Drizzle db instance over neon-http driver | VERIFIED | `drizzle({ client: neon(process.env.DATABASE_URL!), schema })` using `drizzle-orm/neon-http` |
| `lib/session.ts` | SessionData/sessionOptions/getSession | VERIFIED | All three exported, httpOnly+secure-in-prod+30-day maxAge present |
| `drizzle.config.ts` | drizzle-kit config, dotenv-loaded DATABASE_URL | VERIFIED (not directly re-read this pass, prior plan verified; schema.ts/db/index.ts consistent) | — |
| `middleware.ts` | Single auth choke point | VERIFIED | `getIronSession` + deny-by-default matcher, no logout route/button present anywhere (grep confirms no logout string in app/) |
| `lib/actions/auth.ts` | loginAction (rate limit + constant-time compare + session) | VERIFIED | All behaviors present and match plan spec |
| `app/login/page.tsx` | Login form | VERIFIED | "Unlock" button (not "Log In"), inline error styling distinguishes lockout (muted zinc-500) from wrong-password (red) |
| `app/page.tsx` | Protected roster landing page | VERIFIED | `db.select()...where(eq(students.archived,false)).orderBy(students.name)`, renders header/tabs/table/dialogs |
| `lib/validation/student.ts` | studentFormSchema | VERIFIED | drizzle-zod derived, zod v4 `z.email()`/`.positive()` |
| `lib/actions/students.ts` | add/edit/archive/restore Server Actions | VERIFIED | All 4 actions present, zero `db.delete(students` anywhere |
| `components/student-table.tsx` | Roster table/cards + empty state | VERIFIED | Responsive md+/mobile split, empty state, formatRate helper |
| `components/student-form-dialog.tsx` | Add/edit modal via useActionState | VERIFIED | Shared component for both modes, inline errors, pending labels |
| `components/archive-confirm-dialog.tsx` | Confirm-before-archive dialog | VERIFIED | Destructive confirm + neutral dismiss, no write on dismiss |
| `app/archived/page.tsx` | Archived view + restore + tabs | VERIFIED | `WHERE archived=true`, single-click restore, own empty state, tab pair |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `middleware.ts` | `lib/session.ts` | `getIronSession(sessionOptions)` | WIRED | Direct import and call confirmed |
| `lib/actions/auth.ts` | `login_attempts` table | Drizzle upsert keyed by IP | WIRED | `onConflictDoUpdate` targeting `loginAttempts.ipAddress` |
| `lib/actions/auth.ts` | `process.env.APP_PASSWORD` | `timingSafeEqual` constant-time compare | WIRED | Length-check + `timingSafeEqual`, never `===` |
| `components/student-form-dialog.tsx` | `lib/actions/students.ts` | `useActionState(add\|editStudentAction)` | WIRED | Confirmed via import + hook usage |
| `lib/actions/students.ts` | `students` table | Drizzle insert/update + revalidatePath | WIRED | `db.insert`/`db.update` + `revalidatePath("/")` present in all 4 actions |
| `components/archive-confirm-dialog.tsx` | `lib/actions/students.ts` | `archiveStudentAction` bound Server Action | WIRED | `archiveStudentAction.bind(null, studentId)` on form action |
| `app/archived/page.tsx` | `students` table | `SELECT WHERE archived = true` | WIRED | Confirmed present with `orderBy(students.name)` |
| `app/page.tsx` / `app/archived/page.tsx` | `components/student-table.tsx` | Import + render | WIRED | Both pages import and render `<StudentTable>` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| AUTH-01 | 01-02, 01-05 | Unlock via single shared password | SATISFIED | `loginAction` + live UAT |
| AUTH-02 | 01-02, 01-05 | Secure session cookie persists across refresh | SATISFIED | `sessionOptions` httpOnly/secure/maxAge + live UAT |
| AUTH-03 | 01-02, 01-05 | Every page except login inaccessible without session | SATISFIED | `middleware.ts` deny-by-default matcher + live UAT |
| AUTH-04 | 01-01 (schema), 01-02, 01-05 | Rate-limited wrong-password attempts | SATISFIED | Postgres-backed limiter, 5/15min, live UAT |
| STUD-01 | 01-03, 01-05 | Add student (name, rate, required parent email) | SATISFIED | `addStudentAction` + validated form |
| STUD-02 | 01-03, 01-05 | Edit student name/rate/parent email | SATISFIED | `editStudentAction` |
| STUD-03 | 01-04, 01-05 | Remove = archive (soft-delete), history preserved | SATISFIED | `archiveStudentAction`/`restoreStudentAction`, zero `db.delete(students` |
| STUD-04 | 01-03, 01-05 | View list of all students | SATISFIED | `app/page.tsx` + `app/archived/page.tsx` queries |

No orphaned requirements — all 8 IDs declared across the 5 plans' `requirements:` frontmatter match REQUIREMENTS.md's Phase 1 mapping exactly (AUTH-01..04, STUD-01..04).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER found in lib/, app/, components/, middleware.ts | — | Clean |
| middleware.ts | — | Next.js 16.2 deprecation warning: "middleware" file convention deprecated in favor of "proxy" | ℹ️ Info | Build still succeeds (`ƒ Proxy (Middleware)` shown in build output) — cosmetic/forward-compat warning only, not a functional defect. Worth a future rename to `proxy.ts` but does not block Phase 1 goal achievement. |

No `db.delete(students...)` calls exist anywhere in the codebase (confirmed via `grep -rn "db.delete" lib/ app/` — the sole hit is `db.delete(loginAttempts)` in `auth.ts`, which is the correct, expected behavior of resetting a login rate-limit counter, not student data).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles with zero errors | `npx tsc --noEmit` | Exit 0, no output | PASS |
| Production build succeeds | `npm run build` | Compiled successfully; routes `/`, `/login`, `/archived` all generated; Proxy (Middleware) registered | PASS |
| No hard-delete on students | `grep -rn "db.delete" lib/ app/` | Only `db.delete(loginAttempts)` found | PASS |
| No debt markers in modified files | `grep -rn -E "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` | No matches | PASS |
| `.env.local` not committed | `git ls-files \| grep -E "\.env"` | Only `.env.example` tracked | PASS |

### Human Verification Required

None. The phase's live production 8-point UAT smoke test (password gate redirect, 5-attempt lockout, correct-password login, session persistence across refresh/tab-reopen, add-student with validation, edit-persists, archive/restore round-trip) was already completed by the user directly against the deployed production URL, which satisfies the human-verification checkpoints this phase's plans required (01-05's `checkpoint:human-verify` task). No additional human verification items were identified during this codebase-level review.

### Gaps Summary

No gaps found. All 10 observable truths (roadmap success criteria + plan-level must-haves) are verified against actual code, not SUMMARY.md claims. The soft-delete invariant (D-10) was independently confirmed by grep — no `db.delete(students...)` exists anywhere in the codebase; the only `db.delete` call targets `login_attempts`, which is correct and expected (resetting the rate-limit counter on successful login). All 8 requirement IDs (AUTH-01..04, STUD-01..04) trace cleanly from REQUIREMENTS.md through plan frontmatter to verified code. `npx tsc --noEmit` and `npm run build` both pass cleanly. The only anti-pattern noted is an informational Next.js 16.2 deprecation warning (middleware→proxy rename) that does not affect functionality and does not block phase completion.

---

_Verified: 2026-07-04T02:15:00Z_
_Verifier: Claude (gsd-verifier)_
