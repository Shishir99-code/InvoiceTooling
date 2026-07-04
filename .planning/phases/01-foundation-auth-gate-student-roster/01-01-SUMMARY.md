---
phase: 01-foundation-auth-gate-student-roster
plan: 01
subsystem: database
tags: [nextjs, react, typescript, drizzle, neon, postgres, iron-session, tailwind, shadcn]

# Dependency graph
requires: []
provides:
  - Next.js 16 App Router project scaffolded with locked stack versions
  - shadcn/ui components (dialog, button, input, label, table) installed
  - lib/db/schema.ts with students + login_attempts tables
  - lib/db/index.ts Drizzle instance over neon-http driver
  - lib/session.ts iron-session helper (SessionData, sessionOptions, getSession)
  - drizzle.config.ts wired to .env.local
  - Live Neon Postgres database with students + login_attempts tables applied via drizzle-kit push
affects: [01-02, 01-03, 01-04, 01-05]

# Tech tracking
tech-stack:
  added: [next@16.2.x, react@19.2.x, drizzle-orm@0.45.2, drizzle-kit@0.31.10, "@neondatabase/serverless@1.1.0", zod@4.4.3, iron-session@8.0.4, date-fns@4.4.0, drizzle-zod@0.8.3, "@vercel/functions@3.7.5", dotenv, tailwindcss@4.3.x, shadcn/ui]
  patterns:
    - "Integer-cents money columns (rate_cents) — never float/decimal"
    - "Soft-delete via archived boolean flag, not row deletion"
    - "drizzle-kit push (not generate/migrate) for Phase 1 schema application"
    - "neon-http driver (not websocket/pooled) for Vercel serverless compatibility"
    - "Explicit dotenv.config({ path: '.env.local' }) in drizzle.config.ts (dotenv/config default only reads .env)"

key-files:
  created: [lib/db/schema.ts, lib/db/index.ts, lib/session.ts, drizzle.config.ts, .env.example, components/ui/dialog.tsx, components/ui/button.tsx, components/ui/input.tsx, components/ui/label.tsx, components/ui/table.tsx]
  modified: [package.json, tsconfig.json, app/layout.tsx, app/globals.css, .gitignore]

key-decisions:
  - "Used shadcn preset 'nova' (Lucide/Geist, neutral base) instead of UI-SPEC's literal 'new-york' — shadcn CLI replaced named style with preset system; substantive requirement (accessible, unstyled-black-box-free components) met"
  - "Did not mark STUD-01..04/AUTH-04 complete in REQUIREMENTS.md despite being listed in this plan's frontmatter — only DB schema exists, not the actual login/CRUD UI (delivered in 01-02/01-03/01-04); marking complete now would be a false positive"
  - "Fixed drizzle.config.ts to explicitly load .env.local via dotenv.config({ path: '.env.local' }) since dotenv/config's default only reads .env, not Next.js's .env.local convention"

patterns-established:
  - "Pattern: Server-Action-ready file structure (lib/db, lib/session) established for all later CRUD slices"
  - "Pattern: dotenv .env.local loading for any future CLI script/tool that needs DATABASE_URL outside Next.js runtime"

requirements-completed: []  # See Decisions Made — schema/tables exist but STUD-01..04/AUTH-04 functional requirements are delivered in 01-02/01-03/01-04, not marked complete here

# Metrics
duration: ~6min active execution (Tasks 1-3), spanning a human-action checkpoint pause for Neon DB provisioning
completed: 2026-07-04
---

# Phase 1 Plan 1: Foundation Scaffold + Live Neon Schema Summary

**Next.js 16 App Router project on the locked stack (Drizzle+Neon via neon-http, iron-session, shadcn/ui), with `students` and `login_attempts` tables live in Neon via `drizzle-kit push`**

## Performance

- **Duration:** ~6 min active execution across 3 tasks (Tasks 1-2: ~1 min; checkpoint pause for Neon DB provisioning; Task 3: ~5 min)
- **Started:** 2026-07-03T19:23:09Z
- **Completed:** 2026-07-04T00:09:50Z
- **Tasks:** 3/3 completed
- **Files modified:** 31 (create-next-app scaffold + shadcn components + db/session/config files)

## Accomplishments
- Scaffolded Next.js 16 App Router project with all locked stack dependencies at pinned versions
- Installed shadcn/ui (dialog, button, input, label, table) on the "nova" preset (neutral base, CSS variables)
- Defined `students` (integer-cents rate, required parent email, archived soft-delete flag) and `login_attempts` (AUTH-04 rate-limit foundation) tables in `lib/db/schema.ts`
- Wired Drizzle to Neon via the `neon-http` driver (Vercel-serverless-correct, not the websocket/pooled driver)
- Configured `iron-session` helper (`SessionData`, `sessionOptions` with httpOnly/secure-in-prod/30-day maxAge, `getSession()`)
- Applied the schema to a live Neon Postgres database with `drizzle-kit push` — verified both tables exist with the exact expected columns

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold Next.js project + install locked stack + shadcn/ui** - `0c44444` (feat)
2. **Task 2: Wire Drizzle + Neon, define schema, and configure iron-session** - `9befead` (feat)
3. **Task 3: Push schema to the live Neon database** - blocking fix `7b9d84c` (fix) + `drizzle-kit push` exit 0 (no additional file commit — push has no local artifact to commit)

**Plan metadata:** (this commit) `docs(01-01): complete foundation scaffold plan`

## Files Created/Modified
- `lib/db/schema.ts` - `students` (id, name, rate_cents, parent_email, archived, created_at) + `login_attempts` (ip_address, failed_count, locked_until) Drizzle table definitions
- `lib/db/index.ts` - Drizzle `db` instance over `neon-http` driver, reading `DATABASE_URL`
- `lib/session.ts` - `SessionData`, `sessionOptions` (httpOnly, secure-in-production, sameSite lax, 30-day maxAge), `getSession()` iron-session helper
- `drizzle.config.ts` - drizzle-kit config pointing at `lib/db/schema.ts`, explicitly loading `.env.local`
- `.env.example` - documents `DATABASE_URL`, `APP_PASSWORD`, `SESSION_SECRET` (names only, no values)
- `components/ui/{dialog,button,input,label,table}.tsx` - shadcn/ui components (nova preset)
- `package.json` - locked stack dependencies (next@16.2.x, drizzle-orm@0.45.2, drizzle-kit@0.31.10, etc.)
- `.gitignore` - `.env*` ignored with `!.env.example` negation so the template stays tracked

## Decisions Made
- **shadcn preset substitution:** UI-SPEC specified style "new-york"; the shadcn CLI has moved to a named-preset system and "new-york" is no longer a selectable style key. Used preset "nova" (Lucide icons, Geist font, neutral base color) instead — the substantive requirement (accessible, ownable, non-black-box components) is met.
- **`.gitignore` negation for `.env.example`:** create-next-app's default `.gitignore` uses `.env*`, which also excluded the tracked template file. Added `!.env.example` so the documented-names-only template stays in git while `.env.local` (real secrets) stays ignored.
- **Deferred REQUIREMENTS.md completion marking:** This plan's frontmatter lists `[STUD-01, STUD-02, STUD-03, STUD-04, AUTH-04]`, but plans 01-02 (AUTH-04's actual login/rate-limit logic), 01-03 (STUD-01/02/04's CRUD UI), and 01-04 (STUD-03's archive flow) are where these requirements are functionally delivered. Marking them "Complete" in REQUIREMENTS.md now — when only the DB schema exists — would be a false positive in traceability. Left unmarked; will be marked complete in the plans that actually implement the user-facing behavior.
- **`drizzle.config.ts` env loading:** Switched from `import "dotenv/config"` (which only auto-loads `.env`) to explicit `dotenv.config({ path: ".env.local" })`, matching Next.js's `.env.local` convention used by the rest of the app.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] create-next-app rejected "." as scaffold target**
- **Found during:** Task 1
- **Issue:** `npx create-next-app@latest .` refused to scaffold directly into a directory whose name is capitalized/contains characters it flags, and the directory already contained `CLAUDE.md` and `.planning/`.
- **Fix:** Scaffolded into a temporary subdirectory, then moved all generated files up into the project root, preserving the existing `CLAUDE.md` and `.planning/` untouched.
- **Files modified:** All scaffold files (package.json, tsconfig.json, app/, etc.)
- **Verification:** `CLAUDE.md` and `.planning/` unchanged; `npx tsc --noEmit` passes on the merged tree.
- **Committed in:** `0c44444` (Task 1 commit)

**2. [Rule 3 - Blocking] shadcn CLI style-preset mismatch**
- **Found during:** Task 1
- **Issue:** UI-SPEC called for shadcn style "new-york", but the current shadcn CLI has replaced discrete style names with a preset system; "new-york" is not a valid init option.
- **Fix:** Used preset "nova" (Lucide/Geist, neutral base color, CSS variables enabled) — closest match satisfying the substantive UI-SPEC requirement (accessible components, neutral palette, CSS-variable theming).
- **Files modified:** components.json, components/ui/*.tsx, app/globals.css
- **Verification:** All 5 required components (dialog, button, input, label, table) present and compile.
- **Committed in:** `0c44444` (Task 1 commit)

**3. [Rule 3 - Blocking] .env.example accidentally gitignored**
- **Found during:** Task 2
- **Issue:** create-next-app's default `.gitignore` pattern `.env*` also matched `.env.example`, which is meant to be a tracked template.
- **Fix:** Added `!.env.example` negation line immediately after `.env*` in `.gitignore`.
- **Files modified:** `.gitignore`
- **Verification:** `git check-ignore -v .env.example` returns no match; `git check-ignore -v .env.local` still correctly ignores.
- **Committed in:** `9befead` (Task 2 commit)

**4. [Rule 3 - Blocking] drizzle-kit push failed — DATABASE_URL not injected**
- **Found during:** Task 3
- **Issue:** `drizzle.config.ts` used `import "dotenv/config"`, which by default only reads a file literally named `.env`. The project's real secrets live in `.env.local` (Next.js convention), so `process.env.DATABASE_URL` was `undefined` at drizzle-kit runtime, producing `Error: Either connection "url" or "host", "database" are required for PostgreSQL database connection`.
- **Fix:** Replaced with `import { config } from "dotenv"; config({ path: ".env.local" });` at the top of `drizzle.config.ts`.
- **Files modified:** `drizzle.config.ts`
- **Verification:** `npx drizzle-kit push` now prints `injected env (3) from .env.local` and completes with exit 0; a second run reports `No changes detected`, confirming the schema is already applied and stable.
- **Committed in:** `7b9d84c` (standalone fix commit, Task 3)

---

**Total deviations:** 4 auto-fixed (all Rule 3 - blocking)
**Impact on plan:** All four fixes were necessary to complete scaffolding and get the live push working; no scope creep, no architectural changes.

## Issues Encountered
None beyond the four blocking fixes documented above.

## User Setup Required

Already completed by the user before this continuation began: Neon Postgres database created and `.env.local` populated with `DATABASE_URL`, `APP_PASSWORD`, and `SESSION_SECRET`. No further external service configuration required for this plan.

## Next Phase Readiness

- Live Neon database with `students` and `login_attempts` tables confirmed via direct `information_schema.columns` query (id/name/rate_cents/parent_email/archived/created_at and ip_address/failed_count/locked_until respectively).
- `npx tsc --noEmit` exits 0; project compiles cleanly.
- shadcn components (dialog, button, input, label, table) present under `components/ui/`.
- `.env.local` confirmed gitignored (`git check-ignore -v .env.local` matches `.gitignore:34`).
- Ready for 01-02 (auth gate slice: login Server Action + rate limiter + middleware + protected roster read) — `lib/session.ts` and the `login_attempts` table are the direct dependencies that plan needs.

---
*Phase: 01-foundation-auth-gate-student-roster*
*Completed: 2026-07-04*

## Self-Check: PASSED

All created files verified present: lib/db/schema.ts, lib/db/index.ts, lib/session.ts, drizzle.config.ts, .env.example, components/ui/{dialog,button,input,label,table}.tsx, and this SUMMARY.md.
All referenced commits verified present in git log: 0c44444, 9befead, 7b9d84c.
Live Neon tables verified via direct `information_schema.columns` query (see Next Phase Readiness).
</content>
