# Phase 2: Session Logging & Unbilled Dashboard - Context

**Gathered:** 2026-07-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the backward-looking billing input for TutorInvoice: the tutor logs
tutoring sessions that **already happened** against her existing students, can
edit or delete any session, and sees an at-a-glance dashboard of who owes what.
Three capabilities:

1. **Session logging** — log a session (student via name autocomplete, date,
   length, optional notes) against a Phase 1 student.
2. **Session management** — view, edit, and delete any session at any time, with
   money totals recomputing immediately.
3. **Unbilled dashboard** — per-student view of unbilled hours + amount owed,
   excluding billed sessions.

Requirements: SESS-01..05, DASH-01, DASH-02.

**Explicitly out of scope for Phase 2:** invoicing, invoice snapshots, email,
settings/Zelle handle (all Phase 3), and — per this discussion — any scheduling
of future/recurring classes or Zoom-link generation (deferred to a v2 milestone;
see Deferred Ideas).

**Billed-flag note:** Nothing *sets* a session to billed until Phase 3's
invoicing exists. Phase 2 must build the `billed` schema flag and the
"exclude billed from unbilled totals" logic (DASH-02), but in practice every
Phase 2 session is unbilled. Do not build billed/unbilled UI toggles or
billed-session warnings in Phase 2 — the exclusion is a query concern, and the
frozen-snapshot behavior of editing a billed session is a Phase 3 concern.

</domain>

<decisions>
## Implementation Decisions

### Landing & Navigation
- **D-01:** **Roster stays the home page** (`/`). Phase 1's student roster remains
  the landing screen — the Dashboard does NOT replace it. (User considered a
  dashboard-as-home and a sessions-as-home but chose to keep the plain roster.)
- **D-02:** **Top nav with three destinations: Students / Dashboard / Sessions.**
  Students is home with **Archived as a sub-view** (keep the existing
  Students/Archived tab pair nested under Students — do NOT promote Archived to a
  flat top-level nav item). Dashboard = who-owes-what. Sessions = the log of
  everything entered. This replaces the current bare Students/Archived tab strip
  with a proper app-level nav.

### Logging a Session
- **D-03:** **Modal dialog** entry, consistent with the Phase 1 add/edit student
  dialog. A "Log Session" button opens a pop-up form over the current page
  (stay-on-page). Reuse the existing `StudentFormDialog`/shadcn `Dialog` pattern.
- **D-04:** **Student picker = name autocomplete showing `Name — parent email`.**
  Duplicate names are allowed (D-09 from Phase 1), and parent email is unique and
  always present (Phase 1 D-13), so it's the disambiguator. The form must resolve
  the selection to a specific `students.id`, not a name string — two students can
  share a name.
- **D-05:** **Length entered via separate hours + minutes dropdowns** (e.g. 1 hr,
  30 min), NOT a raw decimal field. Convert to decimal hours internally for the
  money computation. Amount = `hours × students.rateCents`, computed in integer
  cents, never floats (SESS-05, Phase 1 D-07). Minutes options should be a
  sensible granularity (e.g. 0/15/30/45).
- **D-06:** **Date defaults to today**, editable via a date picker. Most sessions
  are logged same-day or shortly after.
- **D-07:** **Notes are optional** (SESS-02) — a plain optional text field on the
  same form.

### Managing Sessions (view / edit / delete)
- **D-08:** **Sessions tab is grouped by student** — sessions collapsed/organized
  under each student (expand a student to see their sessions), mirroring the
  roster mental model. (User chose this over a flat chronological list or
  week/date grouping.)
- **D-09:** **Edit reuses the same modal form, pre-filled** with the session's
  current values. Editing student/date/hours/notes is allowed at any time
  (SESS-03) and totals recompute immediately.
- **D-10:** **Delete = quick confirmation dialog, then hard delete.** A small
  "Delete this session?" confirm (like the Phase 1 Archive confirm), then the row
  is removed and totals recompute (SESS-04). Sessions are NOT soft-archived —
  unlike students, individual session rows are low-stakes and don't need a
  recoverable archive view.

### Dashboard Content
- **D-11:** **Per-student rows: unbilled hours + amount owed, expandable to the
  underlying unbilled sessions.** Collapsed by default (glance-able); expanding a
  student reveals the individual unbilled sessions that make up the total, with a
  path to edit one.
- **D-12:** **Show ALL active students, sorted most-owed first**, with $0 students
  falling to the bottom (shown as $0). The full active roster always appears on
  the dashboard, not only those who currently owe. (Archived students are
  excluded, consistent with Phase 1's archive semantics.)
- **D-13:** **Dashboard excludes billed sessions from totals** (DASH-02) — the
  amount-owed and hours figures reflect unbilled sessions only.

### Claude's Discretion
- Exact minutes granularity in the length dropdown (15-min steps suggested).
- Money formatting reuse — the existing `formatRate` (`$X.XX`) pattern in
  `components/student-table.tsx` should be extracted/reused for amounts owed.
- Precise expand/collapse affordance on the dashboard and the grouped-by-student
  layout on the Sessions tab (accordion vs. section headers) — implementation/UI
  choice, following existing shadcn + responsive table→card patterns.
- Whether editing a session is reachable from the Dashboard expansion as well as
  the Sessions tab — allowed, non-blocking.
- Empty states (no sessions logged yet → dashboard shows all students at $0;
  a student with no sessions in the grouped Sessions view) — follow the friendly
  empty-state pattern established in Phase 1 (D-15).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project scope & requirements
- `.planning/ROADMAP.md` §"Phase 2: Session Logging & Unbilled Dashboard" — goal,
  success criteria, dependency on Phase 1.
- `.planning/REQUIREMENTS.md` — SESS-01..05, DASH-01, DASH-02 (Session + Dashboard
  requirement definitions).
- `.planning/PROJECT.md` — core value, single-user/single-password constraint,
  out-of-scope list (reinforces why scheduling/Zoom are deferred).

### Prior phase decisions (carry forward — do NOT re-decide)
- `.planning/phases/01-foundation-auth-gate-student-roster/01-CONTEXT.md` —
  especially D-07 (money as integer cents), D-09 (duplicate student names
  allowed), D-13 (parent email required + unique), D-14 (modal dialog pattern),
  D-10/D-11 (archive-not-delete for students).

### Stack & implementation guidance (LOCKED)
- `CLAUDE.md` — recommended stack (Next.js 16 App Router, React 19, Drizzle ORM +
  Neon Postgres, zod at every Server Action boundary, shadcn/ui, Tailwind v4,
  `date-fns` for session dates). "Supporting Libraries" and "Version
  Compatibility" tables apply directly to this phase's date handling and Server
  Actions.

No external ADRs/specs beyond these — the decisions above are the source of truth.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/db/schema.ts` — Drizzle schema with the `students` table
  (`id serial`, `rateCents integer`, `parentEmail`, `archived boolean`). Phase 2
  adds a **`sessions`** table here: FK `studentId → students.id`, `date`,
  `minutes`/`hours`, optional `notes`, and a `billed boolean default false`.
  Follow the existing integer-cents + comment-annotated style.
- `components/student-form-dialog.tsx` + `components/ui/dialog.tsx` — the modal
  add/edit pattern to clone for the Log Session / edit-session modal (D-03, D-09).
- `components/archive-confirm-dialog.tsx` — the confirm-dialog pattern to clone
  for the delete-session confirmation (D-10).
- `components/student-table.tsx` — responsive **table (md+) → stacked cards
  (mobile)** pattern with a `formatRate` `$X.XX` helper; reuse the layout and
  extract `formatRate` for dashboard amounts and session amounts.
- `lib/actions/students.ts` — the `"use server"` + zod `safeParse` +
  `z.flattenError` + `revalidatePath` Server Action pattern; session
  add/edit/delete actions should mirror it exactly.
- `lib/validation/student.ts` — the zod form-schema location/convention for a new
  `lib/validation/session.ts`.

### Established Patterns
- Server Components read via `db.select()...orderBy(...)`; interactive bits are
  small client components wired to Server Actions. Dashboard and Sessions pages
  should follow this (server-side aggregation for unbilled totals).
- Money: always integer cents, `Math.round(dollars * 100)`, format at the edge.
  Session amount = `hours × students.rateCents` in cents.
- Validation is server-side zod only (Phase 1 added `noValidate` to forms so the
  server is the sole gate — see STATE.md deviation). Keep this for session forms.
- `revalidatePath` after mutations; the roster page revalidates `/` and
  `/archived` — session/dashboard mutations must revalidate their routes too.

### Integration Points
- New `sessions` table references `students.id` — archived students still need
  their historical sessions preserved (don't cascade-delete). Dashboard/Sessions
  should show **active** students; decide handling for sessions belonging to an
  archived student (surface with an "archived" marker rather than hiding history).
- The nav change (D-02) touches `app/page.tsx`'s inlined Students/Archived tab
  strip and `app/archived/page.tsx` — replace with an app-level nav (likely in
  `app/layout.tsx`) exposing Students / Dashboard / Sessions.
- The `billed` flag is written by Phase 3 invoicing; Phase 2 only reads it
  (defaulting all to false) for the DASH-02 exclusion.

</code_context>

<specifics>
## Specific Ideas

- The Dashboard is intended as a "who to invoice next" glance, but the user still
  wants the **full active roster visible** on it ($0 students at the bottom), not
  just debtors — so it doubles as a money-aware roster view.
- Length-in-hours-and-minutes (not decimals) reflects how the tutor thinks about
  lessons ("an hour and a half"), even though the math runs on decimal hours.
- The user's original phrasing was "a list of all students with their classes" —
  which resolved to: roster stays home, and sessions are organized under each
  student on the Sessions tab and expandable per student on the Dashboard.

</specifics>

<deferred>
## Deferred Ideas

**→ v2 milestone (new capability, NOT Phase 2 or the current v1 billing
milestone).** The user raised these and, after discussion, agreed to defer:

- **Scheduling system** — logging/viewing *upcoming* and recurring classes (a
  forward-looking calendar), so the home screen could show each student's next
  lessons. This is a distinct product pillar from billing. Design it deliberately
  in v2, including the **"completed scheduled class → auto-becomes a billable
  session"** synergy (a scheduled event gains a status: scheduled → completed →
  billable), which would eliminate double-entry between scheduling and logging.
  Note the data-model implication: a "session" would shift from
  "logged-after-the-fact" to "scheduled event with a status."
- **Zoom link generation** — auto-generate weekly/per-student Zoom links. Requires
  the **Zoom API** (Server-to-Server OAuth app + credentials + create-meeting
  calls) — the kind of external-service integration v1 deliberately avoided.
  Cheaper zero-integration alternative to evaluate first: reuse the tutor's
  **Zoom Personal Meeting ID** (one permanent link per student/all). Decide
  generate-vs-reuse when this is scoped.
- **New-student onboarding into the schedule** — user mentioned "new students";
  meaning was left unclarified. Revisit alongside the scheduling design (likely
  "add a new student directly while scheduling their first class").

### Reviewed Todos (not folded)
None — there were no pending todos to cross-reference.

Nothing else strayed outside Phase 2 scope.

</deferred>

---

*Phase: 2-session-logging-unbilled-dashboard*
*Context gathered: 2026-07-03*
