---
phase: 01-foundation-auth-gate-student-roster
plan: 05
subsystem: infra
tags: [vercel, neon, deployment, nextjs16, production-verification]

# Dependency graph
requires:
  - phase: 01-01
    provides: Next.js 16 + Drizzle/Neon schema (students, login_attempts) local scaffold and .env.local convention
  - phase: 01-02
    provides: password gate, rate-limited login Server Action, middleware choke point
  - phase: 01-03
    provides: student roster CRUD (add/edit/view) via zod-validated Server Actions
  - phase: 01-04
    provides: archive/restore soft-delete flow, Students/Archived tabs
provides:
  - Live Vercel production deployment at https://invoice-tooling-lovat.vercel.app
  - Production environment variables (DATABASE_URL, APP_PASSWORD, SESSION_SECRET) configured in Vercel Production+Preview scope
  - End-to-end production verification of all 8 Phase 1 requirements (AUTH-01..04, STUD-01..04) against the live Neon DB
affects: [phase-02, phase-03]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified: []

key-decisions:
  - "No code changes were required for this plan — the app already built and linted cleanly from Plan 01-04's committed state, so Task 1 (production build gate) passed with zero diffs and nothing to commit."
  - "DATABASE_URL/APP_PASSWORD/SESSION_SECRET were added to Vercel in both Production AND Preview scope (not Production-only) so preview deployments from future PRs/branches also have a working DB connection and session secret, avoiding repeat build failures on preview URLs."

patterns-established: []

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04, STUD-01, STUD-02, STUD-03, STUD-04]

# Metrics
duration: ~20min
completed: 2026-07-04
---

# Phase 1 Plan 5: Deploy to Vercel + Production Verification Summary

**TutorInvoice is live at https://invoice-tooling-lovat.vercel.app on Vercel, backed by live Neon Postgres, with all 8 Phase 1 requirements (password gate, session persistence, rate limiting, student CRUD, archive/restore) confirmed working end-to-end in production.**

## Performance

- **Duration:** ~20 min, including one failed-then-fixed Vercel build
- **Started:** 2026-07-04 (immediately after Plan 01-04's metadata commit)
- **Completed:** 2026-07-04
- **Tasks:** 1 automated task + 2 human checkpoints (deploy, verify), all complete
- **Files modified:** 0 (no code changes required)

## Accomplishments
- `npm run build` and `npm run lint` verified clean locally (Task 1) — no fixes needed, tree already deployable from 01-04's final commit.
- Repo connected to Vercel (GitHub integration); Neon integration/env vars wired so `DATABASE_URL` is available in Production.
- First deploy attempt failed at build time: `neon()` (called at module import time in `lib/db/index.ts`) threw "No database connection string was provided to neon()" because `DATABASE_URL` was not yet set in the Vercel project when the first build ran.
- User added `DATABASE_URL`, `APP_PASSWORD`, `SESSION_SECRET` in Vercel (Production + Preview scope) and triggered a redeploy — build succeeded, deployment shows "Ready".
- Live production URL confirmed: **https://invoice-tooling-lovat.vercel.app**
- All 8 human-verify checks passed against the live URL and live Neon DB:
  1. AUTH-03 — unauthenticated visit to root redirects to `/login`.
  2. AUTH-04 — 5 wrong password attempts trigger the rate-limit message.
  3. AUTH-01 — correct password lands on the Students page.
  4. AUTH-02 — refresh and tab close/reopen preserve the session (no re-prompt).
  5. STUD-04/STUD-01 — empty roster shows "No students yet"; adding a student with name/rate/parent email succeeds and displays a `$X.XX` rate.
  6. STUD-01 validation — blank name, zero rate, and an invalid email are all blocked inline.
  7. STUD-02 — editing a student's rate persists across refresh.
  8. STUD-03 — Archive removes a student from the active roster; Restore from `/archived` returns them.

## Task Commits

This plan required no source-file changes, so there is no per-task feat/fix commit — Task 1's build/lint gate passed against the existing committed tree with zero diffs. The deploy and verification checkpoints are external Vercel dashboard/account actions with no local commit surface.

**Plan metadata:** (this commit) `docs(01-05): complete Vercel deploy + production verification plan`

## Files Created/Modified
None — no source files were created or modified by this plan. The only artifacts are external: the Vercel project/deployment and its Production+Preview environment variables (`DATABASE_URL`, `APP_PASSWORD`, `SESSION_SECRET`).

## Decisions Made
- Env vars were scoped to both Production and Preview in Vercel (not Production-only), so future preview deployments (e.g., PR branches in Phase 2/3) don't hit the same "no DATABASE_URL at build time" failure the first Production deploy did.
- No local code changes were made to work around the build-time `neon()` failure — it was resolved entirely by setting the correct Vercel env vars, which is the intended fix per the plan's design (env vars are user-side dashboard configuration, not application code).

## Deviations from Plan

### Auto-fixed Issues
None — no code changes were made or needed. This plan's only work was deployment configuration and live verification, both of which are outside the auto-fix rules' scope (they apply to code, not dashboard configuration).

### Notable Finding (not an auto-fix, documented for future robustness)

**Build-time dependency on `DATABASE_URL`**
- **Found during:** First Vercel deploy attempt (checkpoint: human-action)
- **Issue:** `lib/db/index.ts` calls `neon(process.env.DATABASE_URL!)` at module import time (top-level, not inside a function). When Vercel ran its first production build, `DATABASE_URL` had not yet been added to the project's environment variables, and the build failed immediately with "No database connection string was provided to neon()". This is a load-bearing module-level side effect: any route or Server Action that transitively imports `lib/db/index.ts` fails at build/collection time, not just at request time, if the env var is absent.
- **Resolution:** The user added `DATABASE_URL` (plus `APP_PASSWORD` and `SESSION_SECRET`) in Vercel's Environment Variables settings (Production + Preview scope) and redeployed. The second build succeeded and the deployment shows "Ready".
- **Why not auto-fixed:** This is a Vercel dashboard/account action (Rule 3's package-manager-install-style exclusion doesn't literally apply, but setting third-party account secrets is equally outside an autonomous agent's authority) — it required the user's own Vercel login and Neon connection string, which Claude cannot access or configure.
- **Candidate future hardening (not implemented, out of scope for this plan):** Lazy-initialize the Neon client (e.g., wrap `neon(...)` in a function or use a lazy singleton) so that importing `lib/db/index.ts` does not throw during Next.js's build-time route collection when `DATABASE_URL` is absent — the failure would then surface only at actual request time, which is arguably still not fully desirable but is more forgiving of build-environment ordering. Not implemented here because production is now working and the fix would be a structural change to `lib/db/index.ts` outside this plan's scope (deploy + verify only, no new features).

## Issues Encountered
- First Vercel build failed as described above; resolved by the user adding the three required Vercel environment variables (Production + Preview) and redeploying. No code changes were needed or made.

## User Setup Required
None remaining — the one external setup step this plan required (Vercel project creation, Neon integration/env var wiring, `APP_PASSWORD`/`SESSION_SECRET` in Vercel) is complete and verified working. Live URL: https://invoice-tooling-lovat.vercel.app

## Next Phase Readiness

Phase 1 is fully complete: all 8 requirements (AUTH-01..04, STUD-01..04) are implemented, committed, deployed to a live public Vercel URL, and verified end-to-end against the live Neon Postgres database by direct human testing on production (not just local dev). The Walking Skeleton goal — "tutor can securely reach a deployed, always-on app and build out her student roster" — is satisfied.

Ready for Phase 2 (Session Logging & Unbilled Dashboard), which builds directly on:
- The `students` table and archive/restore semantics (a session references a student; archived students still need their session history intact).
- The existing middleware auth choke point, which will protect all new Phase 2 routes with no additional wiring.
- The deployed pipeline itself — Phase 2/3 plans can now push directly to the same Vercel project and rely on the already-configured Production/Preview env vars.

No blockers carried forward. The lazy-init `neon()` hardening noted above is an optional future improvement, not a blocker — production is live and working today.

---
*Phase: 01-foundation-auth-gate-student-roster*
*Completed: 2026-07-04*

## Self-Check: PASSED

No new source files were created or modified by this plan (verified — no code changes were required). Referenced prior commit (01-04's metadata commit, the tree this plan's build gate ran against) verified present in git log: 90235d6. This SUMMARY file itself verified present at .planning/phases/01-foundation-auth-gate-student-roster/01-05-SUMMARY.md.
