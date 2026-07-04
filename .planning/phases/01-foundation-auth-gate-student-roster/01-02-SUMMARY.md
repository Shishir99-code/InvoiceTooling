---
phase: 01-foundation-auth-gate-student-roster
plan: 02
subsystem: auth
tags: [nextjs, iron-session, drizzle, neon, server-actions, middleware, react19]

# Dependency graph
requires:
  - phase: 01-01
    provides: lib/session.ts (SessionData/sessionOptions/getSession), lib/db (schema + client), login_attempts + students tables live in Neon
provides:
  - loginAction Server Action (password gate + Postgres-backed rate limiter + session issuance)
  - app/login/page.tsx single-password login screen
  - middleware.ts single auth choke point (deny-by-default matcher)
  - app/page.tsx protected roster landing page reading live students from Neon
affects: [01-03, 01-04, 01-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Postgres-backed login_attempts rate limiter (5 attempts / 15-min lockout) keyed by ipAddress(), not in-memory state"
    - "crypto.timingSafeEqual constant-time password compare (never ===)"
    - "getIronSession(cookies(), sessionOptions) in middleware.ts as the single deny-by-default auth choke point, matcher excludes only /login + static assets"
    - "session.save() on every valid middleware request for rolling ~30-day TTL renewal"
    - "@vercel/functions ipAddress() must be called as ipAddress({ headers: hdrs }) in Server Actions on Next 16 — wrapping works around a HeadersAdapter Proxy `has`-trap bug (see Deviations)"

key-files:
  created: [lib/actions/auth.ts, app/login/page.tsx, middleware.ts]
  modified: [app/page.tsx]

key-decisions:
  - "Fixed a real Next.js 16 / @vercel/functions incompatibility discovered via live end-to-end testing: next/headers' headers() returns a HeadersAdapter Proxy whose `has` trap answers true for \"headers\" in hdrs, which routes ipAddress() down the wrong branch and throws `headers.get is not a function`. Fix: call ipAddress({ headers: hdrs }) instead of ipAddress(hdrs)."
  - "Kept the Task 2 roster render as a plain semantic list (not the shadcn Table component) — the plan explicitly scopes this to proving the protected DB read renders; the interactive table + add/edit modal are Plan 03's job."

patterns-established:
  - "Pattern: Server Action rate-limiter reads the lockout row BEFORE touching the password at all (fail fast on lockout, avoid unnecessary timingSafeEqual work)"
  - "Pattern: middleware.ts session.save()-on-every-valid-request for rolling TTL renewal (D-02), confirmed working end-to-end against a live dev server (not just code-reviewed)"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04]

# Metrics
duration: ~25min
completed: 2026-07-04
---

# Phase 1 Plan 2: Auth Gate — Login, Rate Limiter, Middleware, Protected Roster Summary

**Single-shared-password gate (iron-session + Postgres-backed rate limiter) end-to-end: unauthenticated visitors are redirected to `/login`, wrong passwords are rate-limited at 5 attempts/15 min, correct passwords set a 30-day rolling session cookie, and `/` renders live students from Neon**

## Performance

- **Duration:** ~25 min active execution across 2 tasks (including live dev-server verification and a real bug found/fixed mid-flight)
- **Started:** 2026-07-04T00:05:00Z (approx)
- **Completed:** 2026-07-04T00:22:00Z
- **Tasks:** 2/2 completed
- **Files modified:** 4 (3 created, 1 rewritten)

## Accomplishments
- `loginAction` Server Action: checks the `login_attempts` lockout row first (AUTH-04 priority), compares the password with `crypto.timingSafeEqual` (never `===`), rate-limits at 5 failures / 15-min cooldown via a Postgres upsert, resets the counter and issues an `iron-session` cookie on success
- `/login` page: single "Password" input + "Unlock" CTA (not "Log In"/"Sign In" per D-01), inline errors — destructive red for "Incorrect password.", muted zinc-500 for the lockout message (D-05/UI-SPEC color exception)
- `middleware.ts`: single deny-by-default auth choke point (AUTH-03) — redirects to `/login` when no valid session, renews the ~30-day rolling TTL via `session.save()` on every authenticated request (D-02); matcher excludes only `/login` and static assets; no logout control exists (D-03)
- `/` (roster): protected Server Component reading `students WHERE archived = false ORDER BY name` (D-08), rendering rows or the "No students yet" empty state (D-15)
- Verified the entire flow against a live `next dev` server (not just code review): unauthenticated redirect, wrong-password error, 5th-attempt lockout, correct-password session issuance + cookie flags, session persistence across refresh

## Task Commits

Each task was committed atomically:

1. **Task 1: loginAction Server Action + rate limiter + /login page** - `87c1365` (feat)
2. **Task 2: middleware auth choke point + protected roster landing page** - `2cb2103` (feat)

Additional fix commit (Rule 1 — bug found during Task 2's live end-to-end verification, in Task 1's file):
- **Fix: wrap headers() before passing to ipAddress()** - `d540657` (fix)

**Plan metadata:** (this commit) `docs(01-02): complete auth gate plan`

## Files Created/Modified
- `lib/actions/auth.ts` - `loginAction` Server Action: lockout check → constant-time password compare → rate-limit upsert or session issuance
- `app/login/page.tsx` - client component, `useActionState(loginAction, ...)`, "Unlock" CTA, inline error display with the D-05 muted-neutral lockout exception
- `middleware.ts` - root auth choke point, `getIronSession` + deny-by-default matcher, rolling `session.save()`
- `app/page.tsx` - rewritten from the `create-next-app` default template into the protected roster Server Component

## Decisions Made
- **ipAddress() wrapping fix (Rule 1 bug):** Discovered only by actually running the login flow against a live dev server — `next/headers`'s `headers()` return value on Next.js 16.2.10 is a `HeadersAdapter` Proxy whose `has` trap returns `true` for essentially any property name, including `"headers"`. `@vercel/functions`'s `ipAddress(input)` uses `"headers" in input` to decide whether `input` is a `Request` (access `.headers`) or already a `Headers`-like object (call `.get()` directly). Against the bare adapter this always takes the `Request` branch, reads `input.headers` (`undefined`), and throws. Fix: call `ipAddress({ headers: hdrs })` — a plain object literal doesn't have the same `has`-trap behavior, so it correctly routes to the real adapter's `.get()`. This is a from-scratch finding not covered by RESEARCH.md's Assumption A2 (which flagged IP-extraction *values* as risky, not this specific runtime-compatibility crash) — worth carrying forward to any future Server Action that calls `ipAddress()`.
- **Minimal roster render (not the shadcn Table):** Per the plan's explicit scope note, Task 2 only needs to prove the protected DB read renders; a plain semantic list keeps this plan's diff small and defers the interactive table/columns/actions to Plan 03 where the full CRUD UI is built.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `ipAddress()` threw `TypeError: headers.get is not a function` on every login attempt**
- **Found during:** Task 2 — live end-to-end verification of the login flow against a running dev server (submitting a real wrong-password form POST)
- **Issue:** `ipAddress(hdrs)` (bare `next/headers` `headers()` result) crashed inside `@vercel/functions` because Next 16's `HeadersAdapter` Proxy's `has` trap answers `true` for `"headers" in hdrs`, sending `ipAddress()` down the wrong internal branch
- **Fix:** Changed the call to `ipAddress({ headers: hdrs })`, wrapping the adapter in a plain `Request`-shaped object so `ipAddress()` reads `.headers` (the real adapter, which does have a working `.get()`) instead of `undefined`
- **Files modified:** `lib/actions/auth.ts`
- **Verification:** Re-ran the full login flow against a live dev server after the fix — wrong password now correctly returns `{ error: "Incorrect password." }` with no server error, 5 failures trip the lockout message, and a direct Postgres query confirms `login_attempts` rows are written/reset correctly
- **Committed in:** `d540657` (standalone fix commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** The fix was necessary for `loginAction` to function at all in this Next.js version; no scope creep, no architectural change. This is exactly the kind of runtime incompatibility that code review alone would not have caught — found only because the plan's live-verification step (spinning up `next dev` and submitting a real form POST) was carried out before committing Task 2.

## Issues Encountered
None beyond the one auto-fixed bug documented above.

## User Setup Required
None - no external service configuration required. `.env.local` (DATABASE_URL, APP_PASSWORD, SESSION_SECRET) was already populated in Plan 01-01.

## Next Phase Readiness

Verified end-to-end against a live `next dev` server (not just `tsc`/grep):
- `npx tsc --noEmit` exits 0
- Unauthenticated `GET /` → `307` redirect to `/login`
- Wrong password → `{ error: "Incorrect password." }`, `login_attempts.failed_count` increments in Neon
- 5th consecutive wrong attempt → `{ error: "Too many attempts — try again in a few minutes." }`, `locked_until` set ~15 min ahead in Neon
- Correct password → `Set-Cookie: tutorinvoice_session=...; HttpOnly; SameSite=lax; Max-Age=2592000` + `303` redirect to `/`; `login_attempts` row deleted
- `GET /` with the session cookie → `200`, renders "Students" header + "No students yet" empty state (students table is empty pre-Plan-03), cookie renewed on every request (rolling TTL)
- Session persists across two sequential refreshes with the same cookie
- No logout route/control exists anywhere in the app (D-03)

Ready for 01-03 (Student CRUD: add/edit/list via Server Actions + shadcn Dialog) — the protected `/` roster page this plan built is exactly where that plan's interactive table and "Add Student" modal will attach.

---
*Phase: 01-foundation-auth-gate-student-roster*
*Completed: 2026-07-04*

## Self-Check: PASSED

All created files verified present: lib/actions/auth.ts, app/login/page.tsx, middleware.ts, app/page.tsx (rewritten).
All referenced commits verified present in git log: 87c1365, d540657, 2cb2103.
