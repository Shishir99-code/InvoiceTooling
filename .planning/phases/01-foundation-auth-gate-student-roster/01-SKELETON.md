# Walking Skeleton — TutorInvoice

**Phase:** 1
**Generated:** 2026-07-03

## Capability Proven End-to-End

A visitor to the deployed URL is redirected to `/login`, enters the single shared password, receives a secure HttpOnly session cookie, and lands on a protected `/` roster page that reads live student rows from the Neon Postgres database — and can add a student that persists across refresh. This exercises scaffold → middleware gate → Server Action (DB write to `login_attempts` + read) → protected Server Component (DB read of `students`) → interactive modal form (DB write of `students`) → deployed environment.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Next.js 16.2.x App Router + React 19.2.x + TypeScript | Locked in CLAUDE.md; single deployable that does UI + Server Actions (the "API") + middleware auth gate with no separate API server. |
| Data layer | Neon Postgres 17 + Drizzle ORM 0.45.x (`neon-http` driver) + drizzle-kit 0.31.x | Locked in CLAUDE.md; relational shape (student → sessions → invoices) fits Postgres; `neon-http` is correct for short-lived Vercel serverless functions; `drizzle-kit push` is the fastest path to a real DB read/write for Phase 1. Switch to `generate`/`migrate` in Phase 2 once schema stabilizes (RESEARCH Pitfall 1). |
| Money storage | Integer cents (`rate_cents` column), never floats | D-07 / SESS-05 — currency cannot be represented exactly as float; `Math.round(dollars * 100)` at the Server Action boundary. Established at `students.rate_cents` now so Phase 2 sessions inherit it. |
| Auth | Single shared password (`APP_PASSWORD` env) via `crypto.timingSafeEqual`; `iron-session` 8.0.x encrypted HttpOnly/Secure cookie; `middleware.ts` single choke point | D-01 / CLAUDE.md — no user table, no accounts; one shared secret protects a public URL. iron-session v8 single entry point works in middleware (edge-safe via `iron-webcrypto`). |
| Rate limiting | Postgres `login_attempts` table keyed by client IP (`@vercel/functions` `ipAddress()`) | AUTH-04 — in-memory counters do not survive serverless cold starts (RESEARCH Pitfall 3); Neon is already in the stack, so no new service (e.g. Upstash) is added. |
| Soft delete | `archived` boolean flag on `students`; never hard-delete | D-10 — history-preserving behavior Phases 2–3 require "just works"; accidental removals are recoverable via the archived view (D-11). |
| Validation | `zod` 4.4.x at every Server Action boundary, derived from the Drizzle table via `drizzle-zod` | D-13 / D-16 / RESEARCH V5 — never trust client-only validation; single schema is the source of truth. Uses zod v4 APIs (`z.email()`, `z.flattenError()`, `.issues`). |
| UI components | shadcn/ui (new-york style, neutral base) — `dialog`, `button`, `input`, `label`, `table` | UI-SPEC — copied into repo (no version-lock black box); Radix primitives give accessible modal (focus trap, Escape) for the D-14 add/edit dialog for free. |
| Deployment target | Vercel Hobby (free tier) + Neon integration, GitHub push → auto-deploy | CLAUDE.md — zero-ops; Neon installable from Vercel Storage tab so `DATABASE_URL` is wired automatically. |
| Directory layout | `app/` routes, `components/` (ui + feature), `lib/` (`db/`, `actions/`, `session.ts`), root `middleware.ts` | RESEARCH Recommended Project Structure — Server Actions grouped in `lib/actions/`, schema + db instance in `lib/db/`. |

## Stack Touched in Phase 1

- [x] Project scaffold (Next.js, Turbopack build, ESLint, TypeScript) — Plan 01
- [x] Routing — `/login`, `/`, `/archived` real routes — Plans 02, 03, 04
- [x] Database — real write (`login_attempts` upsert, `students` insert/update) AND real read (`students` SELECT, session check) — Plans 01–04
- [x] UI — interactive password form + add/edit modal wired to Server Actions — Plans 02, 03
- [x] Deployment — Vercel production deploy verified against a live URL; local full-stack run via `npm run dev` against Neon — Plan 05

## Out of Scope (Deferred to Later Slices)

- Session logging, hours tracking, autocomplete (Phase 2 — SESS-*, DASH-*)
- Invoice generation, immutable snapshots, email/mailto handoff (Phase 3 — INV-*, MAIL-*)
- Settings: Zelle handle + message template (Phase 3 — SET-*)
- Invoice history log (Phase 3 — HIST-*)
- Logout control (D-03 — deliberately none; her own devices, one shared secret)
- Password hashing/salting (no user table exists to protect; constant-time compare against env var only)
- Versioned SQL migrations (`drizzle-kit generate`/`migrate`) — Phase 1 uses `push`; switch when schema stabilizes in Phase 2
- Multi-user accounts / OAuth / NextAuth (explicitly rejected — D-01)

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- Phase 2: Tutor logs sessions against students (name autocomplete + date + hours) and sees per-student unbilled hours/amount on a dashboard. Reuses `students` table, the auth gate, the Server-Action-+-zod pattern, and integer-cents money math.
- Phase 3: Tutor sets Zelle handle + message template, generates an immutable invoice snapshot from unbilled sessions, opens a pre-filled `mailto:` draft (copy-to-clipboard fallback), and reviews invoice history.
