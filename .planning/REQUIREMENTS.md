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

- [ ] **MAIL-01**: User can open a pre-filled email draft in their own email client for an invoice, addressed to the student's parent email
- [ ] **MAIL-02**: The draft body contains the invoice summary plus Zelle payment instructions built from the settings template
- [x] **MAIL-03**: User can copy the invoice text to the clipboard as a fallback when the email client is unavailable or the body is too long for a mailto link
- [ ] **MAIL-04**: The send action is guarded/handled gracefully when a student has no parent email on file

### Settings

- [x] **SET-01**: User can set and edit the Zelle handle (email or phone) used in invoice payment instructions
- [x] **SET-02**: User can set and edit the email/invoice message template that fills into each send

### Invoice History

- [ ] **HIST-01**: User can view a log of all previously generated invoices
- [ ] **HIST-02**: User can open a past invoice to see its frozen snapshot (student, sessions, total, generated date)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Enhancements

- **REC-01**: Recurring/standing sessions for weekly students
- **RPT-01**: Reporting — income over time
- **PDF-01**: Downloadable/attachable PDF invoices with business branding
- **SEND-01**: App-sent transactional email (in-app send instead of mailto handoff)
- **TAX-01**: Tax/year-end summaries

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
| MAIL-01 | Phase 3 | Pending |
| MAIL-02 | Phase 3 | Pending |
| MAIL-03 | Phase 3 | Complete |
| MAIL-04 | Phase 3 | Pending |
| HIST-01 | Phase 3 | Pending |
| HIST-02 | Phase 3 | Pending |

**Coverage:**

- v1 requirements: 27 total (corrected — previous count of 26 was a tally error; the full enumerated list above is 27 IDs across AUTH×4, STUD×4, SESS×5, DASH×2, INV×4, MAIL×4, SET×2, HIST×2)
- Mapped to phases: 27/27 ✓
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-03*
*Last updated: 2026-07-03 after roadmap creation (traceability populated, coverage count corrected 26→27)*
