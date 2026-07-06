---
phase: 03-invoicing-email-history
plan: 01
subsystem: settings
tags: [drizzle, neon, zod, next-server-actions, shadcn, jsonb]

# Dependency graph
requires:
  - phase: 02-session-logging-unbilled-dashboard
    provides: sessions table with billed flag, Dashboard unbilled totals
provides:
  - invoices table (frozen invoice snapshot schema) live in Neon
  - settings table (single-row Zelle handle + email templates) live in Neon
  - sessions.invoiceId nullable FK for un-billing on invoice delete
  - working /settings page (SET-01, SET-02 end-to-end)
  - top-nav History + Settings destinations
affects: [03-02-invoice-generation, 03-03-email-handoff, 03-04-invoice-history]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-row config table via integer primary key default(1) + onConflictDoUpdate upsert"
    - "Page-level (non-modal) form with useActionState + transient success flash via local useState/useTimeout"

key-files:
  created:
    - lib/invoice/defaults.ts
    - lib/validation/settings.ts
    - lib/actions/settings.ts
    - components/settings-form.tsx
    - app/(app)/settings/page.tsx
  modified:
    - lib/db/schema.ts
    - components/top-nav.tsx

key-decisions:
  - "Single schema push for the whole phase (invoices + settings + sessions.invoiceId) so Waves 2-4 build against an already-pushed schema"
  - "invoices.lineItems left as jsonb without a TS generic since InvoiceLineItem's shape is owned by lib/invoice/render.ts (Plan 02, not yet created)"

patterns-established:
  - "Settings single-row upsert: db.insert(settings).values({id:1,...}).onConflictDoUpdate({target: settings.id, set: {...}})"

requirements-completed: [SET-01, SET-02]

duration: ~10min
completed: 2026-07-06
---

# Phase 3 Plan 1: Settings Vertical Slice + Full Phase Schema Foundation Summary

**Zelle handle + editable email subject/body templates persisted via a single-row Settings table, plus the full invoices/settings/sessions.invoiceId schema pushed to Neon in one shot for the rest of Phase 3.**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-07-06T01:26Z
- **Tasks:** 3/3 completed
- **Files modified:** 8 (2 modified, 6 created)

## Accomplishments
- `invoices` and `settings` tables plus `sessions.invoiceId` (nullable FK, `onDelete: "set null"`) added to `lib/db/schema.ts` and pushed live to Neon in one non-destructive `drizzle-kit push` — the full schema foundation for the rest of Phase 3 (Waves 2-4 need no further push).
- `saveSettingsAction` validates (zod, trim + min(1) on all three fields) and performs a single-row `id = 1` upsert via `onConflictDoUpdate`.
- `/settings` page reads the settings row (falling back to `DEFAULT_SUBJECT_TEMPLATE`/`DEFAULT_BODY_TEMPLATE`/`""` on first visit) and renders `SettingsForm`, which shows a transient "Saved." flash on successful submit.
- Top nav now has 5 flat destinations in the UI-SPEC-locked order: Students · Dashboard · Sessions · History · Settings.

## Task Commits

Each task was committed atomically:

1. **Task 1 [BLOCKING]: Add invoices + settings tables + sessions.invoiceId, then push schema** - `09b4482` (feat)
2. **Task 2: Settings validation + saveSettingsAction upsert + default template constants** - `382d07b` (feat)
3. **Task 3: Settings page form + route + top-nav History/Settings links** - `938ae65` (feat)

## Files Created/Modified
- `lib/db/schema.ts` - added `invoices` table, `settings` table, `sessions.invoiceId` nullable FK
- `lib/invoice/defaults.ts` - `DEFAULT_SUBJECT_TEMPLATE` + `DEFAULT_BODY_TEMPLATE` constants
- `lib/validation/settings.ts` - `settingsFormSchema` (drizzle-zod derived, loose non-empty validation), `SettingsFormValues`
- `lib/actions/settings.ts` - `saveSettingsAction`, `SettingsActionState`
- `components/settings-form.tsx` - `SettingsForm` client component (useActionState + noValidate + Saved flash)
- `app/(app)/settings/page.tsx` - Server Component reading settings row (or defaults) into the form
- `components/top-nav.tsx` - `NAV_ITEMS` gains `/history` and `/settings`

## Decisions Made
- Followed the plan's schema sketch verbatim (integer-cents + comment-annotated style, explicit `onDelete` on every FK: `restrict` on `invoices.studentId`, `set null` on `sessions.invoiceId`).
- `invoices.lineItems` typed as plain `jsonb` (no generic) since the `InvoiceLineItem` type lives in `lib/invoice/render.ts`, which Plan 02 creates — avoids a forward-reference to a not-yet-existing module.
- No `db.transaction` reference introduced anywhere in `lib` (confirmed via grep) — this plan does no batch writes; that lands in Plan 02/04 per 03-RESEARCH.md's `db.batch()` guidance.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. `npx drizzle-kit push` applied both new tables and the new column non-interactively (additive, non-destructive change) — no data-loss prompt appeared.

## User Setup Required

None - no external service configuration required. Schema push used the already-configured `DATABASE_URL` in `.env.local`.

## Known Stubs

None. All Settings-page functionality (read, save, persist, defaults) is fully wired — no placeholder data or disconnected UI.

## Next Phase Readiness
- `invoices` + `settings` schema is live in Neon; Plan 02 (invoice generation) can build `lib/invoice/render.ts` and `generateInvoiceAction` directly against it with no further schema push.
- `DEFAULT_SUBJECT_TEMPLATE`/`DEFAULT_BODY_TEMPLATE` and `saveSettingsAction`'s upsert pattern are ready to be read/consumed by invoice generation (merge-field rendering) in Plan 02.
- Top nav's `/history` link currently points to a route that doesn't exist yet — expected, since History (`app/(app)/history/page.tsx`) is built in a later plan of this phase; not a regression, just sequencing.

---
*Phase: 03-invoicing-email-history*
*Completed: 2026-07-06*
