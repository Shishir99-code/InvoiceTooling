# Project Research Summary

**Project:** TutorInvoice (single-user tutoring time-tracking + invoicing web app)
**Domain:** Small single-user hosted CRUD + invoicing web app (Excel replacement, no multi-user auth, no payments, no in-app email sending)
**Researched:** 2026-07-03
**Confidence:** HIGH

## Executive Summary

This is a small single-tenant CRUD application with one interesting design problem: the billed/unbilled session lifecycle and the requirement that generated invoices remain immutable point-in-time snapshots even as underlying session data stays editable. Everything else — student management, session logging, a shared-password gate, and email handoff via `mailto:` — is standard small-app territory with well-established patterns. Research across stack, features, architecture, and pitfalls converges on the same shape: one Next.js 16 (App Router) deployable on Vercel, one Postgres database (Neon) via Drizzle ORM, a single shared-password session-cookie gate (no user table, no NextAuth), and a client-side `mailto:` draft handoff (no email service) — deliberately rejecting the broader "invoicing SaaS" feature set (multi-user accounts, payment processing, PDF invoices, automated reminders, client portals) as anti-features for a one-person, one-password tool.

The recommended approach is to build in strict dependency order — auth gate and schema first, then students, settings, and sessions, then the dashboard, then invoice generation as a single atomic transaction, then invoice history and the email draft builder last. The single highest-risk design decision is invoice snapshotting: invoices must freeze session line items, computed amounts, and rendered text at generation time (using integer-cents money math, never floats), because sessions remain editable afterward and a live-query invoice would silently corrupt historical records shown to parents. Secondary risks are well-documented and cheap to mitigate proactively: mailto body-length limits (compact templates + a copy-to-clipboard fallback), insecure shared-password handling (rate limiting + secure cookie flags), and hosted-DB data loss (a scheduled backup/export job on the free tier, which does not include backups by default).

Confidence is high across all four research areas because this domain is a well-trodden "small business CRUD tool" pattern with directly-applicable, cross-corroborated sources (official framework docs, live npm registry data, and consistent billing-system conventions), combined with an unusually explicit PROJECT.md that already resolved most scope ambiguity (table stakes vs. anti-features). The main gaps are provider-specific details (exact Neon backup policy at the free tier, CVE-2025-29927 patch verification) that should be double-checked against live docs during implementation rather than treated as settled.

## Key Findings

### Recommended Stack

Next.js 16.2.x (App Router, Turbopack stable) on Vercel Hobby is the core recommendation: one deployable handling UI, routing, and Server Actions as the API layer, with zero-config GitHub-push deploys. PostgreSQL via Neon (Vercel's official Postgres integration) fits the inherently relational data model (student → sessions → invoice snapshot). Drizzle ORM + drizzle-kit gives type-safe schema/queries/migrations without a codegen step. Tailwind CSS 4 + shadcn/ui (CLI-installed, not an npm dependency) accelerates building the forms-and-tables UI. `iron-session` provides the encrypted session cookie for the password gate — explicitly not NextAuth/Auth.js/Clerk, which are built for multi-user account systems this app doesn't have. No email-service SDK, no payment SDK, no PDF library — all explicitly out of scope per STACK.md's "What NOT to Use" section.

**Core technologies:**
- Next.js 16.2.x (App Router) — full-stack framework; Server Actions eliminate hand-written REST endpoints for CRUD
- PostgreSQL via Neon — relational fit for student→session→invoice data; free tier covers one tutor's data for years
- Drizzle ORM 0.45.x — type-safe, SQL-shaped queries with no separate codegen binary
- Tailwind CSS 4 + shadcn/ui — fast, ownable component build for tables/forms/dashboard UI
- `iron-session` — encrypted session cookie for the single shared-password gate (no user table)

### Expected Features

The full "table stakes" list is required — this is not a subset-selection exercise, because a partial replacement means the tutor keeps using the spreadsheet anyway. Feature dependencies force a build order: Student Management must exist before Session Logging (autocomplete), Session Logging + Settings must exist before Invoice Generation, and Invoice Generation must exist before Invoice History and Email Handoff.

**Must have (table stakes):**
- Shared-password gate
- Student management (CRUD: name, hourly rate, optional parent email)
- Session logging (CRUD with student autocomplete)
- Unbilled-hours dashboard (per-student unbilled hours + amount owed)
- Invoice generation (text summary from unbilled sessions)
- Auto-mark-billed + immutable snapshot on invoice generation
- Email handoff (`mailto:` draft, pre-filled)
- Settings (Zelle handle + editable message template)
- Invoice history (read-only log of past invoices)

**Should have (v1.x, post-validation):**
- Recurring sessions (standing weekly students)
- Reporting / income-over-time

**Defer (v2+, explicit anti-features for v1):**
- PDF invoices, app-sent email (conflicts with mailto architecture), tax summaries, multi-user accounts, payment/Zelle API integration, live start/stop timers, automated payment reminders, client-facing portal, branding, multi-currency

### Architecture Approach

A small monolith: one deployable, one database, no service split. The interesting design work is entirely in the billed/unbilled lifecycle — `sessions.invoiceId` (nullable) is the single source of truth for "billed" status (no redundant boolean), session amounts are always derived live (`hours × student.currentRate`, never stored), and invoice generation is a single atomic transaction that snapshots line items + rendered text + total onto the `Invoice` row while flipping the relevant sessions' `invoiceId`. This freeze-at-generation pattern is the load-bearing design decision of the entire app.

**Major components:**
1. Auth Gate — password-vs-env-var check, signed/encrypted session cookie, single middleware chokepoint protecting all routes except `/login`
2. Data Layer — Student, Session, Invoice (JSON line-items snapshot), Settings (singleton row) schema + Drizzle migrations
3. Invoice Generation module (`lib/invoices/`) — the only code path allowed to create the unbilled→billed transition; one DB transaction, never split into separate "create" and "mark billed" steps
4. Email Draft Builder (`lib/email/`) — pure function, no network/IO, turns a frozen invoice + settings into a `mailto:` URI

### Critical Pitfalls

1. **Floating-point money math corrupts totals** — store rate in integer cents, round once at computation, never re-derive totals from floats at render time; fix in the schema phase before any billing logic exists.
2. **Editing a billed session silently corrupts a past invoice** — invoices must snapshot line items + rendered text at generation time, not re-read live session rows; this is the single highest-risk design decision and must be settled before "edit session" and "generate invoice" are both built.
3. **mailto: draft silently fails or truncates for real invoices** — keep bodies compact, always `encodeURIComponent`, and ship a "copy invoice text" fallback from day one since mailto failures are silent with no error shown to the user.
4. **Shared password done insecurely** — hash the password, rate-limit login attempts (5 attempts / 15 min lockout), use signed `HttpOnly`/`Secure`/`SameSite` cookies; this is a real business's PII/financial data behind one gate, not a toy risk.
5. **Cheap hosted DB with no backup strategy** — free/hobby Postgres tiers often exclude backups by default; add a scheduled export (e.g. daily `pg_dump`) before real student/invoice data accumulates, and test restores.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation — Auth Gate + Data Layer
**Rationale:** Nothing else is reachable or buildable without the auth gate and schema; getting the schema right early (nullable `invoiceId` on Session, JSON `lineItems` on Invoice, integer-cents money fields) avoids painful migrations mid-project.
**Delivers:** Deployed Next.js app on Vercel with Neon Postgres connected, `/login` gate with rate-limited, secure-cookie session handling, Drizzle schema + migrations for Student, Session, Invoice, Settings.
**Addresses:** Shared-password gate (table stakes)
**Avoids:** Pitfall 5 (insecure shared password), Pitfall 1 (float money math — schema uses integer cents/DECIMAL from the start)

### Phase 2: Core Entities — Students, Settings, Sessions
**Rationale:** Student Management is the root entity everything else scopes to; Settings must exist before Invoice Generation can render real text; Sessions depend on Students for autocomplete. Building these together keeps the vertical slice demoable.
**Delivers:** Student CRUD (with duplicate-name disambiguation), Settings CRUD (Zelle handle + message template with placeholders), Session CRUD (student-ID-based autocomplete, live-derived amounts, editable regardless of billed status)
**Addresses:** Student management, session logging, settings (table stakes)
**Avoids:** Pitfall 7 (ambiguous duplicate student names — disambiguate in autocomplete, reference by ID not name)

### Phase 3: Dashboard
**Rationale:** First payoff moment once Sessions exist — the "who owes what" view is a pure read/aggregation layer over Students + Sessions, no new entity or write path.
**Delivers:** Unbilled-hours dashboard (per-student unbilled hours + amount owed), indexed query on `sessions(studentId, invoiceId)`.
**Addresses:** Unbilled-hours dashboard (table stakes)

### Phase 4: Invoice Generation
**Rationale:** The pivot/highest-risk feature — depends on Students, Sessions, and Settings all being real and stable. Must be implemented as one atomic transaction from day one, not split into "create invoice" + "mark billed" as separate steps.
**Delivers:** Invoice generation flow (select student → preview line items/total → confirm), atomic transaction that snapshots line items + rendered text + total and flips sessions' `invoiceId`.
**Addresses:** Invoice generation, auto-mark-billed + snapshot (table stakes)
**Avoids:** Pitfall 2 (billed session edit corrupting a past invoice) — this is THE pitfall this phase exists to prevent; verify via explicit test (edit a billed session's hours, confirm the invoice's stored total is unchanged on reopen).

### Phase 5: Invoice History + Email Handoff
**Rationale:** Natural last pair — History is a read-only view of what Phase 4 produces, and the Email Draft Builder is a small pure function consuming a generated invoice; both need real invoice data to be meaningfully built/tested.
**Delivers:** Invoice history list/detail (read-only snapshots), `mailto:` draft builder with URL-encoding, compact templates, and a "copy invoice text" fallback; missing-parent-email UI guard on the send button.
**Addresses:** Invoice history, email handoff (table stakes)
**Avoids:** Pitfall 3 (mailto truncation/silent failure), Pitfall 4 (mailto with missing/malformed recipient)

### Phase 6: Deployment Hardening (can run parallel to Phase 5 or as a closing phase)
**Rationale:** Backup strategy and production hardening should be resolved before real student/session data accumulates, not retrofitted after a data-loss incident.
**Delivers:** Verified Neon backup policy (or a scheduled `pg_dump`-equivalent export job), confirmed HTTPS enforcement, verified Next.js patch status against CVE-2025-29927.
**Avoids:** Pitfall 6 (hosted DB with no backup strategy)

### Phase Ordering Rationale

- Strict dependency order drives phases 1-5: Auth/Schema → Students/Settings/Sessions → Dashboard → Invoice Generation → History/Email. This mirrors FEATURES.md's explicit dependency graph (Session Logging requires Student Management; Invoice Generation requires Session Logging + Settings; Invoice History + Email Handoff require Invoice Generation).
- Settings is deliberately grouped with Phase 2 (not deferred until just before Invoice Generation) so the message-template placeholder design is settled before Invoice Generation depends on it — avoids building invoice generation against hardcoded placeholder text that has to be ripped out later.
- Invoice Generation is isolated as its own phase (Phase 4) because it is architecture's single highest-risk transaction (snapshot + atomic billed-transition) and pitfalls research independently confirms it as the highest-risk design decision in the app — deserves focused implementation and verification rather than being bundled with adjacent CRUD work.
- Deployment hardening (backups, rate limiting verification, HTTPS) is called out as its own phase rather than an afterthought, directly responding to Pitfall 5 and Pitfall 6's warning that these are commonly under-invested "it's just a single password/free DB tier" shortcuts that carry real risk once the app is live on a public URL with real business data.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4 (Invoice Generation):** The atomic snapshot transaction and money-math (integer cents) implementation details are well-documented in principle but worth a focused research pass to confirm the exact Drizzle transaction API and JSON column patterns for the chosen ORM version.
- **Phase 6 (Deployment Hardening):** Neon's exact free-tier backup policy needs live verification against current docs (research flagged this as MEDIUM confidence, provider terms change frequently) before finalizing the backup approach.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Auth + Schema):** Shared-password-gate-via-iron-session and Drizzle schema/migration patterns are well-established and directly documented in STACK.md and ARCHITECTURE.md.
- **Phase 2 (Students/Settings/Sessions) and Phase 3 (Dashboard):** Standard CRUD + aggregation-query patterns, no novel research needed.
- **Phase 5 (History/Email):** mailto encoding and length-limit mitigation patterns are already fully specified in STACK.md and PITFALLS.md with concrete implementation guidance.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified via Context7 library docs, live npm registry version checks, and official Next.js/Neon/Tailwind docs |
| Features | HIGH (table stakes/anti-features) / MEDIUM (differentiator framing) | Table stakes and anti-features are directly specified in PROJECT.md; differentiator prioritization is informed by a market scan (medium confidence, inferred) |
| Architecture | HIGH | Component/data-model design is a standard small-business-app pattern, cross-checked against invoice-snapshot industry conventions and derived directly from PROJECT.md's stated constraints |
| Pitfalls | MEDIUM-HIGH | Money/rounding, mailto limits, and auth rate-limiting are well-documented and cross-verified across multiple sources; hosted-DB backup specifics are provider-dependent and flagged for re-verification |

**Overall confidence:** HIGH

### Gaps to Address

- Neon's exact free-tier backup/retention policy should be re-verified directly against current docs before finalizing the Phase 6 backup approach — research flagged this as MEDIUM confidence due to fast-changing free-tier terms.
- Verify the deployed Next.js version is patched against CVE-2025-29927 (middleware auth-bypass) against the official Next.js security advisory before finalizing the framework version pin — current recommendation (16.2.x) is believed unaffected but sourced from a single MEDIUM-confidence write-up.
- mailto practical character-limit guidance (~1500-2000 chars) is corroborated across multiple sources but based on somewhat dated original reporting; worth a quick empirical test with a realistic worst-case invoice body during Phase 5 implementation rather than trusting the number blindly.
- Differentiator/v1.x feature prioritization (recurring sessions, reporting) is MEDIUM confidence market inference, not project-specified — validate with the actual user (the tutor) before committing roadmap capacity to these post-v1.

## Sources

### Primary (HIGH confidence)
- Context7 `/vercel/next.js` and `/drizzle-team/drizzle-orm-docs` — library resolution and version confirmation
- npm registry live version checks (2026-07-03) for next, react, drizzle-orm, drizzle-kit, zod, tailwindcss, iron-session, @neondatabase/serverless
- [Next.js 16 blog post](https://nextjs.org/blog/next-16) and [Upgrading: Version 16 docs](https://nextjs.org/docs/app/guides/upgrading/version-16)
- [Tailwind CSS v4 blog](https://tailwindcss.com/blog/tailwindcss-v4) and [shadcn/ui Tailwind v4 docs](https://ui.shadcn.com/docs/tailwind-v4)
- `.planning/PROJECT.md` — primary source for table stakes, anti-features, and architectural constraints

### Secondary (MEDIUM confidence)
- [Neon Vercel-Managed Integration docs](https://neon.com/docs/guides/vercel-managed-integration) and free-tier comparison articles
- [Drizzle vs Prisma comparisons](https://encore.dev/articles/drizzle-vs-prisma), [Bytebase Drizzle vs Prisma](https://www.bytebase.com/blog/drizzle-vs-prisma/)
- mailto character-limit research: [growingwiththeweb.com](https://www.growingwiththeweb.com/2012/07/getting-around-mailto-character-limit.html), [Mozilla Bugzilla #370949](https://bugzilla.mozilla.org/show_bug.cgi?id=370949)
- [currency.js](https://currency.js.org/), [Robin Wieruch — JS Rounding Errors](https://www.robinwieruch.de/javascript-rounding-errors/), [evertpot.com — Floats and money](https://evertpot.com/currencies-floats/)
- [Shared-password gate patterns for Next.js](https://blog.ratu.dev/simple-password-protection-for-a-next-js-app-1ff21ada93a3), [Revisiting password protecting routes in Next.js](https://www.alexchantastic.com/revisiting-password-protecting-next)
- [Stavros' Stuff — Authentication and rate limiting](https://www.stavros.io/posts/authentication-and-rate-limiting/)
- Tutoring/freelancer invoicing market scan (Deelo, Waffle, Evallo, TutorBird, TutorCruncher, Teachworks, TimeNavi) — used only to establish what NOT to build

### Tertiary (LOW confidence)
- CVE-2025-29927 patch-status claim for Next.js 16.x — single source ([Authgear guide](https://www.authgear.com/post/nextjs-security-best-practices/)), needs verification against official Next.js security advisory
- Vercel Hobby plan limits from search-aggregated sources — cross-check against vercel.com/docs/limits directly if usage assumptions ever matter

---
*Research completed: 2026-07-03*
*Ready for roadmap: yes*
