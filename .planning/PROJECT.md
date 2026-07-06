# TutorInvoice

## What This Is

A single-user web app for a tutoring business owner to replace her Excel-based time tracking and invoicing. She manages her students, logs tutoring sessions, sees at a glance who owes what, and generates per-student invoices she emails to parents with Zelle payment instructions. It is used by exactly one person, gated by a single shared password — no multi-user accounts.

## Core Value

She can go from "I tutored these sessions" to "an invoice is in the parent's inbox asking them to Zelle me" in a couple of clicks — without touching a spreadsheet.

## Current Milestone: v1.1 Scheduling & Automation

**Goal:** Turn TutorInvoice from all-manual entry into a schedule-driven workflow — recurring class schedules auto-log sessions, invoices generate on a chosen cadence, "Generate" opens the email draft, and each student carries a Zoom link.

**Target features:**
- "Generate" auto-opens the pre-filled email compose draft (not just a redirect to the invoice view)
- Per-student recurring class schedule (weekdays + time + duration); sessions auto-created on the class day; editable/deletable on deviation
- Scheduled invoice generation on a configurable frequency (e.g. monthly), with an editable billing timeframe per run; auto-generates snapshots she then emails one-click
- Static per-student Zoom link, surfaced where relevant (session/invoice)

**Key context:** Introduces a scheduler (Vercel Cron) — a new architectural surface the v1 request/response-only app didn't have. Invoice sending stays client-side/manual (a cron can't open her Gmail), preserving the v1 email constraint. Zoom is a stored static link only this milestone; Zoom-API auto-created meetings are deferred.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

Shipped in v1.0 (milestone phases 01–03):

- [x] Single shared-password gate protects the whole app (no per-user accounts)
- [x] Add, edit, and remove students — each with name, hourly rate, and optional parent/guardian email
- [x] Log a tutoring session: student (autocomplete from existing students), date, hours, optional notes
- [x] Edit or delete any session at any time, with totals recomputing (billed sessions included)
- [x] Dashboard showing each student's unbilled hours and amount owed
- [x] Generate an invoice for a student that totals their unbilled sessions and produces a copyable text summary
- [x] Generating an invoice auto-marks its sessions as billed (atomic write, INV-03); the invoice is stored as a point-in-time snapshot
- [x] Email an invoice by opening the tutor's own email client with a pre-filled draft (recipient = student's parent email, body = invoice + Zelle instructions)
- [x] Settings for her Zelle handle and an editable email/invoice message template that fills into each send
- [x] Invoice history log of all generated invoices

### Active

<!-- Current scope. Building toward these — v1.1. -->

- [ ] Generating an invoice auto-opens the pre-filled email compose draft (not just redirect to the invoice view)
- [ ] Set a recurring class schedule per student (weekdays + time + duration), editable per student
- [ ] Scheduled classes are auto-logged as sessions on the class day; the tutor edits or deletes on deviation (cancellation/reschedule)
- [ ] Invoices generate automatically on a configurable frequency (e.g. monthly), with an editable billing timeframe per run; the tutor still sends each with one click
- [ ] Store a Zoom link per student, surfaced where relevant (session/invoice)

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Multi-user auth / accounts — only one person uses this; a shared password is enough
- App-sent transactional email — she prefers to send from her own email client; avoids email-service accounts, API keys, and deliverability setup
- PDF invoices — copyable text summary is sufficient for v1; revisit if parents want a formal document
- Payment processing / Zelle integration — the app only tells parents to Zelle her; money moves outside the app
- Business name / logo / branding on invoices — deferred; only the Zelle handle and message template are captured for v1
- Zoom-API auto-created meetings (OAuth app, per-session meeting creation, token storage) — deferred to a future milestone; v1.1 stores a static per-student Zoom link only, avoiding an external API/OAuth surface
- App-sent / auto-sent invoice email — even with scheduled generation, sending stays in the tutor's own email client (a cron can't open her Gmail); preserves the client-side email constraint

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
| [v1.1] Zoom = static per-student link, not Zoom-API meetings | A stored link needs no external account/API/OAuth; auto-created meetings add a token-storage + OAuth surface for little gain at one-tutor scale | — Pending |
| [v1.1] Recurring invoices auto-generate snapshots; sending stays manual | A scheduler can't open her email client, so auto-send is impossible; auto-generating + one-click send preserves the client-side email rule | — Pending |
| [v1.1] Scheduled classes auto-write real sessions on the class day | Matches "logged automatically"; cancellations/reschedules are handled by editing after the fact rather than a confirm-first queue | — Pending |
| [v1.1] Adopt a scheduler (Vercel Cron) for recurring sessions + invoices | The v1 request/response-only app has no background jobs; scheduled auto-logging and cadence-based invoicing require one | — Pending |

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
*Last updated: 2026-07-06 — started milestone v1.1 Scheduling & Automation*
