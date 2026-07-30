---
quick_id: 260730-hjn
description: Replace cron automation with calendar tab and bulk email sending
created: 2026-07-30
mode: quick (executed inline — subagents flaky in this environment, see memory)
---

# Quick Task 260730-hjn: Replace cron automation with calendar tab and bulk email sending

## Context

Auto-logging (daily Vercel cron → `runAutoLog`) and auto-sending (cron → `runInvoiceCadence` → `sendBulkInvoices`) have been unreliable and hard to debug. The user wants all async machinery removed in favor of synchronous, user-driven flows:

1. **Calendar tab** (new): real month-grid calendar UI. Pending occurrences derived at render time from `schedule_slots` (no DB writes until confirmed). Click a pending slot → prefilled dialog → confirm creates the session. Bulk "Log all pending" for the displayed month. Logged sessions (manual + confirmed) shown on their dates.
2. **Bulk email**: already built — `sendBulkInvoices` action + checkbox multi-select in `invoice-history-table.tsx`. Stays as the manual send path. No new work needed beyond keeping it intact.
3. **Remove cron machinery**: vercel.json cron, `/api/cron/*`, `/api/debug/*`, `lib/schedule/auto-log.ts`, `lib/invoice/cadence.ts`, `lib/cron/`, the cadence + auto-send sections of Settings, and the cron Playwright specs.

DB schema is untouched (no migration): dead settings columns (`invoiceCadence*`, `autoSendInvoices`, `lastInvoicedMonth`) and `scheduleSlots.lastLoggedDate` remain but are no longer written by removed paths. `sessions.scheduleSlotId` is reused by the calendar confirm flow (a confirmed session records which slot it came from — same semantics as before).

## Tasks

### Task 1: Remove async cron/auto-log/auto-send machinery

**Delete files:**
- `vercel.json` (contains only the cron entry)
- `app/api/cron/auto-log/route.ts`, `app/api/cron/test-auto-log/route.ts`
- `app/api/debug/` (cleanup/schedules/sessions debug routes)
- `lib/cron/auth.ts`
- `lib/schedule/auto-log.ts`
- `lib/invoice/cadence.ts`
- `tests/auto-log-and-email.spec.ts`, `tests/cron-endpoints.spec.ts`, `tests/verify-schedules-and-autolog.spec.ts`

**Edit:**
- `components/settings-form.tsx`: remove "Automatic Invoicing" cadence section + "Auto-send invoices" checkbox + related props/state
- `app/(app)/settings/page.tsx`: drop removed props
- `lib/actions/settings.ts`: drop cadence/autoSend fields from parse + upsert
- `lib/validation/settings.ts`: drop cadence/autoSend schema fields

**Keep:** `sendBulkInvoices` (manual bulk send), `lib/invoice/generate.ts` (manual generation), Gmail delivery settings, `schedule_slots` CRUD, schema.

**Verify:** no remaining imports of deleted modules (`grep`), build passes.

### Task 2: Calendar tab

**New files:**
- `lib/schedule/occurrences.ts`: pure helper — given slots + a date range, return occurrences (slotId, date) where `weekdayOf(date) === slot.weekday && date >= slot.effectiveDate`
- `lib/actions/calendar.ts`: `logScheduledSessionAction` (slotId, date, durationMinutes, notes; server-validated: slot exists, weekday matches, date ≥ effectiveDate, date ≤ today in tutor TZ, no existing session for slot+date; amount via `computeAmountCents` from current rate) and `bulkLogScheduledSessionsAction` (list of slotId+date; same guards per item; returns logged/skipped counts)
- `app/(app)/calendar/page.tsx`: server component, `?month=YYYY-MM` param (default current month in tutor TZ); loads slots+students, month's sessions, settings TZ; computes day-grid data; renders CalendarView
- `components/calendar-view.tsx`: client month grid (Sun–Sat), prev/next month links, day cells with: logged sessions (solid chips), pending past/today occurrences (amber, clickable → confirm dialog with editable duration/notes), future occurrences (muted). "Log all pending" bulk button for displayed month.

**Edit:**
- `components/top-nav.tsx`: add Calendar item (between Sessions and History)

**Verify:** build passes; calendar renders pending vs logged correctly (derivation logic unit-testable in occurrences.ts).

### Task 3: Verify + commit

- `npm run build` clean
- Atomic commits: task 1 (removal), task 2 (calendar), docs commit for .planning artifacts
