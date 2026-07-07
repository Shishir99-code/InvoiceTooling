# Requirements: TutorInvoice

**Defined:** 2026-07-03
**Core Value:** Go from "I tutored these sessions" to "an invoice is in the parent's inbox asking them to Zelle me" in a couple of clicks — without touching a spreadsheet.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Access

- [x] **AUTH-01**: User can unlock the app by entering a single shared password
- [x] **AUTH-02**: User stays logged in across page refreshes via a secure session cookie
- [x] **AUTH-03**: Every page except the login screen is inaccessible without a valid session
- [x] **AUTH-04**: Repeated wrong password attempts are rate-limited to deter brute force

### Students

- [x] **STUD-01**: User can add a student with a name and hourly rate, and an optional parent/guardian email
- [x] **STUD-02**: User can edit a student's name, hourly rate, and parent email
- [x] **STUD-03**: User can remove a student (archived if they have session/invoice history so history is preserved)
- [x] **STUD-04**: User can view a list of all students

### Sessions

- [x] **SESS-01**: User can log a session by selecting a student via name autocomplete, plus date and hours
- [x] **SESS-02**: User can add optional notes to a session
- [x] **SESS-03**: User can edit any session's student, date, hours, and notes at any time (including already-billed sessions)
- [x] **SESS-04**: User can delete a session
- [x] **SESS-05**: Session amounts are computed from hours × the student's hourly rate (money stored as integer cents)

### Dashboard

- [x] **DASH-01**: User can see each student's total unbilled hours and amount owed at a glance
- [x] **DASH-02**: Billed sessions are excluded from the unbilled totals

### Invoicing

- [x] **INV-01**: User can generate an invoice for a student that totals all their unbilled sessions
- [x] **INV-02**: Generating an invoice produces a copyable text summary of the sessions and total
- [x] **INV-03**: Generating an invoice atomically marks its sessions as billed and stores the invoice as an immutable point-in-time snapshot (line items + rendered text + total frozen at generation)
- [x] **INV-04**: Editing or deleting a session after billing does not alter any previously generated invoice snapshot

### Email

- [x] **MAIL-01**: User can open a pre-filled email draft in their own email client for an invoice, addressed to the student's parent email
- [x] **MAIL-02**: The draft body contains the invoice summary plus Zelle payment instructions built from the settings template
- [x] **MAIL-03**: User can copy the invoice text to the clipboard as a fallback when the email client is unavailable or the body is too long for a mailto link
- [x] **MAIL-04**: The send action is guarded/handled gracefully when a student has no parent email on file

### Settings

- [x] **SET-01**: User can set and edit the Zelle handle (email or phone) used in invoice payment instructions
- [x] **SET-02**: User can set and edit the email/invoice message template that fills into each send

### Invoice History

- [x] **HIST-01**: User can view a log of all previously generated invoices
- [x] **HIST-02**: User can open a past invoice to see its frozen snapshot (student, sessions, total, generated date)

## v1.1 Requirements — Scheduling & Automation

Current milestone. Continues REQ-ID numbering; phases continue from Phase 03.

### Invoice Email

- [ ] **MAIL-05**: Generating an invoice automatically opens the pre-filled email draft in the user's own email client (no extra click); sending stays client-side

### Class Schedules

- [ ] **SCHED-01**: User can define a student's recurring weekly class slots (weekday + start time + duration); a student can have multiple slots
- [ ] **SCHED-02**: User can edit or remove any of a student's class slots
- [ ] **SCHED-03**: On each scheduled class day, the app automatically logs a session for that slot, with the amount computed from the student's current rate (integer cents)
- [ ] **SCHED-04**: Auto-logged sessions are visibly distinguishable from manually-logged ones and can be edited or deleted like any session when a class deviates (cancelled, rescheduled, ran long/short)

### Scheduled Invoicing

- [x] **RINV-01**: User can set how often invoices are generated automatically (e.g. monthly on a chosen day)
- [x] **RINV-02**: On the cadence day, the app automatically generates an invoice snapshot for each student who has unbilled sessions (students with none are skipped; no double-billing)
- [ ] **RINV-03**: User can adjust the session timeframe an invoice covers when generating (default = all currently-unbilled sessions)
- [x] **RINV-04**: Auto-generated invoices are never auto-sent — the user reviews and sends each with one click

### Zoom Links

- [ ] **ZOOM-01**: User can set and edit a Zoom link for each student
- [ ] **ZOOM-02**: A student's Zoom link is surfaced where relevant (session view and/or invoice via a template token)

### Settings

- [ ] **SET-03**: User can set the local timezone used to determine class days and invoice cadence

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Enhancements

- **REC-01**: ~~Recurring/standing sessions for weekly students~~ — promoted into v1.1 as the **SCHED-**\* requirements
- **RPT-01**: Reporting — income over time
- **PDF-01**: Downloadable/attachable PDF invoices with business branding
- **SEND-01**: App-sent transactional email (in-app send instead of mailto handoff)
- **TAX-01**: Tax/year-end summaries
- **ZOOM-API-01**: Zoom-API auto-created meetings per session (OAuth app, token storage) — v1.1 ships static per-student links only

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Multi-user accounts / real auth | Only one person uses this; a shared password is enough |
| App-sent transactional email (v1) | She prefers sending from her own client; avoids email-service accounts, API keys, deliverability setup |
| PDF invoices (v1) | Copyable text summary is sufficient to get paid; PDF is polish |
| Payment processing / Zelle API | App only instructs parents to Zelle her; money moves outside the app |
| Business name / logo / branding on invoices | Deferred; only Zelle handle + message template captured for v1 |
| Live start/stop timers | Sessions are fixed-duration and logged after the fact — wrong mental model |
| Automated payment reminders / client portal | SaaS features irrelevant to a one-person tool |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| AUTH-04 | Phase 1 | Complete |
| STUD-01 | Phase 1 | Complete |
| STUD-02 | Phase 1 | Complete |
| STUD-03 | Phase 1 | Complete |
| STUD-04 | Phase 1 | Complete |
| SESS-01 | Phase 2 | Complete |
| SESS-02 | Phase 2 | Complete |
| SESS-03 | Phase 2 | Complete |
| SESS-04 | Phase 2 | Complete |
| SESS-05 | Phase 2 | Complete |
| DASH-01 | Phase 2 | Complete |
| DASH-02 | Phase 2 | Complete |
| SET-01 | Phase 3 | Complete |
| SET-02 | Phase 3 | Complete |
| INV-01 | Phase 3 | Complete |
| INV-02 | Phase 3 | Complete |
| INV-03 | Phase 3 | Complete |
| INV-04 | Phase 3 | Complete |
| MAIL-01 | Phase 3 | Complete |
| MAIL-02 | Phase 3 | Complete |
| MAIL-03 | Phase 3 | Complete |
| MAIL-04 | Phase 3 | Complete |
| HIST-01 | Phase 3 | Complete |
| HIST-02 | Phase 3 | Complete |
| MAIL-05 | Phase 4 | Planned |
| ZOOM-01 | Phase 4 | Planned |
| ZOOM-02 | Phase 4 | Planned |
| SET-03 | Phase 4 | Planned |
| SCHED-01 | Phase 5 | Planned |
| SCHED-02 | Phase 5 | Planned |
| SCHED-03 | Phase 5 | Planned |
| SCHED-04 | Phase 5 | Planned |
| RINV-01 | Phase 6 | Planned |
| RINV-02 | Phase 6 | Planned |
| RINV-03 | Phase 6 | Planned |
| RINV-04 | Phase 6 | Planned |

**Coverage:**

- v1 requirements: 27 total (AUTH×4, STUD×4, SESS×5, DASH×2, INV×4, MAIL×4, SET×2, HIST×2) — all Complete
- v1.1 requirements: 12 total (MAIL-05, ZOOM×2, SET-03, SCHED×4, RINV×4) — mapped to Phases 4–6
- Mapped to phases: 39/39 ✓
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-03*
*Last updated: 2026-07-06 — milestone v1.1 roadmap (Phases 4–6, 12 new requirements mapped)*
