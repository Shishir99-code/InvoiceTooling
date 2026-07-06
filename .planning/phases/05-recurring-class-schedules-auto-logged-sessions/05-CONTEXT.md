# Phase 5: Recurring Class Schedules & Auto-Logged Sessions - Context

**Gathered:** 2026-07-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Give the tutor a forward-looking layer on top of the existing backward-looking
session log: she defines each student's **typical weekly class slots** (weekday
+ start time + duration), and a **daily background job auto-logs a session** for
each slot on its class day — so her only remaining work is editing the
exceptions (a class that was cancelled, rescheduled, or ran long/short).

Four capabilities:

1. **Recurring slots (SCHED-01/02)** — define multiple weekly slots per student
   (weekday + start time + duration); edit or remove any slot.
2. **Auto-logging (SCHED-03)** — on each scheduled class day, the daily job
   inserts a `sessions` row for that slot, amount computed from the student's
   **current** rate in integer cents, in the tutor's timezone. Idempotent — a
   re-run never double-logs.
3. **Distinguishable + editable auto-sessions (SCHED-04)** — auto-logged sessions
   are visibly marked vs. manual, and are fully editable/deletable like any
   session when a class deviates.
4. **Secure cron endpoint** — the daily job is a route reachable by the scheduler
   with a `CRON_SECRET` bearer check, bypassed from the login gate, never
   publicly triggerable.

**Explicitly out of scope for Phase 5:**
- **Scheduled invoicing / invoice cadence** — that is Phase 6 (RINV-01..04). This
  phase only auto-creates *sessions*, never invoices.
- Any calendar/agenda view of *upcoming* classes as a product surface — the slots
  drive auto-logging; a full forward calendar UI is not required. (A simple
  per-student list of slots is in scope; a week/month calendar grid is not.)
- Rewriting how manual session logging, editing, deleting, or the dashboard work
  (Phase 2) — auto-sessions flow through the *same* `sessions` table and reuse
  those surfaces.
- Notifications/reminders about upcoming classes — not requested.

</domain>

<decisions>
## Implementation Decisions

### Schedule management surface (SCHED-01/02)
- **D-01:** **Per-student "Weekly schedule" section.** Slots are created, edited,
  and removed in a schedule area attached to each student (on the student's
  page/card), not in a separate global Schedules page and not crammed into the
  add/edit student modal. Keeps a student's recurring classes next to their other
  info and matches the per-student mental model established in Phase 2 (sessions
  grouped by student). A student can have **multiple** slots (SCHED-01).
- **D-02:** **A slot is entered as weekday + start time + hours/minutes
  duration.** Reuse the existing Phase 2 length pattern — the same hours+minutes
  dropdowns used when logging a session (`durationMinutes` internally) — plus a
  weekday selector and a start-time picker (e.g. 3:30 PM). Start time is stored so
  the class day/time is unambiguous in the tutor's timezone; end time is derived,
  not entered. (Start+end-time entry was considered and rejected in favor of
  reusing the established hrs/min control.)

### Marking auto-logged sessions (SCHED-04)
- **D-03:** **Icon marker, not a text badge.** Auto-logged sessions are
  distinguished by a small icon (e.g. a repeat/recurring or clock glyph) wherever
  sessions appear (Sessions tab, dashboard expansion), rather than an "Auto" text
  badge or a separate visual grouping. Compact and unobtrusive. Claude's
  discretion on the exact glyph + tooltip/label for accessibility.
- **D-04:** **No default note; the slot→session link is tracked internally.**
  Auto-logged sessions leave `notes` blank (the tutor adds a note only if the
  class deviated — keeps notes meaningful). The session records **which slot
  created it** in the database (needed for dedup/idempotency and for the icon
  marker), but that link is not surfaced as user-visible note text. Requires a
  new column on `sessions` (e.g. `scheduleSlotId` FK, or a `source`
  enum + slot ref) — planner/researcher to choose the exact shape; it must
  support both "this row is auto" (for the marker) and the idempotency model in
  D-05/D-06.

### Cancelled / changed-class flow (SCHED-03/04 — the tricky semantics)
- **D-05:** **A deleted auto-session STAYS deleted — the cron never re-creates
  it.** When the tutor deletes an auto-logged session because the class was
  cancelled, the next daily run must NOT re-insert it. This means idempotency
  **cannot** be "does a session row exist for this slot+date?" (deleting the row
  would make the cron re-create it). Instead the app must **durably record which
  (slot, date) pairs have already been processed** — e.g. a per-slot
  "logged-through" high-water-mark date, or a persistent processed-occurrences
  ledger — independent of whether the resulting session row still exists.
  Planner/researcher to pick the mechanism; the invariant is: **process each
  (slot, calendar-date) exactly once, ever.**
- **D-06:** **Editing or removing a slot only affects FUTURE auto-logs — past
  auto-logged sessions stay frozen.** Consistent with the frozen-snapshot
  principle everywhere else (P2 D-14 frozen session amount, P3 frozen invoice).
  Changing a slot's time/duration, or deleting the slot, must not rewrite or
  delete sessions already logged from it. Already-logged rows keep their stored
  `durationMinutes`/`amountCents`. (Backward propagation was explicitly
  rejected — it would silently mutate billing history.) Note the FK
  implication: deleting a slot must not cascade-delete its historical sessions —
  mirror the existing `onDelete: "restrict"`/`"set null"` discipline on
  `sessions` FKs (do not cascade slot deletion into sessions).

### Cron timing & backfill (SCHED-03)
- **D-07:** **Runs once daily, early morning in the tutor's timezone.** The job
  fires ~2–6 AM local (her `settings.timezone`), logging that day's scheduled
  classes before the day starts so they're ready when she opens the app.
  Implementation note: Vercel Cron schedules are **UTC** — the schedule must be
  chosen so it lands in the early-morning local window (and be mindful this
  drifts by an hour across US DST). The *class-day resolution itself* uses
  `settings.timezone` (the reason SET-03 was captured in Phase 4), NOT the
  server/UTC day.
- **D-08:** **Catch-up missed days, but no retroactive backfill for new slots.**
  Each run logs every **un-processed** past class day up to today (so a gap from
  downtime or a skipped cron self-heals via the D-05 high-water-mark). A
  **newly-added slot starts logging from its creation date forward** — it does
  NOT retroactively create sessions for weeks before the slot existed. So each
  slot needs an **effective start date = when it was created** (Claude's
  discretion whether to also support an optional explicit start; an optional
  end/"until" date is not required — the tutor removes the slot when a student
  stops). "Today only, no catch-up" and "user-set backfill since date" were both
  rejected.

### Cron endpoint security (Success Criterion 4)
- **D-09:** **`CRON_SECRET` bearer check + login-gate bypass.** The daily job is
  an unauthenticated-by-session route (e.g. `/api/cron/auto-log`) that:
  - is **exempted from `middleware.ts`** (the iron-session login gate) so the
    scheduler can reach it without a session cookie — add it to the middleware
    matcher's negative-lookahead exclusions alongside `login`/`_next`;
  - **rejects any caller** whose `Authorization: Bearer <CRON_SECRET>` (or the
    Vercel-injected cron header) doesn't match `process.env.CRON_SECRET`,
    returning 401 — so bypassing the login gate does NOT make it publicly
    triggerable. `CRON_SECRET` lives in Vercel env vars, never in code (same
    discipline as `APP_PASSWORD`). Constant-time compare preferred.
  - Uses `vercel.json` `crons` config (none exists yet — this phase adds it).

### Claude's Discretion
- Exact `sessions` schema shape for the auto/slot link (D-04) — `scheduleSlotId`
  FK vs. `source` enum + ref — as long as it supports the marker and D-05.
- The new `class_slots`/`schedule_slots` table name and columns (studentId FK,
  weekday, startTime, durationMinutes, effective-start, created-at) and the
  high-water-mark storage shape (D-05/D-08).
- Exact icon glyph + accessible label/tooltip for auto-sessions (D-03).
- Exact early-morning UTC cron expression in `vercel.json` and how DST drift is
  handled (D-07) — subject to researcher confirmation.
- Whether the per-student schedule section is inline-expanded or a small
  sub-view; the add/edit-slot control (modal vs. inline row), following existing
  shadcn dialog + responsive table→card patterns.
- Whether to also expose a manual "run now"/backfill trigger for testing (nice to
  have, not required).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project scope & requirements
- `.planning/ROADMAP.md` §"Phase 5: Recurring Class Schedules & Auto-Logged
  Sessions" — goal, the 4 success criteria (esp. SC2 idempotency + integer-cents
  amount, SC4 `CRON_SECRET` + login-gate bypass), dependencies on Phase 4
  (timezone) and Phase 2 (sessions model).
- `.planning/REQUIREMENTS.md` — SCHED-01, SCHED-02, SCHED-03, SCHED-04. **Note:**
  RINV-01..04 (scheduled *invoicing*) are Phase 6 — do NOT pull them in.
- `.planning/PROJECT.md` — single-user/single-password, client-side-email-only,
  out-of-scope list.

### Prior phase decisions (carry forward — do NOT re-decide)
- `.planning/phases/04-quick-wins-auto-open-email-zoom-links-timezone/04-CONTEXT.md`
  — **D-11/D-12** (`settings.timezone` IANA string captured for exactly this
  phase's class-day resolution; validate as a recognized IANA zone). This is the
  consumer Phase 4 was building for.
- `.planning/phases/02-session-logging-unbilled-dashboard/02-CONTEXT.md` —
  **D-14** (frozen `amountCents` snapshot at write time — auto-log computes once
  and freezes, later rate changes don't retro-alter → underpins D-06), **D-05**
  (amount = `round(durationMinutes × rateCents / 60)` integer cents — the cron
  MUST reuse this exact formula), **D-08/D-10** (sessions grouped by student;
  hard-delete sessions — a deleted auto-session is a hard delete, see D-05),
  the `sessions` schema and `date` string-mode (TZ-safe) convention.
- `.planning/phases/01-foundation-auth-gate-student-roster/01-CONTEXT.md` — the
  iron-session gate + `middleware.ts` choke-point pattern that D-09 must
  carve a `CRON_SECRET` exception into; server-side-zod + `noValidate` forms.

### Stack & implementation guidance (LOCKED)
- `CLAUDE.md` — recommended stack (Next.js 16 App Router, React 19, Drizzle +
  Neon, zod at every Server Action boundary, shadcn/ui, Tailwind v4, `date-fns`
  for date math). §"Single Shared-Password Gate" (constant-time compare, secrets
  in env not code — the `CRON_SECRET` check mirrors this), and the CVE-2025-29927
  middleware-bypass note (relevant because D-09 modifies the middleware matcher).
  Vercel Cron is the deployment target for the daily job.

### Existing code (read before editing)
- `lib/db/schema.ts` — `students`, `sessions`, `settings` (has `timezone`),
  `invoices`. Phase 5 adds a schedule-slots table + a `sessions` auto/slot link.
- `lib/actions/sessions.ts` — the exact amount formula + insert pattern the cron
  reuses server-side.
- `middleware.ts` — the login-gate matcher D-09 must add the cron route to.

No external ADRs/specs beyond these — the decisions above are the source of truth.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/actions/sessions.ts` — `amountCents = Math.round(durationMinutes ×
  student.rateCents / 60)` and the `db.insert(sessions).values({...})` shape.
  **The cron auto-log path must reuse this exact computation** (re-fetch the
  student's *current* `rateCents` at run time, never trust a stored value) so
  auto-sessions are indistinguishable from manual ones at the data level.
- `lib/validation/session.ts` — zod convention/location; a new
  `lib/validation/schedule.ts` (or `slot.ts`) follows it for slot form fields.
- `components/student-form-dialog.tsx` + `components/ui/dialog.tsx` — modal
  add/edit pattern to clone for add/edit-slot (D-01/D-02).
- `components/student-table.tsx` — responsive table→card + `formatRate` helper;
  the per-student "Weekly schedule" section (D-01) attaches at the student level.
- The Phase 2 hours+minutes duration control (in the session form) — reuse for
  slot duration (D-02).
- `lib/session.ts` + `middleware.ts` — the iron-session gate to carve the
  `CRON_SECRET` exemption into (D-09).

### Established Patterns
- **Money is integer cents, frozen at write time** (P2 D-14) — auto-log freezes
  `amountCents` once; slot edits never re-touch past rows (D-06).
- **`sessions.date` is `date` mode `"string"`** to avoid TZ shift — class-day
  resolution computes the local calendar date from `settings.timezone` and stores
  that string; do NOT let UTC `Date` objects introduce off-by-one days.
- **Server-side zod only**, `"use server"` files export only async functions,
  `revalidatePath` after every mutation (slot CRUD revalidates the student view;
  auto-log revalidates `/sessions` and `/dashboard`).
- **FK discipline:** `sessions` FKs use `onDelete: "restrict"`/`"set null"`,
  never cascade — the new slot→session relationship must likewise NOT
  cascade-delete history when a slot is removed (D-06).

### Integration Points
- **New schedule-slots table** in `lib/db/schema.ts` (studentId FK, weekday,
  startTime, durationMinutes, effective/created dates) → a `drizzle-kit` schema
  push is required (memory: live Neon schema is applied via push; coordinate with
  the deploy state — see `[[deploy-phase3-after-gap-fix]]`).
- **`sessions` gains an auto/slot marker column** (D-04) → same schema push.
- **New cron route** (e.g. `app/api/cron/auto-log/route.ts`) + **`vercel.json`
  `crons`** (file does not exist yet) + **`middleware.ts` matcher change** +
  **`CRON_SECRET` env var** on Vercel.
- **Timezone consumer:** `settings.timezone` (nullable) — the job needs a defined
  behavior when timezone is unset (fallback default, e.g. the Phase 4
  `America/New_York` default, or skip with a warning). Planner to decide.

</code_context>

<specifics>
## Specific Ideas

- The core value framing: get the tutor from "these classes recur every week" to
  "the sessions are just *there* each day, and I only touch the exceptions." The
  auto-log should feel like it quietly did the data entry for her overnight
  (hence the early-morning run, D-07).
- The cancellation flow is the emotional core of SCHED-04: she deletes a session
  because "that class didn't happen," and it must **stay** gone (D-05) — fighting
  a cron that keeps re-adding a cancelled class would defeat the whole feature.
- Auto and manual sessions deliberately share one `sessions` table and all its
  Phase 2/3 machinery (dashboard totals, invoicing, editing) — the only
  difference is a marker + provenance, so downstream billing "just works."

</specifics>

<deferred>
## Deferred Ideas

- **Scheduled invoicing / invoice cadence (RINV-01..04)** — Phase 6. This phase
  stops at auto-*sessions*; auto-*invoices* are next. Do not conflate.
- **Full forward calendar/agenda UI** — a week/month grid of upcoming classes.
  Not needed for auto-logging; a plain per-student slot list suffices for v1.
  Revisit only if the tutor wants to *see* her upcoming week visually.
- **Optional per-slot end/"until" date** — not built; the tutor removes a slot
  when a student stops. Could add later if recurring-with-end-date is wanted.
- **Manual "run now"/backfill-since-date trigger** — considered under D-08 and
  left as an optional testing nicety (Claude's discretion), not a committed
  requirement. Full user-set retroactive backfill was rejected for v1.
- **Reminders/notifications for upcoming classes** — out of scope; no notification
  infrastructure in this app.

### Reviewed Todos (not folded)
None — there were no pending todos to cross-reference.

Discussion stayed within Phase 5 scope (scheduled invoicing creep redirected to
Phase 6).

</deferred>

---

*Phase: 5-recurring-class-schedules-auto-logged-sessions*
*Context gathered: 2026-07-06*
