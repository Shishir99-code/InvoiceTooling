---
phase: 05-recurring-class-schedules-auto-logged-sessions
plan: 01
type: summary
status: complete
requirements: [SCHED-01, SCHED-03, SCHED-04]
---

# Plan 05-01 Summary — Schema Foundation + Amount Helper

## What was built
- **`schedule_slots` table** added to `lib/db/schema.ts` and pushed to live Neon:
  columns `id`, `student_id` (FK → students, `restrict`), `weekday` (0–6 getUTCDay),
  `start_time` (varchar(5) "HH:mm", TZ-naive), `duration_minutes`, `effective_date`
  (D-08 floor), `last_logged_date` (nullable, D-05 high-water-mark), `created_at`.
- **`sessions.scheduleSlotId`** nullable FK (→ scheduleSlots, `onDelete: set null`,
  D-04 auto-log marker). Additive push — no data loss, no cascade anywhere.
- **`lib/sessions/amount.ts`** — new pure module exporting `computeAmountCents(durationMinutes, rateCents)`
  (single `Math.round((min * rateCents) / 60)`). Both `addSessionAction` and
  `editSessionAction` in `lib/actions/sessions.ts` now import it (3 refs: 1 import + 2 calls).

## Verification
- `npx drizzle-kit push` → "Changes applied" (exit 0), additive only.
- `npx tsc --noEmit` exit 0; `npm run lint` exit 0.
- onDelete audit: all FKs `restrict`/`set null`, zero `cascade`.
- REWIRED_OK — no remaining inline `Math.round((parsed...` in sessions.ts.

## Key files
### created
- `lib/sessions/amount.ts`
### modified
- `lib/db/schema.ts`
- `lib/actions/sessions.ts`

## Deviations
None.

## Self-Check: PASSED
Live Neon schema now carries `schedule_slots` + `sessions.schedule_slot_id`; the
amount formula is centralized for cron reuse. Unblocks 05-02 (slot CRUD), 05-03
(cron), 05-04 (UI), 05-05 (marker).
