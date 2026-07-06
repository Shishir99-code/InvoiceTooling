# Roadmap: TutorInvoice

## Overview

TutorInvoice ships as three usable, end-to-end vertical slices rather than horizontal technical layers. **Phase 1** gets the tutor through a secure, rate-limited login into a live, deployed app where she can build out her student roster — the foundation every later phase depends on. **Phase 2** lets her log real tutoring sessions against those students (autocomplete-driven) and see, at a glance, who owes what on an unbilled-hours dashboard. **Phase 3** closes the loop: she sets her Zelle handle and message template, turns unbilled sessions into a frozen invoice snapshot, emails it to a parent via her own email client (with a copy-to-clipboard fallback), and can look back at every invoice she's ever sent. Settings land in Phase 3, exactly where they're first needed to render real invoice text. Auth hardening (rate limiting, secure session cookies) lands in Phase 1, where the shared-password gate is built and immediately protects every route that follows.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation — Auth Gate & Student Roster** - Tutor logs into a deployed, password-gated app and manages her student roster (completed 2026-07-04)
- [x] **Phase 2: Session Logging & Unbilled Dashboard** - Tutor logs sessions against students and sees who owes what at a glance (completed 2026-07-05)
- [x] **Phase 3: Invoicing, Email & History** - Tutor turns unbilled sessions into an emailed invoice and can review past invoices (completed 2026-07-06)

### Milestone v1.1 — Scheduling & Automation

- [ ] **Phase 4: Quick Wins — Auto-Open Email, Zoom Links & Timezone** - Generating opens the email draft automatically, each student carries a Zoom link, and the local timezone is set for scheduling
- [ ] **Phase 5: Recurring Class Schedules & Auto-Logged Sessions** - Per-student weekly class schedules auto-log sessions daily via a secured cron, editable on deviation
- [ ] **Phase 6: Scheduled Invoice Generation** - Invoices auto-generate on a configurable cadence for students with unbilled sessions; still sent manually

## Phase Details

### Phase 1: Foundation — Auth Gate & Student Roster

**Goal**: Tutor can securely reach a deployed, always-on app and build out her student roster — the foundation every later phase depends on.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, STUD-01, STUD-02, STUD-03, STUD-04
**Success Criteria** (what must be TRUE):

  1. User can unlock the app by entering the single shared password and stays logged in across page refreshes via a secure (HttpOnly/Secure) session cookie.
  2. Every page except the login screen is inaccessible without a valid session; repeated wrong-password attempts are rate-limited to deter brute force.
  3. User can add a student (name, hourly rate, required parent/guardian email — required per CONTEXT D-13), view the full student list, and edit any student's name, rate, or parent email.
  4. User can remove a student — students with existing session or invoice history are archived rather than deleted, so history is preserved.

**Plans**: 5 plansPlans:
**Wave 1**

- [x] 01-01-PLAN.md — Scaffold Next.js + Drizzle/Neon + schema (students, login_attempts) + schema push

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Auth gate slice: login Server Action + rate limiter + middleware + protected roster read

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03-PLAN.md — Student roster CRUD: add/edit/view via zod-validated Server Actions + shadcn modal

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 01-04-PLAN.md — Archive & restore: soft-delete flow + confirm dialog + archived view/tabs

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 01-05-PLAN.md — Deploy to Vercel + end-to-end production verification

**UI hint**: yes

### Phase 2: Session Logging & Unbilled Dashboard

**Goal**: Tutor can log tutoring sessions against her students and see, at a glance, who owes what.
**Mode:** mvp
**Depends on**: Phase 1 (needs students to exist for autocomplete; needs the auth gate protecting this new surface)
**Requirements**: SESS-01, SESS-02, SESS-03, SESS-04, SESS-05, DASH-01, DASH-02
**Success Criteria** (what must be TRUE):

  1. User can log a session by selecting a student via name autocomplete, plus date and hours, with optional notes.
  2. User can edit or delete any session at any time — including already-billed ones — with totals recomputing immediately; session amounts are always computed as hours × the student's hourly rate stored as integer cents (never floats, no rounding drift).
  3. Dashboard shows each student's total unbilled hours and amount owed at a glance.
  4. Billed sessions are excluded from the unbilled totals shown on the dashboard.

**Plans**: 3 plans
Plans:
**Wave 1**

- [x] 02-01-PLAN.md — Foundation + nav shell: sessions table + schema push, shadcn combobox/select/popover/calendar, lib/format helpers, app/(app) route group + top nav (SESS-01, SESS-05)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-02-PLAN.md — Session logging & management: zod validation + add/edit/delete Server Actions (server-side money integrity) + Log Session modal (combobox/date/hours-minutes/notes) + grouped-by-student Sessions page (SESS-01..05)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 02-03-PLAN.md — Unbilled dashboard: LEFT JOIN + GROUP BY + FILTER aggregate (all active students, most-owed-first, billed excluded) + expandable DashboardTable with edit path (DASH-01, DASH-02)

**Gap Closure** *(post-verification, CR-01)*

- [x] 02-04-PLAN.md — Fix dialog auto-close on 2nd+ consecutive session/student save (CR-01 closed, human-verified)

**UI hint**: yes

### Phase 3: Invoicing, Email & History

**Goal**: Tutor can turn unbilled sessions into an invoice, email it to a parent, and look back at everything she's billed.
**Mode:** mvp
**Depends on**: Phase 2 (needs sessions + the unbilled concept to generate an invoice; settings land here because this is where they're first consumed)
**Requirements**: SET-01, SET-02, INV-01, INV-02, INV-03, INV-04, MAIL-01, MAIL-02, MAIL-03, MAIL-04, HIST-01, HIST-02
**Success Criteria** (what must be TRUE):

  1. User can set and edit her Zelle handle and an editable email/invoice message template that fills into every invoice send.
  2. User can generate an invoice for a student that totals all their unbilled sessions into a copyable text summary.
  3. Generating an invoice atomically marks its sessions as billed and freezes the invoice as an immutable point-in-time snapshot (line items, rendered text, and total frozen at generation) — editing or deleting a billed session afterward never alters that past invoice.
  4. User can open a pre-filled email draft in their own email client addressed to the student's parent (invoice summary + Zelle instructions from the template), with a copy-to-clipboard fallback when the email client is unavailable or the body is too long, and a graceful guard when a student has no parent email on file.
  5. User can view a log of every previously generated invoice and open any one to see its frozen snapshot (student, sessions, total, generated date).

**Plans**: 5 plans (4 original + 1 gap-closure)
Plans:
**Wave 1**

- [x] 03-01-PLAN.md — Foundation schema (invoices + settings + sessions.invoiceId) + push, and the Settings slice: Zelle handle + editable subject/body templates (SET-01, SET-02)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 03-02-PLAN.md — Generate & freeze invoice: atomic db.batch snapshot + mark-billed, preview-then-confirm modal, Dashboard trigger, shared invoice view + copy, /history/[id] route (INV-01..04, MAIL-03)

**Wave 3** *(blocked on Wave 2 completion; two plans run in parallel — no shared files)*

- [x] 03-03-PLAN.md — Gmail compose email handoff + over-length guard + delete/un-bill recovery (MAIL-01, MAIL-02, MAIL-04)
- [x] 03-04-PLAN.md — Invoice History log (flat newest-first) + open-snapshot view reuse + notes-are-parent-facing hint (HIST-01, HIST-02)

**Wave 4** *(gap closure — blocked on Wave 2; re-touches lib/actions/invoices.ts from 03-02)*

- [x] 03-05-PLAN.md — Gap closure: atomic invoice generation (single db.batch, double-billing guard) + rendered_subject->text + Settings .max bounds (INV-03; WR-01/WR-02/WR-03)

**UI hint**: yes

### Phase 4: Quick Wins — Auto-Open Email, Zoom Links & Timezone

**Goal**: Ship two low-risk wins immediately — generating an invoice auto-opens the email draft, and each student carries a Zoom link — and lay the scheduling foundation by capturing the tutor's local timezone.
**Depends on**: Phase 3 (invoice generate + email flow; student model; settings)
**Requirements**: MAIL-05, ZOOM-01, ZOOM-02, SET-03
**Success Criteria** (what must be TRUE):

  1. Generating an invoice automatically opens the pre-filled email draft in the tutor's own client (surviving the Server Action round-trip without being blocked as a pop-up); sending stays client-side — nothing app-sent.
  2. User can set and edit a Zoom link per student, and the link is surfaced where relevant (session view and/or invoice via a `{zoom}` template token).
  3. User can set her local (IANA) timezone in Settings; it is the timezone downstream scheduling and invoice cadence use to determine the correct calendar day.

**Plans**: 4 plans
Plans:
**Wave 1**

- [ ] 04-01-PLAN.md — Schema foundation: nullable `students.zoomLink` + `settings.timezone` + `drizzle-kit push` [BLOCKING] (ZOOM-01, SET-03)
- [ ] 04-02-PLAN.md — MAIL-05 auto-open: widen `generateInvoiceAction` return + pop-up-safe window-handle auto-open in `invoice-preview-dialog.tsx` (MAIL-05)

**Wave 2** *(blocked on 04-01 schema push)*

- [ ] 04-03-PLAN.md — Zoom link: optional http(s) validation + student modal field + persist + built-in Zoom email + roster `Send Zoom link` button (ZOOM-01, ZOOM-02)
- [ ] 04-04-PLAN.md — Timezone capture: US shortlist + IANA validator + Settings Select (browser-detect default) + persist (SET-03)

**UI hint**: yes

### Phase 5: Recurring Class Schedules & Auto-Logged Sessions

**Goal**: The tutor sets each student's typical weekly class slots and the app auto-logs those sessions on the class day, leaving her to only edit the exceptions.
**Depends on**: Phase 4 (local timezone for correct class-day resolution), Phase 2 (sessions model)
**Requirements**: SCHED-01, SCHED-02, SCHED-03, SCHED-04
**Success Criteria** (what must be TRUE):

  1. User can define multiple recurring weekly class slots per student (weekday + start time + duration) and edit or remove any of them.
  2. On each scheduled class day, the app auto-logs a session for that slot in the tutor's timezone, with the amount computed from the student's current rate (integer cents); a re-run of the daily job never creates a duplicate (idempotent).
  3. Auto-logged sessions are visibly distinguishable from manually-logged ones and are fully editable/deletable like any session when a class deviates (cancelled, rescheduled, ran long/short).
  4. The daily cron endpoint is reachable by the scheduler but rejects unauthenticated callers (via `CRON_SECRET`) and stays bypassed from the login gate — it is never publicly triggerable.

**Plans**: TBD — run `/gsd-plan-phase 05`
**UI hint**: yes

### Phase 6: Scheduled Invoice Generation

**Goal**: Invoices generate themselves on a cadence the tutor chooses, for every student who owes, while she stays in control of sending.
**Depends on**: Phase 5 (cron dispatcher + `CRON_SECRET` + middleware allowlist), Phase 3 (atomic invoice generation + double-billing guard)
**Requirements**: RINV-01, RINV-02, RINV-03, RINV-04
**Success Criteria** (what must be TRUE):

  1. User can set how often invoices are generated automatically (e.g. monthly on a chosen day-of-month).
  2. On the cadence day, the app auto-generates an invoice snapshot for each student with unbilled sessions, reusing the existing atomic generation; students with no unbilled sessions are skipped, no session is double-billed, and the cadence cannot fire twice within one window.
  3. User can adjust the session timeframe an invoice covers when generating (default = all currently-unbilled sessions).
  4. Auto-generated invoices are never auto-sent — they appear in Invoice History for the tutor to review and send with one click.

**Plans**: TBD — run `/gsd-plan-phase 06`
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation — Auth Gate & Student Roster | 5/5 | Complete    | 2026-07-04 |
| 2. Session Logging & Unbilled Dashboard | 4/4 | Complete    | 2026-07-05 |
| 3. Invoicing, Email & History | 5/5 | Complete   | 2026-07-06 |
| 4. Quick Wins — Auto-Open Email, Zoom Links & Timezone | 0/– | Not started | — |
| 5. Recurring Class Schedules & Auto-Logged Sessions | 0/– | Not started | — |
| 6. Scheduled Invoice Generation | 0/– | Not started | — |
