---
phase: 06-scheduled-invoice-generation
plan: 04
subsystem: ui
tags: [validation, zod, invoice, cutoff, drizzle]

# Dependency graph
requires:
  - phase: 06-03
    provides: "generateInvoiceForStudent helper foundation with double-billing CTE"
provides:
  - Optional throughDate cutoff field on manual generate (invoiceGenerateSchema)
  - Server-side cutoff filtering in generateInvoiceForStudent (lte clause)
  - Client-side through-date input and preview filtering on invoice dialog
  - Self-healing UI (disabled submit + hint when cutoff excludes all sessions)
affects: [06-05, manual invoice workflows]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zod preprocessing pattern: blank string → undefined for optional fields"
    - "Drizzle and() ignores undefined operands for conditional WHERE clauses"
    - "Client preview filtering mirrors server-side cutoff (WYSIWYG pattern)"

key-files:
  created: []
  modified:
    - lib/validation/invoice.ts
    - lib/invoice/generate.ts
    - components/invoice-preview-dialog.tsx

key-decisions:
  - "throughDate stored as yyyy-MM-dd string (no round-trip through Date, consistent with lib/schedule/time.ts)"
  - "Preview filtering via client-side string comparison (s.date <= throughDate) — matches server drizzle lte()"
  - "Cadence/auto path unchanged — passes no throughDate, bills all unbilled (default preserved)"

patterns-established:
  - "Optional date input pattern: preprocess blank → undefined, validate yyyy-MM-dd regex"
  - "WYSIWYG preview: client filter computes same totals/period as server-side cutoff will freeze"

requirements-completed: [RINV-03]

# Metrics
duration: 12min
completed: 2026-07-07
---

# Phase 6 Plan 4: Manual Bill-Through Cutoff Summary

**Optional "bill through [date]" cutoff on manual invoice generation filters unbilled sessions by date, while cadence/auto path remains unchanged**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-07-07
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Extended `invoiceGenerateSchema` with optional `throughDate` field (yyyy-MM-dd validation, blank → undefined)
- Implemented cutoff filtering in `generateInvoiceForStudent` using `lte(sessions.date, throughDate)` clause
- Added labeled through-date input to invoice preview dialog with help text
- Real-time client-side preview filtering mirrors server-side cutoff (WYSIWYG)
- Submit button disabled and user hint shown when cutoff excludes all unbilled sessions
- Default behavior preserved: no cutoff = all unbilled sessions (unchanged)

## Task Commits

1. **Task 1: Add optional throughDate to invoiceGenerateSchema and honor it in the helper** - `4332d98` (feat)
2. **Task 2: Surface optional through-date on preview dialog and filter preview** - `4332d98` (feat, same commit)

## Files Created/Modified

- `lib/validation/invoice.ts` - Added optional throughDate field with yyyy-MM-dd regex validation and preprocess pattern
- `lib/invoice/generate.ts` - Added lte(sessions.date, opts.throughDate) to unbilled re-SELECT where clause; imported lte from drizzle-orm
- `components/invoice-preview-dialog.tsx` - Added through-date Input, throughDate state, cutoffSessions filter, disabled submit logic, hint message

## Decisions Made

- None - plan executed exactly as specified

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- `npx tsc --noEmit` passed (no type errors)
- `npm run lint` passed (no linting issues)
- `npm run build` passed (production build successful)
- Verified throughDate field in validation schema (`grep -q "throughDate" lib/validation/invoice.ts`)
- Verified lte cutoff in generate helper (`grep -q "lte(sessions.date" lib/invoice/generate.ts`)
- Verified preview dialog input and filtering (`grep -q 'name="throughDate"' components/invoice-preview-dialog.tsx && grep -q "cutoffSessions" components/invoice-preview-dialog.tsx`)

## Next Phase Readiness

- Manual generate now supports optional date cutoff (RINV-03 complete)
- Cadence/auto path unaffected — Plan 05 continues unchanged
- Ready for integration testing of cutoff scenarios (edge cases: no sessions on/before cutoff, cutoff before all sessions, etc.)

---
*Phase: 06-scheduled-invoice-generation*
*Plan: 04*
*Completed: 2026-07-07*
