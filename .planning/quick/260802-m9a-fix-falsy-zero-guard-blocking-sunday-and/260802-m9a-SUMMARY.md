---
quick_id: 260802-m9a
description: Fix falsy-zero guard blocking Sunday and 0 hrs/0 min in schedule slot dialog
status: complete
date: 2026-08-02
files_modified:
  - components/schedule-slot-form-dialog.tsx
---

# Summary

## What was wrong

`ScheduleSlotFormDialog` guarded three Base UI `Select` handlers with a
truthiness test (`value && setX(value)`). Base UI passes the `SelectItem`'s raw
value, and this dialog's option arrays are `number[]` — so the option valued `0`
was falsy and its state update was silently dropped.

Reproduced on the deployed app before the fix: clicking **Sunday** left the
picker on Monday with `weekday=1`. Wednesday and Saturday worked, which is why
it looked like "the Sunday button" specifically was broken.

Same root cause also made **0 hrs** and **0 min** unselectable, so a sub-hour
slot couldn't be created and a length couldn't be returned to a whole hour.

## Fix

One change, applied to all three handlers in
`components/schedule-slot-form-dialog.tsx`:

```diff
-onValueChange={(value) => value && setWeekday(value)}
+onValueChange={(value) => value != null && setWeekday(String(value))}
```

`!= null` preserves the guard's actual intent (ignore a cleared selection)
without swallowing `0`. `String(...)` normalises the emitted number back to the
`string` that the `useState<string>` slots and hidden `<input>` values expect —
previously days 1–6 wrote a `number` into state typed `string`.

`session-form-dialog.tsx` and `calendar-view.tsx` use the same option arrays but
never had the guard, so they were unaffected and were left untouched.

## Verification

`npx tsc --noEmit` clean. `npm run lint` unchanged from baseline (12 pre-existing
problems, none in this file).

Playwright against a running app, driving the real dialog:

| Check | Result |
|-------|--------|
| Click Sunday → trigger "Sunday", `weekday=0` | PASS |
| Click Monday / Saturday (regression) | PASS |
| Re-select Sunday after another day | PASS |
| 0 hrs + 30 min → `durationMinutes=30` | PASS |
| 1 hr + 0 min → `durationMinutes=60` | PASS |
| Save Sunday slot → renders "Sundays, 3:00–4:00 PM · 1 hr", DB row `weekday=0` | PASS |

## Notes

The dialog's option arrays being numeric while the state is `string` is the
latent trap here. Any future `Select` in this codebase should use a null check,
never a truthiness check, whenever `0` is a legal option value.
