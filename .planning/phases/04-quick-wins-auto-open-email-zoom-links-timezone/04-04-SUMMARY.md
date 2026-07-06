---
phase: 04-quick-wins-auto-open-email-zoom-links-timezone
plan: 04
subsystem: ui
tags: [zod, drizzle, react, intl, timezone, useSyncExternalStore, base-ui-select]

requires:
  - phase: 04-quick-wins-auto-open-email-zoom-links-timezone
    provides: settings.timezone column (Plan 01)
provides:
  - "US_TIMEZONES shortlist + isValidIanaTimeZone helper"
  - "optional IANA-validated timezone field in the settings schema"
  - "timezone persisted on the single-row settings upsert"
  - "timezone Select with browser-detected default (hydration-safe)"
affects: [phase-05, phase-06]

tech-stack:
  added: []
  patterns:
    - "hydration-safe browser-only value via useSyncExternalStore (server snapshot vs client snapshot)"
    - "IANA validation via Intl.DateTimeFormat RangeError probe"
    - "extend() (not pick) to attach a custom-validated optional field onto a drizzle-zod insert schema"

key-files:
  created: [lib/settings/timezones.ts]
  modified: [lib/validation/settings.ts, lib/actions/settings.ts, components/settings-form.tsx, app/(app)/settings/page.tsx]

key-decisions:
  - "Timezone is captured only in Phase 4 — no calculation consumes it (Phase 5/6 will)"
  - "Browser-zone detection derived via useSyncExternalStore, not useState-with-Intl-initializer, to avoid both a hydration mismatch and a set-state-in-effect lint violation"

patterns-established:
  - "useSyncExternalStore for any server/client-divergent default value in a client component"

requirements-completed: [SET-03]

duration: 6min
completed: 2026-07-06
---

# Phase 4: Timezone Capture Summary

**Settings captures the tutor's IANA timezone from a US shortlist defaulting to the browser-detected zone (hydration-safe), server-validated via an Intl RangeError probe and persisted on the single settings row — captured only, no consumption this phase**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-07-06T17:16:00Z
- **Completed:** 2026-07-06T17:21:47Z
- **Tasks:** 5
- **Files modified:** 5 (1 created)

## Accomplishments
- `lib/settings/timezones.ts`: `US_TIMEZONES` (7 zones incl. America/New_York) + `isValidIanaTimeZone` (Intl RangeError probe) — verified true for NY, false for a bogus zone.
- `settingsFormSchema` gains an optional `timezone` via `.extend()` (not `.pick`) so the IANA `.refine` applies; blank→undefined, `America/Chicago` passes, `Mars/Base` rejected — all confirmed with a live parse test.
- `saveSettingsAction` writes `timezone: parsed.data.timezone ?? null` into BOTH the insert `values` and the conflict `set`.
- Settings form renders a shadcn/base-ui `Select` from `US_TIMEZONES`, defaults to `props.timezone ?? browser-detected`, injects the current zone as an option when outside the shortlist, and mirrors the value into a hidden `name="timezone"` input.
- Settings page passes `timezone={row?.timezone ?? null}`.
- tsc + lint + build all green.

## Task Commits

1. **Task 1: US timezone shortlist + IANA validator** - `86511cc` (feat)
2. **Task 2: Optional IANA-validated timezone in the settings schema** - `7d4be8f` (feat)
3. **Task 3: Persist timezone in the settings upsert** - `e49b68c` (feat)
4. **Task 4: Timezone Select in the Settings form** - `76954f4` (feat)
5. **Task 5: Pass the stored timezone into the form** - `a0a7ea0` (feat)

## Files Created/Modified
- `lib/settings/timezones.ts` - shortlist + IANA validator (pure, no React/DB import).
- `lib/validation/settings.ts` - optional IANA-refined `timezone`.
- `lib/actions/settings.ts` - parse + upsert `timezone ?? null` in values and set.
- `components/settings-form.tsx` - timezone Select + browser-detect default + hidden input + error paragraph.
- `app/(app)/settings/page.tsx` - `timezone={row?.timezone ?? null}` prop.

## Decisions Made
- Used `useSyncExternalStore` for the browser-detected default instead of the plan's `useState(Intl…)` initializer — see deviation below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Correctness + lint gate] Browser-zone default derived via useSyncExternalStore instead of a useState(Intl…) initializer**
- **Found during:** Task 4 (Timezone Select)
- **Issue:** The plan specified `const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;` with `useState(initialTz)`. Computing that during render produces a server value (deploy zone, e.g. UTC) that differs from the client's browser zone on a first visit (props.timezone null) → a React hydration mismatch on the Select. Moving detection into a `useEffect` + `setState` instead tripped the project's `react-hooks/set-state-in-effect` lint rule.
- **Fix:** Derived the detected zone with `useSyncExternalStore(subscribe, () => Intl…timeZone (client), () => "" (server))` — React's purpose-built primitive for a server/client-divergent value; it resolves on the client with no hydration warning and no effect. A separate `override` state holds the user's explicit selection; `tz = override ?? detectedTz`.
- **Files modified:** components/settings-form.tsx
- **Verification:** `npx tsc --noEmit`, `npm run lint`, `npm run build` all exit 0; timezone parse test (blank/Chicago/bogus) passes.
- **Committed in:** `76954f4` (Task 4 commit)

---

**Total deviations:** 1 auto-fixed (1 correctness + lint-gate compliance)
**Impact on plan:** Every acceptance criterion still met (Select from US_TIMEZONES, default `props.timezone ?? detected`, detected injected as an option when outside the shortlist, hidden `name="timezone"` input, error paragraph). The change strictly improves correctness (no hydration mismatch) with no scope creep.

## Issues Encountered
None beyond the hydration/lint adjustment above.

## Next Phase Readiness
- `settings.timezone` is now captured and validated. Phase 5 (class-day resolution) and Phase 6 (invoice cadence) can consume it — Phase 4 adds no consumer, as required.

---
*Phase: 04-quick-wins-auto-open-email-zoom-links-timezone*
*Completed: 2026-07-06*
