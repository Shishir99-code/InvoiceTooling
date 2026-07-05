# Deferred Items — Phase 2

Out-of-scope discoveries logged during execution, not fixed per the executor's
scope boundary (pre-existing issues unrelated to the current task's changes).

## `middleware.ts` deprecation warning (Next.js 16)

- **Found during:** 02-01 Task 3 (`npm run build`)
- **Warning:** `The "middleware" file convention is deprecated. Please use "proxy" instead.`
- **Origin:** `middleware.ts`, added in Phase 1 Plan 02 (commit `2cb2103`), unrelated to this plan's route-group/nav changes.
- **Action:** Not fixed — out of scope for 02-01. Consider a dedicated rename to `proxy.ts` (with Next.js 16's new `Proxy` API) in a future hardening pass.
