# Stack Research

**Domain:** Small single-user hosted CRUD + invoicing web app (tutoring time-tracking, no multi-user auth, no payments, no in-app email sending)
**Researched:** 2026-07-03
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 16.2.x (App Router) | Full-stack framework: UI, routing, Server Actions as the "API", middleware for the password gate | Single deployable that does frontend + backend with no separate API server to run/monitor. Server Actions eliminate hand-written REST/API routes for CRUD — exactly what a students/sessions/invoices app needs. Turbopack is stable and default for dev+build in v16, and it's the natural pairing with Vercel's free tier (built by the same team, zero-config deploy). Requires Node.js ≥ 20.9. |
| React | 19.2.x | UI library (bundled requirement of Next.js 16) | Comes with Next.js 16; no separate decision needed. Server Components reduce client JS for simple CRUD screens (dashboard, tables, forms). |
| TypeScript | 5.x (project) | Type safety across DB schema → server actions → UI | For a solo maintainer, types catch "I renamed a column and forgot a call site" mistakes before they reach production. Pairs directly with Drizzle's inferred types. |
| PostgreSQL (via Neon) | Postgres 17 (Neon-managed) | Persistent relational database for students, sessions, invoices | Relational data (a student has many sessions; sessions roll up into invoice snapshots; invoices reference billed sessions) is a textbook relational-schema fit — not a document/NoSQL shape. Neon's free tier (0.5 GB storage, ~100 compute-hours/month, up to 20 projects) comfortably covers one tutor's data for years. Installable directly from the Vercel dashboard's Storage tab (Neon is Vercel's official Postgres integration since Vercel Postgres was retired), so env vars are wired automatically. |
| Drizzle ORM | 0.45.x (+ drizzle-kit 0.31.x) | Type-safe schema definition, queries, and migrations | Thin, SQL-shaped, TypeScript-first ORM with no separate codegen/binary step (unlike Prisma's engine). For a solo dev who wants full control of a small, stable schema (3-4 tables) without an abstraction layer to fight, Drizzle is the current default recommendation. `drizzle-kit` generates and applies migrations from the schema file — no manual SQL migration writing needed. |
| Tailwind CSS | 4.3.x | Styling | Zero-runtime utility CSS; v4's CSS-based `@theme` config removes the old `tailwind.config.js` boilerplate. Fast to build a clean CRUD UI (tables, forms, dashboard cards) without hand-rolling a design system. |
| shadcn/ui | latest (CLI-installed, not an npm dependency) | Pre-built accessible components (table, dialog, form, button, input) copied into the repo | You own the component code (no version-lock black box), and it's already updated for Tailwind v4 + React 19. Massively cuts UI build time for a forms-and-tables app — exactly this app's shape. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@neondatabase/serverless` | 1.1.x | HTTP/WebSocket driver for Neon from serverless/edge functions | Required driver for Drizzle to talk to Neon over HTTP (works in Vercel's serverless functions without a persistent TCP pool). |
| `zod` | 4.4.x | Runtime validation for Server Action inputs (student form, session form, settings form) | Use at every Server Action boundary — Next.js Server Actions are callable like normal functions but are a network boundary; validate before writing to the DB. Pair with `drizzle-zod` (optional) to derive Zod schemas from Drizzle table definitions and avoid duplicating field lists. |
| `iron-session` | 8.0.x | Encrypted, stateless session cookie for the password gate | Stores a signed/encrypted "authenticated: true" flag in an httpOnly cookie after the shared password is entered. No session table/database round-trip needed — appropriate since there's only ever one "session" concept, not per-user sessions. |
| `date-fns` | latest 4.x | Date formatting/math for session dates and invoice periods | Lighter than `moment`/`dayjs` plugin sprawl for the handful of date operations this app needs (format a date, sum hours by date range). |
| `next-safe-action` (optional) | latest | Thin wrapper around Server Actions adding Zod validation + typed error returns | Optional convenience if hand-rolling `try/catch` + Zod parsing in every Server Action starts feeling repetitive. Not required for an app this size — evaluate after the first few CRUD actions are written. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `drizzle-kit` | Schema migrations (`drizzle-kit generate`, `drizzle-kit migrate`) | Run against the Neon connection string in `.env.local`; commit generated SQL migration files to the repo so `main` always reflects DB state. |
| Vercel CLI (`vercel`) | Local env var pulling (`vercel env pull`), preview deploys | Optional — the GitHub integration alone (push → auto-deploy) is enough for a solo owner; CLI is a nice-to-have for pulling prod env vars locally. |
| ESLint (Next.js default config) | Lint | Ships with `create-next-app`; keep default config, don't over-tune for a project this size. |

## Installation

```bash
# Scaffold (also installs next, react, react-dom, typescript, eslint, tailwindcss)
npx create-next-app@latest tutorinvoice --typescript --tailwind --app --eslint

cd tutorinvoice

# Database + ORM
npm install drizzle-orm @neondatabase/serverless
npm install -D drizzle-kit

# Validation
npm install zod

# Auth / password gate
npm install iron-session

# Dates
npm install date-fns

# UI components (adds only what you pick, via CLI, not a bulk package)
npx shadcn@latest init
npx shadcn@latest add button input table dialog form card badge
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Neon (Postgres) | Turso (SQLite/libSQL) | If you want zero cold-start latency on every request (Turso is always-on, no scale-to-zero) and don't need relational JOIN-heavy reporting. Turso's free tier is more generous on raw storage/rows, but Postgres's relational features (proper foreign keys, aggregate queries for the "unbilled hours" dashboard) are a more natural fit here, and Neon's cold start (1-3s on the rare request after idle) is a non-issue for a single low-traffic user. |
| Neon (Postgres) | Supabase | If you later want a built-in admin table-editor UI, row-level security, or built-in auth. Overkill here — Supabase bundles an auth system and storage buckets this project explicitly doesn't need, adding surface area a solo maintainer must ignore/secure for no benefit. |
| Vercel Hobby (hosting) | Fly.io / Render with a mounted SQLite volume | If you specifically want to self-manage a SQLite file with Litestream backups. More ops burden (volumes, backup verification) for zero benefit at this scale — avoid for a solo, low-traffic app. |
| Drizzle ORM | Prisma 7 | If you strongly prefer a higher-level query API and want Prisma Studio's visual data browser over hand-writing SQL-shaped queries. Prisma 7 (Nov 2025) shrank its bundle from ~14MB to ~1.6MB by dropping the Rust engine, closing much of the historical serverless cold-start gap — a reasonable choice if the owner is less comfortable with SQL. Drizzle remains lighter with zero codegen step. |
| iron-session (password gate) | NextAuth.js / Auth.js | Never for this use case — Auth.js is built around per-user accounts, OAuth providers, and a users table. Adopting it for a single shared password is pure overhead: extra config, extra dependency surface, extra concepts (providers, adapters, callbacks) with no corresponding benefit. |
| mailto: draft link | Resend / Postmark / SendGrid (transactional email API) | Explicitly out of scope per project requirements — the user wants to send from her own inbox, not an app-owned sending identity. Would also require domain verification, API keys, and deliverability tuning that provide zero value for a one-recipient-at-a-time, low-volume use case. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| NextAuth.js / Auth.js / Clerk / WorkOS | Designed for multi-user account systems (sign-up, OAuth, per-user sessions, password reset flows). This app has exactly one password and no user records — adopting a multi-user auth library adds a users table, provider config, and callback surface for a problem that doesn't exist here. | Hand-rolled password gate: a Server Action that compares the submitted password against `process.env.APP_PASSWORD` (using a constant-time compare) and sets an `iron-session` encrypted cookie on success; Next.js `middleware.ts` checks that cookie on every route. |
| Stripe / any payment SDK | Explicitly out of scope — the app only tells parents to Zelle the tutor directly; no money moves through the app. Adding Stripe would require PCI-adjacent handling, webhooks, and a merchant account for zero requested functionality. | Nothing — Zelle handle is just a text field rendered into the invoice/email body. |
| Resend / SendGrid / Postmark / any transactional email API | Explicitly out of scope per requirements — the user wants the send to happen from her own email client (Gmail/Apple Mail), keeping her in control and avoiding sender-domain verification, API keys, and deliverability babysitting. | `mailto:` link (or Gmail web compose deep link) pre-filled with recipient, subject, and body; see Email Delivery pattern below. |
| Prisma's older Rust-engine versions (< 7) pre-2025 for serverless deploys | Historically had meaningful cold-start and bundle-size penalties on serverless platforms like Vercel, which matters for a low-traffic app where every function is likely a cold start. | If choosing Prisma at all, use Prisma 7+ (TS/WASM engine) — but Drizzle remains the default recommendation here. |
| MongoDB / any document database | This app's data is inherently relational (student → sessions → invoice snapshot → billed sessions), not document-shaped. Modeling it in a document DB would mean re-implementing joins/referential integrity in application code. | PostgreSQL via Neon, as recommended above. |
| A self-managed VPS (DigitalOcean droplet, raw EC2) + Docker + Nginx + Postgres you administer | Every additional layer (OS patching, TLS renewal, process supervision, DB backups) is maintenance burden for a solo, non-technical-operations owner. The whole point of this stack is "push to GitHub, it's live." | Vercel Hobby (free tier) + Neon (managed Postgres), both zero-ops. |
| PDF generation libraries (`@react-pdf/renderer`, `puppeteer`, etc.) | Explicitly out of scope for v1 per PROJECT.md — copyable text summary is sufficient. | Plain-text invoice summary rendered in the UI with a "Copy" button; revisit only if parents request a formal document. |

## Email Delivery Pattern (client-side draft, no email service)

Given the mailto body-length constraint research turned up (browser/client combinations reliably support only **~2000 characters** in a `mailto:` URL before truncation or silent failure — Outlook+modern-browser caps around 2046, older IE around 512), design for this explicitly rather than discovering it in production:

1. **Primary: `mailto:` link** — build the URL client-side:
   `mailto:parent@example.com?subject=Invoice%20from%20...&body=<url-encoded invoice text>`
   Keep the generated invoice body template short (session count + total + Zelle instructions, not a line-by-line session dump) so it comfortably stays under ~1500 characters, leaving headroom across clients.
2. **Fallback / always-available: "Copy invoice text" button** using the Clipboard API (`navigator.clipboard.writeText`), paired with a plain `mailto:` link that carries only `to` + `subject` (no body). This sidesteps the length limit entirely for longer invoices (many sessions) — she pastes the copied text into the draft that opens. This is the more robust default for invoices with many line items.
3. **Optional enhancement (skip for v1):** a Gmail web compose deep link (`https://mail.google.com/mail/?view=cm&fs=1&to=...&su=...&body=...`) tends to tolerate longer bodies than `mailto:`, but only works if she uses Gmail in a browser — not universal across mail clients, so treat as a "nice if she's Gmail-only" enhancement, not the default.

**Recommendation:** ship both the `mailto:` link (for short invoices) and the copy-to-clipboard button (as the reliable fallback) from day one — this is cheap to build and avoids a length-limit bug report later.

## Single Shared-Password Gate — Implementation Pattern

- Store the password as a Vercel environment variable (`APP_PASSWORD`), never in code or the database.
- A `/login` route (Server Action) accepts the submitted password, compares it against `process.env.APP_PASSWORD` using a constant-time comparison (Node's `crypto.timingSafeEqual`, or simply rely on `iron-session`'s encrypted-cookie approach where a wrong guess just fails to produce a valid session), and on success calls `iron-session`'s `getIronSession(...).save()` to set an encrypted, httpOnly, `Secure` cookie.
- `middleware.ts` runs on every request, checks for a valid session cookie, and redirects to `/login` if absent — this is the single choke point protecting the whole app (dashboard, students, sessions, invoices, settings).
- No password hashing/salting is required for a single static shared secret compared server-side against an env var (there's no user table to protect from a DB leak) — but do **not** compare it client-side or embed it in any client bundle.
- Rate-limit login attempts minimally (e.g., a short in-memory or edge-config attempt counter, or simply require a long/high-entropy shared password) — full brute-force protection infrastructure is unnecessary at this scale but a trivially-guessable password is not.
- **Do not** use HTTP Basic Auth as the actual gate — it has no logout, poor UX on mobile, and sends credentials on every request; fine only for a throwaway staging environment, not this app's real gate.
- Verify the deployed Next.js version is patched against CVE-2025-29927 (a middleware-auth-bypass vulnerability affecting Next.js 11.1.4–15.2.2) — Next.js 16.x is unaffected/patched, reinforcing "stay current" as part of this recommendation rather than pinning to an old 14.x/15.x release.

## Stack Patterns by Variant

**If the owner wants a visual DB browser without relying on `psql`:**
- Use Neon's built-in Drizzle-Studio-powered table editor (available directly in the Neon console) or run `npx drizzle-kit studio` locally.
- Because it ships as part of the recommended toolchain already — no extra service (e.g., Supabase Studio, TablePlus subscription) needed.

**If bandwidth/compute ever approaches Vercel Hobby free-tier caps (100GB bandwidth, 1M function invocations/month) — extremely unlikely for one user:**
- Move to Vercel Pro ($20/mo) before considering any architecture change.
- Because at one user's traffic level, this is a billing decision, not a stack decision — the app's architecture doesn't need to change.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| `next@16.2.x` | `react@19.2.x`, `react-dom@19.2.x`, Node.js ≥ 20.9 | `create-next-app@latest` wires these together automatically; don't hand-pick mismatched versions. |
| `drizzle-orm@0.45.x` | `drizzle-kit@0.31.x`, `@neondatabase/serverless@1.1.x` | Keep `drizzle-orm` and `drizzle-kit` versions in lockstep (upgrade both together) — mismatches between the runtime library and the CLI are the most common Drizzle upgrade issue. |
| `tailwindcss@4.3.x` | `shadcn/ui` (latest CLI) | shadcn/ui's CLI now defaults new installs to Tailwind v4 config (`@theme` in CSS, `tw-animate-css` instead of `tailwindcss-animate`); don't mix a v3-generated `tailwind.config.js` into a v4 project. |
| `iron-session@8.0.x` | Next.js App Router (Server Actions + Route Handlers) | v8 is built for the App Router's cookie APIs (`cookies()` from `next/headers`); don't reach for older Pages-Router-era examples/tutorials. |

## Sources

- Context7 `/vercel/next.js` and `/drizzle-team/drizzle-orm-docs` — library resolution and version confirmation (HIGH confidence)
- npm registry (`npm view <pkg> version`, checked 2026-07-03) for `next` (16.2.10), `react`/`react-dom` (19.2.7), `drizzle-orm` (0.45.2), `drizzle-kit` (0.31.10), `zod` (4.4.3), `tailwindcss` (4.3.2), `iron-session` (8.0.4), `@neondatabase/serverless` (1.1.0), `@libsql/client` (0.17.4) — HIGH confidence, live registry data
- [Next.js 16 blog post](https://nextjs.org/blog/next-16) and [Upgrading: Version 16 docs](https://nextjs.org/docs/app/guides/upgrading/version-16) — Turbopack stable-by-default, Node ≥ 20.9 requirement — HIGH confidence
- [Neon Vercel-Managed Integration docs](https://neon.com/docs/guides/vercel-managed-integration) and [Neon for Vercel marketplace listing](https://vercel.com/marketplace/neon) — installation flow, free-tier compute-hours doubled post-Databricks acquisition — MEDIUM-HIGH confidence (official docs + corroborating search summaries)
- [Neon vs Turso comparison research](https://www.13labs.au/compare/neon-vs-turso), [Database Free Tier Comparison 2026](https://agentdeals.dev/database-free-tier-comparison-2026) — free tier figures for Neon (0.5GB/20 projects/100 compute-hrs) and Turso (5GB/100 dbs, always-on since Jan 2026) — MEDIUM confidence, cross-referenced across multiple 2026-dated sources
- [Drizzle vs Prisma 2026 comparison, Encore.dev](https://encore.dev/articles/drizzle-vs-prisma) and [Bytebase Drizzle vs Prisma](https://www.bytebase.com/blog/drizzle-vs-prisma/) — Prisma 7 bundle-size improvement, Drizzle's SQL-proximity tradeoff — MEDIUM confidence
- [Tailwind CSS v4 blog](https://tailwindcss.com/blog/tailwindcss-v4) and [shadcn/ui Tailwind v4 docs](https://ui.shadcn.com/docs/tailwind-v4) — v4 `@theme` directive, `tw-animate-css` migration — HIGH confidence, official docs
- mailto character-limit research: [growingwiththeweb.com](https://www.growingwiththeweb.com/2012/07/getting-around-mailto-character-limit.html), [Microsoft Answers thread on 1026-char Outlook limit](https://answers.microsoft.com/en-us/outlook_com/forum/all/why-dont-mailto-links-with-more-than-1026/546c02a5-1d73-40f6-a175-4d9895b169bc) — MEDIUM confidence (older sources, but limit behavior for URL-based protocols hasn't materially changed; corroborated by multiple independent write-ups converging on ~2000 char practical ceiling)
- [Vercel Hobby plan docs/limits](https://vercel.com/docs/limits) and [Vercel free tier 2026 breakdown](https://deploywise.dev/blog/vercel-free-tier-limits-2026) — 100GB bandwidth/1M invocations/month Hobby caps, non-commercial ToS note — MEDIUM confidence (search-aggregated, cross-check against vercel.com/docs/limits directly before committing to production if usage assumptions matter)
- Next.js middleware auth-bypass CVE-2025-29927 — [Authgear Next.js Security 2026 guide](https://www.authgear.com/post/nextjs-security-best-practices/) — MEDIUM confidence, single source; recommend verifying patch status against the official Next.js security advisory before finalizing framework version pin

---
*Stack research for: Small single-user hosted CRUD + invoicing web app*
*Researched: 2026-07-03*
