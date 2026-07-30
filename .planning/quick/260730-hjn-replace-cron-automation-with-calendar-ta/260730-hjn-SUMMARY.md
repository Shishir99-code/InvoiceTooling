---
quick_id: 260730-hjn
status: complete
completed: 2026-07-30
commits:
  - fd73a59 remove: cron auto-log, invoice cadence, and auto-send machinery
  - 9060c1e feat: Calendar tab with derived pending sessions and confirm-to-log flow
---

# Summary: Replace cron automation with calendar tab and bulk email sending

## What changed

**Removed all async automation** (fd73a59):
- `vercel.json` (daily 8am cron), `app/api/cron/auto-log`, `app/api/cron/test-auto-log`, `app/api/debug/*`
- `lib/schedule/auto-log.ts` (runAutoLog), `lib/invoice/cadence.ts` (runInvoiceCadence), `lib/cron/auth.ts`
- Settings: "Automatic Invoicing" cadence section and "Auto-send invoices" checkbox removed from form, action, and validation
- Playwright specs tied to cron flows (auto-log-and-email, cron-endpoints, verify-schedules-and-autolog)
- DB schema untouched: `settings.invoiceCadence*`, `settings.autoSendInvoices`, `settings.lastInvoicedMonth`, `scheduleSlots.lastLoggedDate` remain as dead columns (no migration risk); drop later if ever convenient.

**New Calendar tab** (9060c1e):
- `app/(app)/calendar/page.tsx` — dynamic month view (`?month=YYYY-MM`), tutor-timezone "today"
- `lib/schedule/occurrences.ts` — pure derivation of slot occurrences (weekday match + effectiveDate floor); nothing stored
- `lib/actions/calendar.ts` — `confirmOccurrenceAction` (single, editable duration/notes) + `bulkConfirmOccurrencesAction` (month's pending, per-item guards); both re-validate server-side: slot exists, weekday matches, ≥ effectiveDate, ≤ today, not already logged (dedup on scheduleSlotId+date)
- `components/calendar-view.tsx` — month grid: green logged chips, amber dashed pending chips (tap → confirm dialog), muted upcoming chips, legend, "Log all pending (N)" with confirmation dialog
- `components/top-nav.tsx` — Calendar nav item added

**Bulk email**: already existed (`sendBulkInvoices` + checkbox multi-select on History) and is now the only send path — kept intact.

## Verification

- `npm run build` clean (Next 16.2.10, type check passes); `/calendar` builds as a dynamic route.
- No remaining references to removed modules (grep-verified).
- Playwright suites not run (require env/DB); cron-dependent specs deleted with the feature.

## Notes for the Cloudflare migration

The cron removal eliminates the Vercel-cron → Cloudflare-cron migration item entirely. Gmail SMTP via nodemailer remains the send path (relevant to the planned Gmail→Resend phase).
