# Phase 5: Recurring Class Schedules & Auto-Logged Sessions - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-06
**Phase:** 05-recurring-class-schedules-auto-logged-sessions
**Areas discussed:** Schedule management surface, Marking auto-logged sessions, Cancelled/changed-class flow, Cron timing & backfill

---

## Schedule management surface

**Where to manage a student's recurring slots**

| Option | Description | Selected |
|--------|-------------|----------|
| Per-student Schedule section | 'Weekly schedule' area on each student's page/card with add/edit/remove | ✓ |
| Inside the student add/edit modal | Slots managed within the existing student modal | |
| Dedicated Schedules page | A separate top-nav page showing all students' slots | |

**How to enter a slot's time/length**

| Option | Description | Selected |
|--------|-------------|----------|
| Weekday + start time + hrs/min duration | Weekday dropdown, start-time picker, reuse Phase 2 hours+minutes duration | ✓ |
| Weekday + start + end time | Pick start/end clock times; duration computed | |

**User's choice:** Per-student Schedule section; weekday + start time + hrs/min duration
**Notes:** Matches per-student mental model from Phase 2 (sessions grouped by student); reuses the established length control (`durationMinutes`).

---

## Marking auto-logged sessions

**How to distinguish auto vs. manual**

| Option | Description | Selected |
|--------|-------------|----------|
| Small 'Auto' badge | Text badge wherever sessions appear | |
| Icon only (repeat/clock) | Compact icon marker | ✓ |
| Separate visual grouping | Auto sessions sectioned apart | |

**Default note + slot link**

| Option | Description | Selected |
|--------|-------------|----------|
| No default note; link tracked internally | Notes blank; slot→session link stored in DB for dedup, not shown as text | ✓ |
| Default note 'Auto-logged weekly class' | Prefill a note | |

**User's choice:** Icon-only marker; no default note, internal slot link
**Notes:** Keeps notes meaningful (used only for deviations); the internal link also powers idempotency.

---

## Cancelled / changed-class flow

**Deleting a cancelled auto-session**

| Option | Description | Selected |
|--------|-------------|----------|
| Stay deleted — never re-created | Cron records processed slot+date; deletion is permanent | ✓ |
| Re-create it next run | Cron re-logs if no session exists | |

**Editing/removing a slot vs. past auto-sessions**

| Option | Description | Selected |
|--------|-------------|----------|
| Past sessions stay frozen | Slot edits affect future only | ✓ |
| Propagate changes backward | Slot edits rewrite past sessions | |

**User's choice:** Stay deleted; past sessions stay frozen
**Notes:** Drives the idempotency model — must track processed (slot, date) pairs via a durable high-water mark, NOT "does a row exist?" Frozen-snapshot principle consistent with P2 D-14 / P3 frozen invoices.

---

## Cron timing & backfill

**When the daily job runs**

| Option | Description | Selected |
|--------|-------------|----------|
| Early morning (tutor TZ) | ~2–6 AM local; classes ready when she opens the app | ✓ |
| End of day (tutor TZ) | ~11 PM local; logs after classes happened | |

**Backfill behavior**

| Option | Description | Selected |
|--------|-------------|----------|
| Catch up missed days only | Log un-processed past days up to today; new slots log from creation forward | ✓ |
| Today only, no catch-up | Strictly today's classes | |
| New slots backfill from a start date | Retroactive logging with a 'since' date | |

**User's choice:** Early morning; catch-up missed days only
**Notes:** Catch-up self-heals downtime gaps via the D-05 high-water mark; new slots have an effective start = creation date (no retroactive sessions). Vercel Cron is UTC — schedule chosen to land early-morning local, mindful of DST drift.

---

## Claude's Discretion

- Exact `sessions` auto/slot-link column shape (`scheduleSlotId` FK vs. `source` enum + ref).
- New schedule-slots table name/columns and the high-water-mark storage shape.
- Icon glyph + accessible label/tooltip for auto-sessions.
- Early-morning UTC cron expression in `vercel.json` and DST handling.
- Schedule section layout (inline vs. sub-view); add/edit-slot control (modal vs. inline row).
- Optional manual "run now"/backfill trigger for testing.
- Fallback behavior when `settings.timezone` is unset.

## Deferred Ideas

- Scheduled invoicing / invoice cadence (RINV-01..04) — Phase 6.
- Full forward calendar/agenda UI — not needed for auto-logging.
- Optional per-slot end/"until" date — not built for v1.
- Manual run-now / user-set retroactive backfill — optional/rejected for v1.
- Reminders/notifications for upcoming classes — out of scope.
