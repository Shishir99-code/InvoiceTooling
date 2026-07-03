# Phase 1: Foundation — Auth Gate & Student Roster - Context

**Gathered:** 2026-07-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a password-gated, always-on deployed app where the single business owner
logs in once per device and manages her student roster. Two capabilities:

1. **Access gate** — one shared-password box protecting every route except the
   login screen; rate-limited against brute force; a secure session that persists
   across refreshes.
2. **Student roster CRUD** — add, view, edit, and archive students (name, hourly
   rate, parent/guardian email).

New capabilities (session logging, dashboards, invoicing, settings, email) belong
to Phases 2–3 and are out of scope here.

</domain>

<decisions>
## Implementation Decisions

### Access / Auth Gate
- **D-01:** Single shared-password gate — exactly **one password box**. No accounts,
  no usernames, no signup, no password-reset flow. The user explicitly rejected any
  "login/sign-in/sign-up" *account system*; the single shared secret is kept because
  the app is deployed to a public URL and it's the only thing keeping student names,
  rates, and parent emails private. (Confirms PROJECT.md's single-shared-password
  constraint; AUTH-01..04 all stand.)
- **D-02:** Session persists **~30 days per device**, renewing on activity. She should
  effectively never re-type the password on her own phone/laptop within normal use.
- **D-03:** **No logout button** — her own devices, one shared secret; a logout control
  is unnecessary UI. (If ever needed she can clear cookies.)
- **D-04:** Visitors who already hold a valid session **skip the login screen** and land
  directly on the student roster.
- **D-05:** When repeated wrong-password attempts trip the rate limit, show a **friendly
  wait message** ("Too many attempts — try again in a few minutes"), not a scary/opaque
  error. The lockout mainly deters bots.

### Student Roster — Display
- **D-06:** Each roster row shows **name + hourly rate + parent email** (all three
  visible). Note: parent email is now required (see D-13), so every row has one.
- **D-07:** Hourly rate is **entered as plain dollars** (type `50` → displayed `$50.00`).
  Stored as **integer cents** in the DB (never floats) — matches SESS-05's money rule
  that Phase 2 depends on.
- **D-08:** Roster sorted **alphabetically by student name**.
- **D-09:** **Duplicate names allowed** — no blocking, no forced uniqueness. She
  distinguishes them herself; later phases use autocomplete.

### Student Roster — Remove / Archive
- **D-10:** Removal **always archives** (soft-hide) — students are **never hard-deleted**.
  Build the archive/soft-delete flag **now** in Phase 1 (not deferred), so the
  history-preserving behavior Phases 2–3 require "just works" and accidental removals
  are recoverable. Archived students drop out of the main roster list.
- **D-11:** Provide a way to **view archived students and restore** them (e.g. an archived
  filter/view with a restore action) — covers the "oops" case and returning students.
- **D-12:** Archiving shows a **quick confirmation** ("Archive [name]?") before removing.

### Student Roster — Add / Edit Form
- **D-13:** ⚠ **SPEC CHANGE — parent/guardian email is REQUIRED** (not optional). A
  student cannot be saved without a valid parent email. This **overrides STUD-01**
  ("optional parent/guardian email") and the roadmap Phase 1 success criterion wording.
  Email must pass **format validation**, not just non-empty. Downstream impact: Phase 3's
  MAIL-04 "graceful guard when a student has no parent email" becomes **unnecessary** —
  every student is guaranteed a recipient. (See Deferred Ideas for the required
  ROADMAP.md / REQUIREMENTS.md update.)
- **D-14:** Add/edit happens in a **pop-up modal dialog** over the roster (stay-on-page),
  not a separate route or inline row. Works on mobile.
- **D-15:** First run (zero students) shows a **friendly empty state** — "No students yet
  — add your first student to get started" — with a prominent Add button.
- **D-16:** Validation shows **inline field errors and blocks save** until fixed
  (e.g. "Enter a name", "Rate must be a positive number", "Enter a valid email").
  Blank name and non-numeric/negative rate are invalid.

### Claude's Discretion
- Exact rate-limit thresholds/window (attempts + cooldown duration) — pick sensible
  defaults for a single low-traffic user.
- Precise archived-view affordance (toggle vs. filter vs. separate section) and modal
  layout details — implementation/UI choice.
- Cookie/session mechanics (renewal-on-activity implementation) — per iron-session
  recommendation in CLAUDE.md.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project scope & requirements
- `.planning/ROADMAP.md` §"Phase 1" — phase goal, success criteria, dependencies.
- `.planning/REQUIREMENTS.md` — AUTH-01..04, STUD-01..04 (note STUD-01 is overridden
  by D-13: parent email is now required).
- `.planning/PROJECT.md` — core value, single-shared-password constraint, out-of-scope list.

### Stack & implementation guidance (LOCKED — do not re-decide)
- `CLAUDE.md` — full recommended stack and the reasons. Directly relevant to Phase 1:
  - "Single Shared-Password Gate — Implementation Pattern" section (env var `APP_PASSWORD`,
    `crypto.timingSafeEqual`, `iron-session` encrypted HttpOnly/Secure cookie,
    `middleware.ts` choke point, minimal rate limiting, CVE-2025-29927 note).
  - "Recommended Stack" table — Next.js 16.2.x App Router, React 19.2.x, TypeScript,
    PostgreSQL via Neon, Drizzle ORM (+ drizzle-kit), Tailwind v4, shadcn/ui.
  - "Supporting Libraries" — `zod` at every Server Action boundary, `iron-session` 8.0.x,
    `@neondatabase/serverless`, `date-fns`.
  - "What NOT to Use" — no NextAuth/Auth.js/Clerk, no MongoDB, no PDF libs.

No additional external ADRs/specs exist for this phase — decisions above are the source
of truth beyond these files.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **None yet** — greenfield repo. Working tree contains only `CLAUDE.md` and `.planning/`;
  no `package.json`, no source. Phase 1 includes initial project scaffolding
  (`create-next-app`, Drizzle schema, Neon wiring, shadcn/ui init).

### Established Patterns
- None established yet. Phase 1 sets the foundational patterns (Server Actions + zod
  validation boundary, Drizzle schema, iron-session middleware gate, shadcn/ui components)
  that Phases 2–3 will follow.

### Integration Points
- The `middleware.ts` auth gate built here protects **every** route added in later phases.
- The students table (with archive flag + integer-cents rate) is the anchor Phase 2's
  sessions reference and Phase 3's invoices roll up from — schema choices here have
  downstream impact (esp. integer-cents money, soft-delete archive).

</code_context>

<specifics>
## Specific Ideas

- Money stored as **integer cents** everywhere (owner types plain dollars; app formats
  `$X.XX`). Reinforces SESS-05 for Phase 2 — established here at the students.rate level.
- Archive-not-delete is a **deliberate data-safety choice**, built now rather than
  retrofitted, even though no session/invoice history exists yet in Phase 1.

</specifics>

<deferred>
## Deferred Ideas

- **ROADMAP.md / REQUIREMENTS.md update needed (follow-up):** Per D-13, parent email is
  now **required**. Update STUD-01 wording (drop "optional"), the Phase 1 success-criterion
  wording, and reconsider Phase 3's MAIL-04 (the "no parent email" graceful guard is now
  moot). Not blocking Phase 1 planning, but should be reconciled so the roadmap matches
  the built behavior. Use `/gsd-phase` or a REQUIREMENTS.md edit.

None of the discussion strayed into other phases' capabilities (sessions, dashboard,
invoicing, email, settings all correctly deferred to Phases 2–3).

</deferred>

---

*Phase: 1-foundation-auth-gate-student-roster*
*Context gathered: 2026-07-03*
