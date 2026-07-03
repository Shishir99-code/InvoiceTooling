# Phase 1: Foundation — Auth Gate & Student Roster - Research

**Researched:** 2026-07-03
**Domain:** Next.js 16 App Router scaffolding, iron-session password gate, Drizzle ORM + Neon Postgres, shadcn/ui CRUD dialogs
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Access / Auth Gate**
- **D-01:** Single shared-password gate — exactly one password box. No accounts, no
  usernames, no signup, no password-reset flow. The user explicitly rejected any
  "login/sign-in/sign-up" account system; the single shared secret is kept because the app
  is deployed to a public URL and it's the only thing keeping student names, rates, and
  parent emails private. (Confirms PROJECT.md's single-shared-password constraint;
  AUTH-01..04 all stand.)
- **D-02:** Session persists ~30 days per device, renewing on activity. She should
  effectively never re-type the password on her own phone/laptop within normal use.
- **D-03:** No logout button — her own devices, one shared secret; a logout control is
  unnecessary UI. (If ever needed she can clear cookies.)
- **D-04:** Visitors who already hold a valid session skip the login screen and land
  directly on the student roster.
- **D-05:** When repeated wrong-password attempts trip the rate limit, show a friendly wait
  message ("Too many attempts — try again in a few minutes"), not a scary/opaque error. The
  lockout mainly deters bots.

**Student Roster — Display**
- **D-06:** Each roster row shows name + hourly rate + parent email (all three visible).
  Note: parent email is now required (see D-13), so every row has one.
- **D-07:** Hourly rate is entered as plain dollars (type `50` → displayed `$50.00`). Stored
  as integer cents in the DB (never floats) — matches SESS-05's money rule that Phase 2
  depends on.
- **D-08:** Roster sorted alphabetically by student name.
- **D-09:** Duplicate names allowed — no blocking, no forced uniqueness. She distinguishes
  them herself; later phases use autocomplete.

**Student Roster — Remove / Archive**
- **D-10:** Removal always archives (soft-hide) — students are never hard-deleted. Build
  the archive/soft-delete flag now in Phase 1 (not deferred), so the history-preserving
  behavior Phases 2–3 require "just works" and accidental removals are recoverable.
  Archived students drop out of the main roster list.
- **D-11:** Provide a way to view archived students and restore them (e.g. an archived
  filter/view with a restore action) — covers the "oops" case and returning students.
- **D-12:** Archiving shows a quick confirmation ("Archive [name]?") before removing.

**Student Roster — Add / Edit Form**
- **D-13:** ⚠ SPEC CHANGE — parent/guardian email is REQUIRED (not optional). A student
  cannot be saved without a valid parent email. This overrides STUD-01 ("optional
  parent/guardian email") and the roadmap Phase 1 success criterion wording. Email must
  pass format validation, not just non-empty. Downstream impact: Phase 3's MAIL-04
  "graceful guard when a student has no parent email" becomes unnecessary — every student
  is guaranteed a recipient. (See Deferred Ideas for the required ROADMAP.md /
  REQUIREMENTS.md update.)
- **D-14:** Add/edit happens in a pop-up modal dialog over the roster (stay-on-page), not a
  separate route or inline row. Works on mobile.
- **D-15:** First run (zero students) shows a friendly empty state — "No students yet — add
  your first student to get started" — with a prominent Add button.
- **D-16:** Validation shows inline field errors and blocks save until fixed (e.g. "Enter a
  name", "Rate must be a positive number", "Enter a valid email"). Blank name and
  non-numeric/negative rate are invalid.

### Claude's Discretion
- Exact rate-limit thresholds/window (attempts + cooldown duration) — pick sensible
  defaults for a single low-traffic user.
- Precise archived-view affordance (toggle vs. filter vs. separate section) and modal
  layout details — implementation/UI choice.
- Cookie/session mechanics (renewal-on-activity implementation) — per iron-session
  recommendation in CLAUDE.md.

### Deferred Ideas (OUT OF SCOPE)
- ROADMAP.md / REQUIREMENTS.md update needed (follow-up): Per D-13, parent email is now
  required. Update STUD-01 wording (drop "optional"), the Phase 1 success-criterion
  wording, and reconsider Phase 3's MAIL-04 (the "no parent email" graceful guard is now
  moot). Not blocking Phase 1 planning, but should be reconciled so the roadmap matches the
  built behavior. Use `/gsd-phase` or a REQUIREMENTS.md edit.
- None of the discussion strayed into other phases' capabilities (sessions, dashboard,
  invoicing, email, settings all correctly deferred to Phases 2–3).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| AUTH-01 | User can unlock the app by entering a single shared password | Pattern 1 (middleware choke point) + `/login` Server Action pattern in Code Examples; `crypto.timingSafeEqual` comparison against `process.env.APP_PASSWORD`. |
| AUTH-02 | User stays logged in across page refreshes via a secure session cookie | `iron-session` 8.0.4 encrypted HttpOnly/Secure cookie (Standard Stack); D-02's ~30-day rolling TTL achieved via `session.save()` on every valid middleware request (Pattern 1, Assumption A1). |
| AUTH-03 | Every page except the login screen is inaccessible without a valid session | Pattern 1 — `middleware.ts` matcher covers all routes except `/login` and static assets; deny-by-default via matcher, not an allow-list. |
| AUTH-04 | Repeated wrong password attempts are rate-limited to deter brute force | Postgres-backed `login_attempts` table keyed by client IP via `@vercel/functions`'s `ipAddress()` (Code Examples, Pitfall 3, Assumption A2) — avoids the in-memory-state-doesn't-survive-cold-starts trap. |
| STUD-01 | User can add a student with name, hourly rate, and parent/guardian email (required per D-13) | Pattern 2 (Server Action + zod/`drizzle-zod` validation) + `students` schema in Code Examples (`rateCents` integer, `parentEmail` required varchar). |
| STUD-02 | User can edit a student's name, hourly rate, and parent email | Same `studentFormSchema` (Pattern 2) reused for an `editStudentAction`; Pattern 3 (`useActionState`) drives the modal for both add and edit. |
| STUD-03 | User can remove a student (archived, never hard-deleted) | `archived` boolean column (Code Examples schema) + D-10/D-11/D-12-driven archive/restore/confirm flow (Architecture Diagram "Archive flow"). |
| STUD-04 | User can view a list of all students | Server Component roster page querying `students WHERE archived = false ORDER BY name` (Architecture Diagram, D-08 alphabetical sort). |

</phase_requirements>

## Summary

Phase 1 is a from-scratch scaffold plus two vertical capabilities: a single-shared-password
gate (iron-session + middleware) and student roster CRUD (Drizzle + Neon Postgres + Server
Actions + shadcn/ui). Every library in CLAUDE.md's locked stack was re-verified live against
the npm registry and official docs during this research session — versions match CLAUDE.md
exactly (no drift). `create-next-app@latest` with `--typescript --tailwind --eslint --app`
now produces a Tailwind v4 + TypeScript + App Router project with zero extra config in one
command; Drizzle's `neon-http` driver plus `drizzle-kit push` is the fastest path to a real
DB read/write for a Walking Skeleton. iron-session v8 has a single runtime-agnostic entry
point (no more `/edge` subpath) built on `iron-webcrypto`, so it works unmodified in
`middleware.ts` — critical because that's the single choke point protecting every route.
Next.js 16.2.x is far past the CVE-2025-29927 patched threshold (15.2.3), so no mitigation
code is needed beyond staying on the locked version.

The one area CLAUDE.md leaves open is rate-limiting mechanics (AUTH-04): Vercel serverless
functions do not share in-memory state across invocations/cold starts, so a naive in-memory
counter will not reliably rate-limit. Because Neon Postgres is already part of the stack, the
lowest-friction approach — avoiding a new service like Upstash Redis — is a small
`login_attempts` Postgres table keyed by client IP (obtained via `@vercel/functions`'
`ipAddress()` helper), checked in the `/login` Server Action before comparing passwords.

**Primary recommendation:** Scaffold with `create-next-app@latest` defaults, wire Neon +
Drizzle with `neon-http` + `drizzle-kit push` for this phase (switch to generate/migrate
once schema stabilizes across phases), gate every route via `middleware.ts` calling
`getIronSession(cookies(), sessionOptions)`, and build student CRUD as Server Actions
validated with `zod` + `drizzle-zod`, called from a shadcn/ui `Dialog` client component,
using React 19's `useActionState` for inline field errors (D-16) — no extra form library
needed.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Password gate check (per-request) | Frontend Server (SSR) — `middleware.ts` | — | Middleware runs on every request before any route renders; it is the single choke point CLAUDE.md specifies. |
| Login form submission + password compare | API / Backend — Server Action | Frontend Server | `/login` Server Action is the only place `process.env.APP_PASSWORD` is read; never sent to or compared in the client bundle. |
| Session cookie issuance/renewal | API / Backend — Server Action + Middleware | — | `iron-session`'s `save()` is called both at login (Server Action) and on every valid request (middleware, for rolling renewal). |
| Rate-limit counter | Database / Storage — Neon Postgres | API / Backend | Must survive serverless cold starts; in-memory counters do not persist across Vercel function instances. |
| Student CRUD (add/edit/archive/restore) | API / Backend — Server Actions | Database / Storage | Server Actions are the app's only "API"; Drizzle queries against Neon are the persistence layer. |
| Student roster list/table + empty state | Browser / Client (rendered via Frontend Server) | — | Server Component fetches and renders the list; client-side only for the modal's open/close + inline validation state. |
| Add/Edit modal + inline validation feedback | Browser / Client | API / Backend | Dialog open state and field-level error display are client-side (React 19 `useActionState`); the actual validation logic (zod) runs server-side in the Server Action as the source of truth. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.2.10 | Full-stack framework: routing, Server Actions, middleware | Locked in CLAUDE.md; confirmed current on npm registry 2026-07-03. Node.js ≥ 20.9 required — local Node v25.1.0 satisfies this. |
| react / react-dom | 19.2.7 | UI library, bundled with Next 16 | Locked in CLAUDE.md; confirmed on npm registry. `useActionState` (stable since 19.0) is the key hook for D-16 inline validation. |
| typescript | 5.x (project) | Type safety, DB schema → Server Action → UI | Ships via `create-next-app`; pairs with Drizzle's inferred types. |
| @neondatabase/serverless | 1.1.0 | HTTP driver for Neon from serverless functions | Locked in CLAUDE.md; confirmed on npm registry. Required for Drizzle's `neon-http` adapter — works over HTTP with no persistent TCP pool, correct for Vercel serverless functions. |
| drizzle-orm | 0.45.2 | Schema, queries | Locked in CLAUDE.md; confirmed on npm registry. |
| drizzle-kit | 0.31.10 | Migrations / schema push (dev CLI) | Locked in CLAUDE.md; confirmed on npm registry. Keep in lockstep with `drizzle-orm` version. |
| tailwindcss + @tailwindcss/postcss | 4.3.2 | Styling | Locked in CLAUDE.md; confirmed on npm registry. `create-next-app --tailwind` wires the v4 PostCSS plugin and `@import "tailwindcss"` automatically — no manual `tailwind.config.js` needed. |
| shadcn (CLI) | 4.13.0 | Component scaffolding (Dialog, Button, Input, Table, Label) | CLI-installed per component, not an npm runtime dependency — code is copied into the repo. Confirmed current on npm registry. |
| zod | 4.4.3 | Runtime validation at every Server Action boundary | Locked in CLAUDE.md; confirmed on npm registry. **v4 breaking change vs. training-data v3 assumptions:** use top-level `z.email()` (not the deprecated chainable `.email()`), and `z.flattenError(result.error)` / `.issues` (not `.errors`/`.flatten()`) for the D-16 inline field-error shape. |
| iron-session | 8.0.4 | Encrypted, stateless session cookie | Locked in CLAUDE.md; confirmed on npm registry. v8 has a single entry point (no `/edge` subpath) — same `getIronSession` import works in Server Actions, Server Components, Route Handlers, **and** `middleware.ts` because it's built on `iron-webcrypto` (Web Crypto API), not Node's `crypto` module. This directly resolves the historical "edge runtime does not support Node.js crypto module" error older iron-session versions hit in middleware. |
| date-fns | 4.4.0 | Date formatting | Locked in CLAUDE.md; confirmed on npm registry. Minimal use in Phase 1 (e.g., "last updated" display if any); heavier use starts Phase 2. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| drizzle-zod | 0.8.3 | Derive zod schemas from Drizzle table definitions | Peer dep confirmed: `zod: '^3.25.0 \|\| ^4.0.0'`, `drizzle-orm: '>=0.36.0'` — compatible with the locked zod 4.4.3 / drizzle-orm 0.45.2. Use `createInsertSchema(students)` as the base, then `.extend()`/`.refine()` for the D-13 required+format-validated email and D-07 positive-rate rules, avoiding hand-duplicated field lists between the DB schema and the Server Action validator. |
| dotenv | latest | Load `DATABASE_URL` for `drizzle-kit` CLI commands run locally | `drizzle.config.ts` needs env vars outside the Next.js runtime (Next.js auto-loads `.env.local` at runtime, but the standalone `drizzle-kit` CLI does not) — `dotenv/config` import at the top of `drizzle.config.ts` is the standard fix. |
| tsx | latest (dev) | Run TypeScript scripts (e.g., a one-off seed script) without a build step | Optional — only needed if a seed/utility script is added; not required for the CRUD path itself. |
| lucide-react | 1.23.0 | Icon set used by shadcn/ui components | Installed automatically when shadcn components (Dialog, Button) are added via CLI; used for e.g. archive/restore icons. |
| class-variance-authority | 0.7.1 | Variant styling used internally by shadcn/ui components | Installed automatically by the shadcn CLI; not hand-invoked in Phase 1 code, just a transitive dependency of copied components. |
| @radix-ui/react-dialog | 1.1.18 | Accessible modal primitive underlying shadcn/ui's `Dialog` | Installed automatically when `npx shadcn add dialog` is run; provides the accessible modal behavior (focus trap, Escape-to-close, overlay) D-14's pop-up requires "for free." |
| @vercel/functions | 3.7.5 | `ipAddress(request)` helper for reliable client IP extraction on Vercel | Needed for the AUTH-04 rate-limit key. `NextRequest.ip` was removed from newer Next.js versions; this official Vercel package is the current recommended replacement over manually parsing `x-forwarded-for`. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Postgres-table rate limiting | Upstash Redis (`@upstash/ratelimit`) | Purpose-built and slightly lower-latency, but adds a new third-party service/account for a single-user, low-traffic app that already has Neon Postgres available. Not worth the extra signup/dependency here — reconsider only if traffic or attack volume grows materially. |
| `drizzle-kit push` (Phase 1) | `drizzle-kit generate` + `migrate` from day one | `push` is faster for the Walking Skeleton's first real DB read/write and for iterating on the schema during Phase 1 itself. Switch to `generate`/`migrate` (versioned SQL files committed to git) once the schema stabilizes and Phase 2/3 start building on top of it — see Common Pitfalls. |
| React 19 `useActionState` for inline errors | `react-hook-form` + `zodResolver` | `react-hook-form` is a strong, common pairing, but for a 3-field form (name, rate, email) `useActionState` + server-side zod validation avoids an extra dependency and keeps the single Zod schema as the sole source of truth (client never duplicates validation rules). Reconsider if later phases add much more complex forms. |

**Installation:**
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --turbopack --import-alias "@/*"
npm install drizzle-orm@0.45.2 @neondatabase/serverless@1.1.0 zod@4.4.3 iron-session@8.0.4 date-fns@4.4.0 drizzle-zod@0.8.3 @vercel/functions@3.7.5 dotenv
npm install -D drizzle-kit@0.31.10
npx shadcn@latest init
npx shadcn@latest add dialog button input label table
```

**Version verification:** All versions above were confirmed live via `npm view <pkg> version` against the npm registry on 2026-07-03 and match CLAUDE.md's Recommended Stack table exactly — no drift between CLAUDE.md's prior research and this phase's re-check.

## Package Legitimacy Audit

All packages below were checked with `slopcheck scan --pkg npm <name>` (v0.6.1) on 2026-07-03. All returned `[OK]`. All package names are already part of CLAUDE.md's locked, previously-researched stack (itself sourced from Context7 + npm registry per CLAUDE.md's own Sources section) — this audit is a re-verification for this specific phase's install list, not first discovery.

| Package | Registry | Source Repo | slopcheck | Disposition |
|---------|----------|--------------|-----------|-------------|
| next | npm | github.com/vercel/next.js | OK | Approved |
| react / react-dom | npm | github.com/facebook/react | OK | Approved |
| typescript | npm | github.com/microsoft/TypeScript | OK | Approved |
| tailwindcss / @tailwindcss/postcss | npm | github.com/tailwindlabs/tailwindcss | OK | Approved |
| drizzle-orm | npm | github.com/drizzle-team/drizzle-orm | OK | Approved |
| drizzle-kit | npm | github.com/drizzle-team/drizzle-orm | OK | Approved |
| drizzle-zod | npm | github.com/drizzle-team/drizzle-orm | OK | Approved |
| @neondatabase/serverless | npm | github.com/neondatabase/serverless | OK | Approved |
| zod | npm | github.com/colinhacks/zod | OK | Approved |
| iron-session | npm | github.com/vvo/iron-session | OK | Approved |
| date-fns | npm | none linked (flagged `NO_REPO`, info-severity only) | OK | Approved — long-established, high-download package; `NO_REPO` is an info-level metadata gap, not a legitimacy concern |
| lucide-react | npm | github.com/lucide-icons/lucide | OK | Approved (installed transitively via shadcn CLI) |
| class-variance-authority | npm | github.com/joe-bell/cva | OK | Approved (installed transitively via shadcn CLI) |
| @radix-ui/react-dialog | npm | github.com/radix-ui/primitives | OK | Approved (installed transitively via `shadcn add dialog`) |
| dotenv | npm | github.com/motdotla/dotenv | OK | Approved |
| tsx | npm | github.com/privatenumber/tsx | OK | Approved |
| @vercel/functions | npm | github.com/vercel/vercel | OK | Approved |
| shadcn (CLI) | npm | github.com/shadcn-ui/ui | OK | Approved — CLI tool, not a runtime dependency |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
Browser (student roster page)
   │
   │ 1. GET /  (no session cookie, or expired cookie)
   ▼
middleware.ts  ── getIronSession(cookies(), sessionOptions) ──┐
   │  session.isLoggedIn?                                     │
   │        NO → redirect → /login                            │
   │        YES → session.save() [renews ~30d TTL] → continue │
   ▼                                                            │
/login (Server Component + form)                                │
   │ user submits password                                     │
   ▼                                                            │
loginAction (Server Action)                                     │
   │ 1. check login_attempts table (Neon) for this IP           │
   │      locked_until in future? → return friendly wait error  │
   │ 2. crypto.timingSafeEqual(password, APP_PASSWORD)           │
   │      WRONG → increment login_attempts row, return error     │
   │      RIGHT → reset login_attempts row for this IP            │
   │              session.isLoggedIn = true; session.save()        │
   │              redirect(/)                                       │
   ▼
/ (roster page, Server Component)
   │ SELECT * FROM students WHERE archived = false ORDER BY name  (Drizzle)
   ▼
<StudentTable> (Server Component, renders rows)
   │
   │ "Add Student" / row "Edit" click (client component)
   ▼
<StudentFormDialog> (client component, shadcn Dialog)
   │ useActionState(addOrEditStudentAction, ...)
   │ on submit → Server Action
   ▼
addOrEditStudentAction (Server Action)
   │ 1. zod-parse form data (name, rate dollars→cents, email format)
   │      INVALID → return { fieldErrors } → dialog shows inline errors, save blocked
   │      VALID → Drizzle insert/update into students table (Neon)
   │ 2. revalidatePath("/") → roster re-renders with new data
   ▼
Dialog closes, roster table shows updated row (alphabetical order)

Archive flow: "Archive" button → confirm dialog → archiveStudentAction
   → UPDATE students SET archived = true → revalidatePath("/")
Archived view: separate filtered list (archived = true) → "Restore" → same pattern, archived = false
```

### Recommended Project Structure
```
app/
├── layout.tsx              # root layout, Tailwind globals.css import
├── globals.css             # @import "tailwindcss";
├── login/
│   └── page.tsx             # login form (Server Component + Server Action)
├── page.tsx                 # student roster (protected, default landing per D-04)
├── archived/
│   └── page.tsx              # archived students view + restore (D-11)
components/
├── ui/                       # shadcn-generated: dialog.tsx, button.tsx, input.tsx, label.tsx, table.tsx
├── student-table.tsx          # Server Component, renders roster rows
├── student-form-dialog.tsx     # client component, add/edit modal (D-14)
└── archive-confirm-dialog.tsx   # client component, confirm-before-archive (D-12)
lib/
├── session.ts                 # SessionData type, sessionOptions, getSession() helper
├── db/
│   ├── index.ts                # drizzle({ client: neon(...) }) instance
│   └── schema.ts                # students table + login_attempts table
└── actions/
    ├── auth.ts                  # loginAction
    └── students.ts               # addStudentAction, editStudentAction, archiveStudentAction, restoreStudentAction
middleware.ts                  # single choke point, protects every route except /login
drizzle.config.ts
drizzle/                        # generated migration SQL (once switched from push to generate/migrate)
```

### Pattern 1: Middleware as the single auth choke point
**What:** `middleware.ts` at the project root runs on every matched request, reads the
iron-session cookie via `next/headers` `cookies()`, and redirects to `/login` if no valid
session exists. On a valid session it re-calls `session.save()` to slide the ~30-day TTL
forward (D-02 renew-on-activity), then lets the request continue.
**When to use:** Every route in this app except `/login` itself and any static assets —
this is the AUTH-03 requirement's single enforcement point.
**Example:**
```typescript
// Source: iron-session official example repo
// https://raw.githubusercontent.com/vvo/iron-session/main/examples/next/src/middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session";

export async function middleware(request: NextRequest) {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);

  if (!session.isLoggedIn) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Renew TTL on activity (D-02) — re-save extends the cookie's Max-Age
  await session.save();
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico).*)"],
};
```
*Confidence note: the base `getIronSession(cookies(), sessionOptions)` call in middleware
is confirmed working by iron-session's own official example repo (v8, edge-compatible via
`iron-webcrypto`). The explicit `session.save()`-on-every-request-for-rolling-renewal
technique is not spelled out verbatim in iron-session's docs — it is a standard
rolling-session pattern applied to iron-session's documented API — tagged `[ASSUMED]`,
low risk if wrong (worst case: session doesn't renew and expires at a fixed 30 days instead
of rolling).*

### Pattern 2: Server Action with zod validation + drizzle-zod
**What:** Every Server Action that writes to the DB starts by parsing `FormData` (or an
object) through a zod schema derived from the Drizzle table via `drizzle-zod`, extended
with the app-specific rules (D-13 email format required, D-07 positive-cents rate).
**When to use:** `addStudentAction`, `editStudentAction` — any mutation boundary.
**Example:**
```typescript
// Source: drizzle-zod README (github.com/drizzle-team/drizzle-orm, drizzle-zod package)
//         + zod v4 official migration guide (zod.dev/v4/changelog)
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { students } from "@/lib/db/schema";

const baseStudentSchema = createInsertSchema(students, {
  name: z.string().trim().min(1, "Enter a name"),
});

export const studentFormSchema = baseStudentSchema
  .pick({ name: true })
  .extend({
    // form field is plain dollars; convert to cents server-side (D-07)
    rateDollars: z.coerce
      .number({ error: "Rate must be a positive number" })
      .positive("Rate must be a positive number"),
    parentEmail: z.email("Enter a valid email"), // zod v4 top-level format, D-13 required
  });

"use server";
export async function addStudentAction(
  _prevState: unknown,
  formData: FormData,
) {
  const parsed = studentFormSchema.safeParse({
    name: formData.get("name"),
    rateDollars: formData.get("rateDollars"),
    parentEmail: formData.get("parentEmail"),
  });

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors }; // v4 API, not .flatten()
  }

  await db.insert(students).values({
    name: parsed.data.name,
    rateCents: Math.round(parsed.data.rateDollars * 100),
    parentEmail: parsed.data.parentEmail,
    archived: false,
  });

  revalidatePath("/");
  return { fieldErrors: null };
}
```

### Pattern 3: React 19 `useActionState` for inline validation (D-16)
**What:** Drive the modal form's submit + error state with React 19's `useActionState`,
which pairs directly with a Server Action returning `{ fieldErrors }`.
**When to use:** `<StudentFormDialog>` client component.
**Example:**
```typescript
// Source: React 19 docs (useActionState is stable as of React 19.0, bundled with Next 16)
"use client";
import { useActionState } from "react";
import { addStudentAction } from "@/lib/actions/students";

export function StudentFormDialog() {
  const [state, formAction, isPending] = useActionState(addStudentAction, {
    fieldErrors: null,
  });

  return (
    <form action={formAction}>
      <input name="name" />
      {state.fieldErrors?.name && <p className="text-red-600">{state.fieldErrors.name}</p>}
      {/* rateDollars, parentEmail fields follow the same pattern */}
      <button type="submit" disabled={isPending}>Save</button>
    </form>
  );
}
```

### Pattern 4: Drizzle + Neon `neon-http` driver
**What:** Use the HTTP-based Neon driver (not the WebSocket/pooled driver) for Drizzle —
correct for Vercel serverless functions, which are short-lived and don't benefit from a
persistent TCP pool.
**When to use:** `lib/db/index.ts`, imported by every Server Action and Server Component
that touches the DB.
**Example:**
```typescript
// Source: Drizzle ORM official docs (orm.drizzle.team/docs/get-started/neon-new)
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle({ client: sql, schema });
```
*Note: official Drizzle docs currently show `npm i drizzle-orm@rc` in some quick-start
snippets — this reflects a docs-page snapshot, not a recommendation to use a release
candidate. Pin the CLAUDE.md-locked, npm-registry-verified stable versions instead
(`drizzle-orm@0.45.2`, `@neondatabase/serverless@1.1.0`).*

### Anti-Patterns to Avoid
- **Comparing the password with `===`:** Timing-attack surface, however small. Use Node's
  `crypto.timingSafeEqual` on equal-length buffers (pad/hash first if lengths can differ) as
  CLAUDE.md specifies.
- **Storing rate as a float/decimal in JS before it hits the DB column:** Even with an
  `integer` column, doing `dollars * 100` without `Math.round()` risks floating-point drift
  (e.g. `19.99 * 100 === 1998.9999999999998` in JS). Always `Math.round()` the cents
  conversion at the Server Action boundary.
- **Hard-deleting a student row on "remove":** Violates D-10/D-11 directly — always set
  `archived = true`, never `DELETE FROM students`.
- **Relying on `NextRequest.ip` for the rate-limit key:** Removed/unreliable in current
  Next.js versions on Vercel; use `ipAddress(request)` from `@vercel/functions` instead.
- **In-memory `Map()` or module-level counter for rate limiting:** Does not survive
  serverless cold starts or multiple concurrent function instances — will appear to work
  locally (`next dev`) and silently fail to rate-limit in production on Vercel.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Encrypted session cookie sealing/unsealing | Custom AES/JWT cookie signing | `iron-session` (locked) | Cookie encryption, tamper-detection, and edge-runtime-safe crypto (`iron-webcrypto`) are exactly what iron-session solves; hand-rolling risks a subtly broken seal/unseal implementation protecting real student PII (names, parent emails). |
| Modal dialog accessibility (focus trap, Escape key, overlay) | Custom `<div>`-based modal | shadcn/ui `Dialog` (built on `@radix-ui/react-dialog`) | Focus management and ARIA semantics for a modal are deceptively complex to get right; Radix's primitive is the de facto standard and is installed via one CLI command. |
| Zod schema duplication between DB schema and form validation | Hand-write a second Zod schema mirroring the Drizzle `students` table | `drizzle-zod`'s `createInsertSchema(students)` | Keeps the DB column list and the validation schema in one place — a column rename in `schema.ts` won't silently desync from a hand-maintained validator. |
| Money math with floats | `rate: number` column, JS float arithmetic | `rateCents: integer` column + `Math.round()` at the boundary | Floats cannot represent currency exactly; this is exactly the class of bug SESS-05 (Phase 2) explicitly guards against — get it right at the students-table level now. |

**Key insight:** Every "don't hand-roll" item above already has a CLAUDE.md-locked library
covering it except the Zod-schema-duplication concern, which `drizzle-zod` (a supporting
library, not previously called out in CLAUDE.md by name but compatible with the locked
zod/drizzle-orm versions) resolves cleanly.

## Common Pitfalls

### Pitfall 1: `drizzle-kit push` schema drift across phases
**What goes wrong:** `push` diffs the live DB against the schema file and applies changes
directly — fast, but produces no committed migration history. If Phase 2/3 also use `push`
against the same Neon branch without ever generating a migration file, there is no audit
trail of schema changes and no safe way to reproduce the schema on a fresh DB (e.g., a Neon
preview branch) without re-running `push` by hand.
**Why it happens:** `push` is the more convenient command during rapid early iteration, so
it's tempting to keep using it past the prototyping phase.
**How to avoid:** Use `drizzle-kit push` for Phase 1 (fastest path to the Walking
Skeleton's first real DB read/write and for iterating on the students+login_attempts
schema before it's "locked"). Once Phase 1 ships, switch to `drizzle-kit generate` +
`migrate` for Phase 2/3 additions (sessions, invoices tables) so schema history is
committed to git as CLAUDE.md's Development Tools table specifies.
**Warning signs:** A teammate (or future you) can't tell what changed between two DB
states without diffing `schema.ts` directly against a live DB connection.

### Pitfall 2: `next/headers` `cookies()` inside `middleware.ts` requires the right Next.js version behavior
**What goes wrong:** In some Next.js versions/configurations, calling `cookies()` from
`next/headers` outside a Server Component/Action/Route Handler request scope throws or
behaves unexpectedly, leading developers to reach for `request.cookies` /
`response.cookies` (the `NextRequest`/`NextResponse` cookie APIs) instead, and then trying
to hand-roll unsealing.
**Why it happens:** `next/headers`'s `cookies()` is documented primarily for Server
Components/Actions; its use inside middleware is less prominently documented, even though
iron-session's own official example repo uses exactly this pattern.
**How to avoid:** Follow iron-session's official middleware example verbatim (Pattern 1
above) — `getIronSession(cookies(), sessionOptions)` works in `middleware.ts` on Next.js
16 App Router. If it errors in practice during implementation, fall back to constructing
the session via `unsealData`/`sealData` against `request.cookies.get(cookieName)` directly
— iron-session exports both from the same single entry point (no `/edge` import needed in
v8).
**Warning signs:** A runtime error mentioning cookie mutation outside a request-scoped
render, or a session that never persists after `/login` redirects to `/`.

### Pitfall 3: In-memory rate limiting silently no-ops in production
**What goes wrong:** A `Map()` or module-scope counter used to track failed login attempts
works fine in `next dev` (single long-lived process) but resets on every cold start in
Vercel's serverless environment, and different requests may hit different function
instances — so an attacker's 5th, 10th, 50th wrong guess never actually trips the limiter
in production.
**Why it happens:** It's the simplest thing to write and passes local testing.
**How to avoid:** Persist attempt counts in the Neon Postgres DB (already in the stack) —
a small `login_attempts` table keyed by client IP (via `@vercel/functions`'s
`ipAddress()`), incremented on failure and reset on success/cooldown expiry, checked at
the top of the `/login` Server Action before the password comparison.
**Warning signs:** Rate limiting "works" in `npm run dev` but a scripted brute-force
attempt against the deployed Vercel URL is never blocked.

### Pitfall 4: zod v3 muscle memory in a v4 project
**What goes wrong:** Training-data-era code (and most existing tutorials) use
`z.string().email()`, `error.flatten()`, and `error.errors` — all either deprecated or
removed in zod v4 (locked version 4.4.3).
**Why it happens:** Zod v3 patterns are extremely common in existing blog posts/tutorials
and in Claude's own training data; v4 is a comparatively recent major version.
**How to avoid:** Use `z.email()` (top-level), `z.flattenError(error)` /
`z.treeifyError(error)` (top-level functions), and `error.issues` (not `.errors`) per the
Standard Stack table's zod entry above.
**Warning signs:** TypeScript errors on `.errors` or `.flatten()`, or a deprecation
warning/lint on chainable `.email()`.

## Code Examples

### drizzle.config.ts
```typescript
// Source: Drizzle ORM official docs (orm.drizzle.team/docs/get-started/neon-new)
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "./lib/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

### students + login_attempts schema
```typescript
// Source: Drizzle ORM pg-core docs + this phase's CONTEXT.md decisions (D-07, D-10, D-13)
import { pgTable, serial, varchar, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const students = pgTable("students", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  rateCents: integer("rate_cents").notNull(),       // D-07: integer cents, never float
  parentEmail: varchar("parent_email", { length: 255 }).notNull(), // D-13: required
  archived: boolean("archived").notNull().default(false),          // D-10/D-11: soft delete
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const loginAttempts = pgTable("login_attempts", {
  ipAddress: varchar("ip_address", { length: 45 }).primaryKey(), // IPv6-safe length
  failedCount: integer("failed_count").notNull().default(0),
  lockedUntil: timestamp("locked_until"),
});
```

### Rate-limit check inside the login Server Action
```typescript
// Source: pattern synthesis — no single official doc covers this exact combination;
// built from @vercel/functions' ipAddress() (official Vercel package) + Drizzle upsert
"use server";
import { ipAddress } from "@vercel/functions";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { loginAttempts } from "@/lib/db/schema";

const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes — Claude's Discretion per CONTEXT.md

export async function loginAction(_prevState: unknown, formData: FormData) {
  const ip = ipAddress(new Request("http://localhost")) ?? "unknown"; // pass real request in practice
  const [row] = await db.select().from(loginAttempts).where(eq(loginAttempts.ipAddress, ip));

  if (row?.lockedUntil && row.lockedUntil > new Date()) {
    return { error: "Too many attempts — try again in a few minutes." }; // D-05 friendly message
  }

  const submitted = formData.get("password")?.toString() ?? "";
  const expected = process.env.APP_PASSWORD!;
  const isValid =
    submitted.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(submitted), Buffer.from(expected));

  if (!isValid) {
    const failedCount = (row?.failedCount ?? 0) + 1;
    await db
      .insert(loginAttempts)
      .values({
        ipAddress: ip,
        failedCount,
        lockedUntil: failedCount >= MAX_ATTEMPTS ? new Date(Date.now() + COOLDOWN_MS) : null,
      })
      .onConflictDoUpdate({
        target: loginAttempts.ipAddress,
        set: {
          failedCount,
          lockedUntil: failedCount >= MAX_ATTEMPTS ? new Date(Date.now() + COOLDOWN_MS) : null,
        },
      });
    return { error: "Incorrect password." };
  }

  // success — reset counter, establish session
  await db.delete(loginAttempts).where(eq(loginAttempts.ipAddress, ip));
  const session = await getSession();
  session.isLoggedIn = true;
  await session.save();
  redirect("/");
}
```
*Tagged `[ASSUMED]` — this is a synthesized pattern combining verified individual pieces
(`ipAddress()`, `timingSafeEqual`, Drizzle upsert), not copied from a single official
example. Thresholds (5 attempts / 15 min) are explicitly Claude's Discretion per
CONTEXT.md.*

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `tailwind.config.js` + `@tailwind base/components/utilities` | `@theme` CSS directive + single `@import "tailwindcss"` in `globals.css` | Tailwind v4 (2025) | Fewer config files; `create-next-app --tailwind` already generates the v4-style setup — no manual migration needed for a greenfield project. |
| iron-session `/next`, `/edge` subpath imports | Single `iron-session` entry point, runtime-agnostic via `iron-webcrypto` | v8 | Removes the historical "edge runtime does not support Node's crypto module" failure class when using iron-session inside `middleware.ts`. |
| `z.string().email()`, `.flatten()`, `error.errors` | `z.email()`, `z.flattenError()`/`z.treeifyError()`, `error.issues` | zod v4 | Old chainable/property patterns are deprecated (still work, but flagged); use the new top-level APIs going forward per CLAUDE.md's locked zod 4.4.3. |
| `NextRequest.ip` | `ipAddress(request)` from `@vercel/functions` | Recent Next.js versions | `request.ip` is unreliable/removed on current Next.js; the official Vercel helper is the current recommended path for IP-based logic (e.g., rate-limit keys) on Vercel deployments. |

**Deprecated/outdated:**
- `react-hook-form` as a default assumption for every form: not needed here — React 19's
  `useActionState` + Server Actions covers this phase's 3-field form without an extra
  dependency (see Alternatives Considered).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | Calling `session.save()` on every valid middleware request achieves the D-02 rolling ~30-day renewal-on-activity behavior | Pattern 1 | Low — worst case, session expires at a fixed interval instead of rolling; user re-enters password more often than desired, no security impact. |
| A2 | The combined rate-limit pattern (Postgres `login_attempts` table + `@vercel/functions` `ipAddress()` + Drizzle upsert) is a sound, sufficient AUTH-04 implementation for a single-user app | Code Examples / Pitfall 3 | Medium — if `ipAddress()` returns `null`/unreliable values behind certain proxy configs, all requests could collapse to one "unknown" IP bucket, which would either over-block (all users share one counter) or under-block (if the fallback bypasses the check). Verify `ipAddress()`'s return value in the actual Vercel deployment during implementation and add a non-null fallback key. |
| A3 | 5 attempts / 15-minute cooldown are reasonable default thresholds | Code Examples | Low — explicitly marked Claude's Discretion in CONTEXT.md; easy to tune later, no correctness risk. |
| A4 | `getIronSession(cookies(), sessionOptions)` (using `next/headers`) works unmodified inside `middleware.ts` on Next.js 16.2.x App Router | Pattern 1, Pitfall 2 | Medium — confirmed by iron-session's own official example repo, but not independently tested against Next.js 16.2.x specifically in this research session (repo example may target an earlier Next version). If it fails during implementation, the `unsealData`/`sealData` direct-cookie fallback path in iron-session's single entry point is the documented escape hatch. |

## Open Questions

1. **Exact IP-extraction behavior of `ipAddress()` when the app is accessed from the
   owner's own home network vs. a potential attacker**
   - What we know: `@vercel/functions`' `ipAddress()` is the officially recommended
     current replacement for the removed/unreliable `NextRequest.ip`.
   - What's unclear: Behavior in edge cases (shared NAT, mobile carrier IP rotation) that
     could affect a single legitimate user more than a would-be attacker, given this is a
     one-person app accessed from a phone/laptop that may rotate IPs.
   - Recommendation: Implement as designed; if the tutor reports being locked out from her
     own device, loosen the threshold or key the limiter differently (e.g., a short-lived
     signed cookie flag combined with the IP check) — low-stakes to adjust post-launch
     given D-05's explicit framing that "the lockout mainly deters bots."

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Next.js 16 runtime (requires ≥ 20.9) | Yes | v25.1.0 | — |
| npm | Package installs | Yes | 11.6.2 | — |
| git | Version control, Vercel deploy trigger | Yes | 2.52.0 | — |
| Vercel CLI (`vercel`) | Optional local `vercel env pull` | No (not installed) | — | Not required — the Vercel dashboard's GitHub integration (push → auto-deploy) plus manually copying `DATABASE_URL`/`APP_PASSWORD` into `.env.local` for local dev is a fully viable fallback, exactly as CLAUDE.md notes ("CLI is a nice-to-have"). |
| Neon account / Vercel account | Hosted DB + deployment | Not verifiable from this environment (requires external account/dashboard access) | — | No fallback — these are user-side prerequisites; flag for the tutor/user to have (or create) Vercel + Neon accounts before the deploy step of the plan. |

**Missing dependencies with no fallback:**
- A live Vercel project + Neon database instance must exist before the deploy step —
  this is an account-creation/dashboard action outside this research session's ability to
  verify, not a code gap. The plan should include an explicit step/checkpoint for this.

**Missing dependencies with fallback:**
- Vercel CLI — fallback via dashboard GitHub integration + manual env var copy, as above.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|-------------------|
| V2 Authentication | Yes | Single shared-secret comparison via `crypto.timingSafeEqual` against `process.env.APP_PASSWORD` (never hashed/salted per CLAUDE.md's explicit reasoning — no user table exists to protect); AUTH-04 rate limiting via the Postgres-backed `login_attempts` table. |
| V3 Session Management | Yes | `iron-session` encrypted, HttpOnly, `Secure` cookie; ~30-day TTL with renew-on-activity (D-02); no session table needed (stateless, sealed cookie is the session store). |
| V4 Access Control | Yes | `middleware.ts` is the single choke point (AUTH-03) — every route except `/login` requires a valid session; there is no per-user access control since the app is single-tenant by design. |
| V5 Input Validation | Yes | `zod` (v4) at every Server Action boundary — student name, rate, and parent email (D-13 format-validated) are validated server-side before any DB write; never trust client-side-only validation. |
| V6 Cryptography | Yes | Session cookie sealing/unsealing is entirely delegated to `iron-session` (never hand-rolled); `crypto.timingSafeEqual` for the constant-time password compare is Node's built-in, standard primitive — not a custom comparison. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| Brute-force password guessing against `/login` | Spoofing | Postgres-backed `login_attempts` rate limiter keyed by client IP (AUTH-04); high-entropy `APP_PASSWORD` env var. |
| Session cookie tampering/forgery | Tampering | `iron-session`'s encrypted+signed cookie — any tampering fails to unseal, treated as no session. |
| Timing attack on password comparison | Information Disclosure | `crypto.timingSafeEqual` (constant-time compare) instead of `===`. |
| Direct route access bypassing the login screen | Elevation of Privilege | `middleware.ts` matcher covers all routes except `/login` and static assets — no route can opt out of the check by omission (deny-by-default via the matcher pattern, not an allow-list per route). |
| SQL injection via student form fields | Tampering | Drizzle ORM's parameterized query builder — no raw string-interpolated SQL anywhere in the Server Actions. |
| CVE-2025-29927-style middleware bypass via `x-middleware-subrequest` header | Elevation of Privilege | Not applicable — Next.js 16.2.10 (locked version) is far past the patched threshold (fixed in 15.2.3); no additional mitigation code required, just staying on the locked version. |

## Sources

### Primary (HIGH confidence)
- [Next.js `create-next-app` CLI docs](https://nextjs.org/docs/app/api-reference/cli/create-next-app) — exact flags, default template contents, Node.js version note (fetched live, version-stamped 16.2.10, lastUpdated 2026-03-03)
- [Drizzle ORM Neon + neon-http setup guide](https://orm.drizzle.team/docs/get-started/neon-new) — installation, schema, `drizzle.config.ts`, `push`/`generate`/`migrate` commands
- [iron-session GitHub repo](https://github.com/vvo/iron-session) + [official Next.js middleware example](https://raw.githubusercontent.com/vvo/iron-session/main/examples/next/src/middleware.ts) — v8 single entry point, `getIronSession` in middleware, password length/TTL requirements
- npm registry (`npm view <pkg> version`, checked 2026-07-03) for all Standard Stack + Supporting packages — confirms zero version drift from CLAUDE.md
- [Zod v4 migration guide](https://zod.dev/v4/changelog) — `z.email()`, `z.flattenError()`/`z.treeifyError()`, `.issues` vs `.errors`
- [Neon Vercel-managed integration docs](https://neon.com/docs/guides/vercel-managed-integration) — env vars auto-injected (`DATABASE_URL`, etc.), dashboard connection flow
- [CVE-2025-29927 GitHub Security Advisory](https://github.com/advisories/GHSA-f82v-jwr5-mffw) and [NVD detail](https://nvd.nist.gov/vuln/detail/CVE-2025-29927) — patched-version thresholds (15.2.3/14.2.25/13.5.9/12.3.5), confirming Next 16.2.10 is unaffected

### Secondary (MEDIUM confidence)
- [Tailwind CSS v4 + Next.js guide](https://tailwindcss.com/docs/guides/nextjs) — PostCSS plugin, `globals.css` `@import` pattern (cross-checked against `create-next-app`'s own `--tailwind` default, which produces this automatically)
- [shadcn/ui Next.js installation docs](https://ui.shadcn.com/docs/installation/next) — init/add command shape (docs snapshot didn't confirm Next 16/React 19-specific prompts, but CLI is version-agnostic in practice per the docs' own framing)
- Vercel `NextRequest.ip` deprecation / `ipAddress()` replacement — cross-referenced across multiple `vercel/next.js` GitHub discussions converging on the same `@vercel/functions` recommendation
- [Vercel Functions limits](https://vercel.com/docs/functions/limitations) — 30s default timeout on Hobby (not a blocker for this phase's CRUD operations)

### Tertiary (LOW confidence)
- The specific rolling-session-via-repeated-`save()`-in-middleware technique (Assumption A1) — reasoned synthesis from iron-session's documented API, not shown verbatim in an official example for this exact use case.
- The combined rate-limit code pattern (Assumption A2) — original synthesis of verified individual pieces, not copied from a single authoritative source.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every version live-confirmed against npm registry, zero drift from CLAUDE.md's own prior research, and slopcheck passed all packages.
- Architecture: HIGH — core patterns (middleware gate, Server Actions, Drizzle+Neon) drawn directly from official docs/repos; the rate-limiter and rolling-session specifics are MEDIUM (flagged as Assumptions A1/A2).
- Pitfalls: HIGH — each pitfall traces to either a documented library behavior (zod v4 breaking changes, iron-session v8 edge fix) or a well-understood serverless architecture constraint (in-memory state not persisting).

**Research date:** 2026-07-03
**Valid until:** 2026-08-03 (30 days — this stack moves at a moderate pace; re-verify npm versions if planning is delayed materially past this window, especially given Next.js/React/Tailwind's active release cadence)
