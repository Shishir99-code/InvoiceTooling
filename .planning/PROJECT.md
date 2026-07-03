# TutorInvoice

## What This Is

A single-user web app for a tutoring business owner to replace her Excel-based time tracking and invoicing. She manages her students, logs tutoring sessions, sees at a glance who owes what, and generates per-student invoices she emails to parents with Zelle payment instructions. It is used by exactly one person, gated by a single shared password — no multi-user accounts.

## Core Value

She can go from "I tutored these sessions" to "an invoice is in the parent's inbox asking them to Zelle me" in a couple of clicks — without touching a spreadsheet.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. -->

- [ ] Single shared-password gate protects the whole app (no per-user accounts)
- [ ] Add, edit, and remove students — each with name, hourly rate, and optional parent/guardian email
- [ ] Log a tutoring session: student (autocomplete from existing students), date, hours, optional notes
- [ ] Edit or delete any session at any time, with totals recomputing (billed sessions included)
- [ ] Dashboard showing each student's unbilled hours and amount owed
- [ ] Generate an invoice for a student that totals their unbilled sessions and produces a copyable text summary
- [ ] Generating an invoice auto-marks its sessions as billed; the invoice is stored as a point-in-time snapshot
- [ ] Email an invoice by opening the tutor's own email client with a pre-filled draft (recipient = student's parent email, body = invoice + Zelle instructions)
- [ ] Settings for her Zelle handle and an editable email/invoice message template that fills into each send
- [ ] Invoice history log of all generated invoices

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Multi-user auth / accounts — only one person uses this; a shared password is enough
- App-sent transactional email — she prefers to send from her own email client; avoids email-service accounts, API keys, and deliverability setup
- PDF invoices — copyable text summary is sufficient for v1; revisit if parents want a formal document
- Payment processing / Zelle integration — the app only tells parents to Zelle her; money moves outside the app
- Business name / logo / branding on invoices — deferred; only the Zelle handle and message template are captured for v1

## Context

- Replacing an existing Excel workflow — the mental model (students, sessions, hours × rate, invoice) is already how she thinks; the app should mirror it, not reinvent it.
- Email approach is deliberately client-side (draft opens in Gmail/Apple Mail) so she keeps control of the actual send and no email service is required.
- "Unbilled" is the pivot concept: a session is either unbilled (counts toward the dashboard total) or billed (already captured on an invoice snapshot). Sessions remain editable after billing; invoices are snapshots that don't retroactively change.

## Constraints

- **Tech stack**: Hosted web app with a persistent database (single deployment, accessible by URL from any device) — TBD during research.
- **Auth**: Single shared password only — no account system.
- **Email**: Must send via the user's own email client (pre-filled draft), not via an in-app email service.
- **Scope**: Text-only invoices for v1 — no PDF generation.

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Single shared-password gate instead of real auth | Only one user; full auth is wasted complexity | — Pending |
| Email via pre-filled draft in her own client (not app-sent) | No email-service account/API keys; she keeps control of the send | — Pending |
| Generating an invoice auto-marks sessions billed; invoice is a snapshot | Matches her spreadsheet mental model; keeps the unbilled dashboard clean | — Pending |
| Sessions stay editable after billing; totals recompute | Lets her fix mistakes without a void/re-bill flow | — Pending |
| Text-only invoices for v1 (no PDF) | Copyable summary is enough to get paid; PDF is polish | — Pending |
| Capture only Zelle handle + message template in settings | Minimal identity needed to send a payment-instruction email | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-03 after initialization*
