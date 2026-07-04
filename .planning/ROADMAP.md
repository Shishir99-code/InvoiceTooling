# Roadmap: TutorInvoice

## Overview

TutorInvoice ships as three usable, end-to-end vertical slices rather than horizontal technical layers. **Phase 1** gets the tutor through a secure, rate-limited login into a live, deployed app where she can build out her student roster — the foundation every later phase depends on. **Phase 2** lets her log real tutoring sessions against those students (autocomplete-driven) and see, at a glance, who owes what on an unbilled-hours dashboard. **Phase 3** closes the loop: she sets her Zelle handle and message template, turns unbilled sessions into a frozen invoice snapshot, emails it to a parent via her own email client (with a copy-to-clipboard fallback), and can look back at every invoice she's ever sent. Settings land in Phase 3, exactly where they're first needed to render real invoice text. Auth hardening (rate limiting, secure session cookies) lands in Phase 1, where the shared-password gate is built and immediately protects every route that follows.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation — Auth Gate & Student Roster** - Tutor logs into a deployed, password-gated app and manages her student roster
- [ ] **Phase 2: Session Logging & Unbilled Dashboard** - Tutor logs sessions against students and sees who owes what at a glance
- [ ] **Phase 3: Invoicing, Email & History** - Tutor turns unbilled sessions into an emailed invoice and can review past invoices

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

- [ ] 01-02-PLAN.md — Auth gate slice: login Server Action + rate limiter + middleware + protected roster read

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 01-03-PLAN.md — Student roster CRUD: add/edit/view via zod-validated Server Actions + shadcn modal

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 01-04-PLAN.md — Archive & restore: soft-delete flow + confirm dialog + archived view/tabs

**Wave 5** *(blocked on Wave 4 completion)*

- [ ] 01-05-PLAN.md — Deploy to Vercel + end-to-end production verification

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

**Plans**: TBD
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

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation — Auth Gate & Student Roster | 1/5 | In Progress|  |
| 2. Session Logging & Unbilled Dashboard | 0/TBD | Not started | - |
| 3. Invoicing, Email & History | 0/TBD | Not started | - |
