# FEATURES Research — TutorInvoice v1.1 (Scheduling & Automation)

> Produced inline. How the four new features typically work at one-tutor scale, classified table-stakes / differentiator / anti-feature, with dependencies on the existing billed/unbilled + atomic-invoice model.

## 1. Auto-open email compose draft on Generate

- **Behavior:** After the tutor clicks Generate and the invoice snapshot is created, the pre-filled email draft (recipient = parent email, subject + body from the rendered snapshot) opens in her email client — instead of only redirecting to the invoice view.
- **Table stakes:** open the draft in one step.
- **Anti-feature:** app-sent email (still out of scope — sending stays client-side).
- **Dependency:** reuses the existing `mailto:` / Gmail-compose builder and the rendered snapshot from `generateInvoiceAction`.
- **Key UX constraint:** the open must survive a Server Action round-trip without being killed by a pop-up blocker (see PITFALLS §pop-up). Cleanest: navigate the current tab to the `mailto:` (never blocked), or still land on the invoice view but with a prominent one-click "Open email" the generate flow triggers. Design decision for the phase.

## 2. Per-student recurring class schedule → auto-logged sessions

- **Model:** each student has zero-or-more **weekly slots**: `{weekday, startTime, durationMinutes}` (e.g. Tue 16:00 60m, Thu 16:00 60m). Editable per student.
- **Auto-log:** a **daily** job creates the real `session` rows for *today's* scheduled slots, with the student's current rate → `amountCents` snapshot (same write-time rule as manual sessions).
- **Distinguishing auto vs manual:** a `source` marker (`schedule` vs `manual`) on the session, so the tutor can see which rows came from automation.
- **Deviation flow:** the auto-created session is a normal editable/deletable row. Cancelled class → delete it; ran long/short → edit hours; different day → edit date. No separate "exception calendar."
- **Materialization horizon:** create **only today's** sessions each day (rolling), **not** months ahead — keeps the dashboard truthful and avoids auto-billing far-future classes that may not happen.
- **Table stakes:** set/edit weekly slots; daily auto-create; edit/delete on deviation.
- **Differentiator (optional):** different duration per weekday; a per-student "skip dates / holidays" list.
- **Anti-features (avoid):** full calendar UI, drag-to-reschedule, arbitrary RRULE (monthly-nth-weekday, etc.), attendance tracking. Overkill for one tutor.
- **Dependency:** feeds the existing unbilled/dashboard + invoice pipeline unchanged — an auto-logged session is just a session.

## 3. Scheduled invoice generation (configurable cadence + editable timeframe)

- **Cadence:** stored in Settings — e.g. `frequency` (monthly / biweekly / weekly) + an anchor (day-of-month or weekday). **Global** cadence (one setting for the whole practice) is the simplest fit for one tutor; per-student cadence is a differentiator, likely deferred.
- **What the job does on the cadence day:** for each student with unbilled sessions, generate the invoice snapshot using the **same atomic logic** as the manual button. The tutor is **not** emailed automatically — she reviews History and sends each with one click (preserves the client-side email rule).
- **Editable billing timeframe:** default period = the cadence window (e.g. "last month" / since last invoice). The tutor can adjust the covered timeframe — either a Settings default (e.g. "bill up to the 1st") or an editable range on the manual generate path. Simplest v1.1: cadence covers *all currently-unbilled* sessions (matching today's manual behavior), plus a Settings-level "generate on day N."
- **Double-billing safety:** the **existing** billed/invoiceId guard already prevents re-billing; the scheduled run reuses it. Add a `lastInvoiceRunAt` so the cadence can't fire twice in one window, and **skip students with zero unbilled sessions** (no empty invoices).
- **Table stakes:** pick a frequency; auto-generate snapshots on that cadence; still send manually.
- **Differentiator:** per-student cadence; a true editable date-range picker per run.
- **Anti-features:** auto-send email; auto-charging; generating $0 invoices.
- **Dependency:** must reuse `generateInvoiceAction`'s atomic core (extract shared lib) — do NOT fork the billing logic.

## 4. Static per-student Zoom link

- **Behavior:** a `zoomLink` field on the student; shown on the student/session view and optionally embedded in the invoice/email body via a `{zoom}` merge token.
- **Table stakes:** store + display the link.
- **Anti-features:** auto-create meetings, auto-join, Zoom OAuth (all deferred).
- **Dependency:** trivial — a column + a form field; optional merge-token wiring into the existing template renderer.

## Feature → build-complexity summary

| Feature | Complexity | Notes |
|---------|-----------|-------|
| Auto-open email on Generate | Low | Pop-up-blocker handling is the only subtlety. |
| Zoom link per student | Low | Column + form field (+ optional merge token). |
| Recurring schedule + auto-log cron | High | New table, `source` marker, idempotency, timezone, daily cron. |
| Scheduled invoicing cron | Medium–High | Cadence settings, reuse atomic generate, dedup, timezone. |
