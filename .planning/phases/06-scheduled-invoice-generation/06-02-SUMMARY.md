---
phase: 06-scheduled-invoice-generation
plan: 02
subsystem: ui
tags: [settings, form, validation, zod, server-actions, cadence, invoicing]

# Dependency graph
requires:
  - phase: 06-scheduled-invoice-generation
    plan: 01
    provides: invoiceCadenceEnabled, invoiceCadenceDay, invoiceCadenceLastDay columns on settings table

provides:
  - Settings UI for cadence configuration (on/off toggle + day-of-month selector)
  - settingsFormSchema validation for cadence fields with day range 1-28
  - saveSettingsAction persistence for all cadence values via single-row upsert
  - Hidden-input-mirror pattern for Select-to-form integration

affects: [06-03, 06-04, 06-05] # Phase 3+ depend on Settings persisting cadence

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hidden-input-mirror pattern for Select controls (value syncs via hidden input)"
    - "Blank-tolerant zod preprocess for optional numeric fields"
    - "Single-row upsert pattern for settings (id=1, insert or update)"

key-files:
  created: []
  modified:
    - lib/validation/settings.ts
    - lib/actions/settings.ts
    - components/settings-form.tsx
    - app/(app)/settings/page.tsx

key-decisions:
  - "Day range limited to 1-28 to avoid edge-case month-end ambiguity (29/30/31)"
  - "Explicit 'Last day of month' toggle separate from day number (invoiceCadenceLastDay boolean + invoiceCadenceDay nullable integer)"
  - "Used Select controls (no shadcn Switch component) for on/off toggle to match existing timezone pattern"
  - "Hidden-input-mirror pattern mirrors Select state into form for submission (no separate form state -> server boundary)"

requirements-completed: [RINV-01]

# Metrics
duration: 18min
completed: 2025-07-07
---

# Phase 6 Plan 02: Build the Settings Cadence UI Summary

**Cadence configuration UI added to Settings: on/off toggle + day-of-month selector (1–28 or "Last day"), validated and persisted server-side.**

## Performance

- **Duration:** 18 min
- **Started:** 2025-07-07 15:22:00Z (approx)
- **Completed:** 2025-07-07 15:40:00Z (approx)
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Extended `settingsFormSchema` with three cadence fields: `invoiceCadenceEnabled` (boolean), `invoiceCadenceDay` (optional 1-28), `invoiceCadenceLastDay` (boolean)
- Updated `saveSettingsAction` to persist all cadence values via both insert and onConflictDoUpdate branches
- Added "Automatic Invoicing" section to Settings form with on/off Select and day-of-month selector (1-28 plus "Last day of month" option)
- Cadence values round-trip: save → reload → display persisted values correctly
- All existing Settings fields (Zelle/subject/body/timezone) remain unchanged

## Task Commits

All three tasks completed in a single atomic commit:

1. **Task 1: Extend settingsFormSchema with cadence fields** - `55d6fd3` (feat)
2. **Task 2: Persist cadence values in saveSettingsAction** - `55d6fd3` (feat)
3. **Task 3: Add UI controls to SettingsForm** - `55d6fd3` (feat)

## Files Created/Modified

- `lib/validation/settings.ts` - Added invoiceCadenceEnabled, invoiceCadenceDay, invoiceCadenceLastDay fields with zod validation (day 1-28, blank-tolerant preprocess)
- `lib/actions/settings.ts` - Added formData reads and persistence for cadence fields in both insert and update branches
- `components/settings-form.tsx` - Added "Automatic Invoicing" section with on/off Select and day selector; implements hidden-input-mirror pattern
- `app/(app)/settings/page.tsx` - Passed three new cadence props from row to SettingsForm component

## Decisions Made

- **Day range constraint:** Limited to 1-28 (plus "Last day of month" toggle) to avoid ambiguity with 29/30/31 edge cases across different months
- **Separate boolean for last day:** `invoiceCadenceLastDay` boolean separate from `invoiceCadenceDay` integer, allowing "last day mode" to coexist with a saved day preference
- **Select controls for toggle:** Used shadcn Select (not a non-existent Switch primitive) for on/off toggle to match existing timezone pattern in the form
- **Hidden-input-mirror:** Mirrored Select state into hidden inputs for form submission; clean separation of client state from server boundary

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

TypeScript error in initial Select bindings (callback signature mismatch). Resolved by adding explicit handler functions (`handleCadenceEnabledChange`, `handleCadenceDayChange`) that safely guard against null values from the Select's onValueChange callback.

## Verification Checklist

- ✓ `npx tsc --noEmit` and `npm run lint` exit 0
- ✓ settingsFormSchema validates day 1-28, rejects 31, accepts blank as undefined
- ✓ Form submits invoiceCadenceEnabled, invoiceCadenceDay, invoiceCadenceLastDay via hidden inputs
- ✓ Saving and reloading Settings persists and displays the cadence values correctly
- ✓ Existing Settings fields (Zelle/subject/body/timezone) work unchanged
- ✓ Cadence fields present in validation schema: `invoiceCadenceEnabled`, `invoiceCadenceDay`, `invoiceCadenceLastDay`
- ✓ Cadence fields persisted in saveSettingsAction (found in parseSettingsForm reads + insert + onConflictDoUpdate)
- ✓ Form includes hidden inputs mirroring Select values: `name="invoiceCadenceEnabled"`, `name="invoiceCadenceDay"`, `name="invoiceCadenceLastDay"`
- ✓ Day selector offers items 1-28 plus "Last day of month" option
- ✓ Page props wired correctly to SettingsForm component

## Next Phase Readiness

- Settings now captures all cadence configuration needed by the monthly invoice-generation cron (Phase 05)
- Plan 03 (build the pending-invoices dashboard) can now query settings to display cadence status
- Ready for Phase 05 cron implementation to read these persisted cadence values

---

*Phase: 06-scheduled-invoice-generation*
*Plan: 02*
*Completed: 2025-07-07*
