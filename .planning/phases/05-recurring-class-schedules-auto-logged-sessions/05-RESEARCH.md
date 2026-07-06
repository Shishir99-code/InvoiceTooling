# Phase 5: Recurring Class Schedules & Auto-Logged Sessions — Research

**Researched:** 2026-07-06
**Consumed by:** gsd-planner (05-PLAN-*.md)
**Scope:** How to implement per-student weekly slots + a secure, idempotent daily
auto-log cron on the existing Next.js 16 / Drizzle / Neon / Vercel stack.

---

## 1. Vercel Cron — the deployment target for the daily job (D-07, D-09)

### Configuration (`vercel.json`)
No `vercel.json` exists yet — this phase creates it. Cron jobs are declared in a
`crons` array; each entry is a `path` (must start with `/`) + a `schedule`
(standard 5-field cron expression, **UTC only**):

```json
{
  "crons": [
    { "path": "/api/cron/auto-log", "schedule": "0 8 * * *" }
  ]
}
```

- The `path` is invoked with a **GET** request by the Vercel scheduler.
- On the **Hobby plan** (this project's tier per CLAUDE.md):
  - **Max frequency is once per day.** Sub-daily expressions (`0 * * * *`,
    `*/30 * * * *`) **fail deployment** with `Hobby accounts are limited to daily
    cron jobs`. The schedule MUST be a single daily fire (a fixed hour).
  - **Timing is imprecise:** Vercel fires anytime *within the scheduled UTC hour*
    (`0 8 * * *` → sometime in `08:00–08:59 UTC`) to spread load.
  - Execution is **best-effort** — a run can be delayed or skipped.
- Up to 100 cron jobs per project (not a constraint here — we need exactly 1).

### DST-safe UTC schedule choice (D-07)
Target = "early morning (~2–6 AM) in the tutor's timezone." For the Phase-4
default `America/New_York` (UTC−5 EST / UTC−4 EDT), **`0 8 * * *`** fires:
- EST: `08:xx UTC` → `03:xx` local ✅ (in 2–6 AM window)
- EDT: `08:xx UTC` → `04:xx` local ✅ (in 2–6 AM window)

So a single fixed UTC schedule stays inside the local early-morning window all
year despite DST — **no schedule change needed across DST**. Crucially, the exact
fire time is *not load-bearing*: class-day resolution uses `settings.timezone`
(§3), and the catch-up design (§2) self-heals a skipped or off-hour run.

### CRON_SECRET authentication (Success Criterion 4, D-09)
Vercel **automatically injects** `Authorization: Bearer <CRON_SECRET>` on every
cron invocation when a `CRON_SECRET` project env var is set. The route verifies it:

```ts
// app/api/cron/auto-log/route.ts
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization");
  // constant-time compare — see §4 for timingSafeEqual wrapper
  if (!secret || !safeBearerEqual(header, secret)) {
    return new Response("Unauthorized", { status: 401 });
  }
  // ...run auto-log...
}
```

- `CRON_SECRET` ≥ 16 random chars, stored **only** in Vercel env vars + local
  `.env.local` (never in code) — same discipline as `APP_PASSWORD`.
- Vercel recommends the bearer check; combined with the middleware exemption
  (§4) this means the route is **not** publicly triggerable even though it is
  outside the login gate.

**Sources:**
- [Vercel Cron Jobs docs](https://vercel.com/docs/cron-jobs)
- [Managing Cron Jobs (CRON_SECRET / auth)](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
- [Cron usage & pricing / Hobby limits](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [Vercel limits](https://vercel.com/docs/limits)

---

## 2. Idempotency: process each (slot, calendar-date) exactly once, ever (D-05, D-08)

**The invariant (D-05):** a deleted auto-session must STAY deleted — the cron must
never re-create it. Therefore idempotency **cannot** be "does a session row exist
for slot+date?" (deleting the row would re-trigger creation).

**Recommended mechanism — per-slot high-water-mark date (`lastLoggedDate`):**
- Each slot carries `effectiveDate` (= its creation date, D-08) and a nullable
  `lastLoggedDate` (the last calendar date the cron has *processed through* for
  this slot; `null` = never run).
- Each run, per slot, the processing window is:
  - lower bound = `lastLoggedDate ? lastLoggedDate + 1 day : effectiveDate`
  - upper bound = **today in the tutor's timezone** (§3)
- For each calendar date `d` in `[lower … upper]` whose weekday == `slot.weekday`,
  insert one auto-session. Then set `lastLoggedDate = upper`.
- **Wrap each slot's inserts + the `lastLoggedDate` update in ONE transaction**
  (`db.transaction(...)`) so a crash mid-slot commits nothing and a re-run retries
  cleanly. Neon's serverless driver supports transactions.

**Why this satisfies every constraint:**
- **Exactly-once:** after a successful run `lastLoggedDate = today`, so a same-day
  re-run has `lower = today+1 > today` ⇒ zero work. Never double-logs (SC2).
- **Deletion stays deleted (D-05):** the HWM lives on the *slot*, independent of
  whether the session row exists. Deleting the session doesn't move the HWM back.
- **Catch-up / self-heal (D-08):** a gap from downtime or a skipped Hobby run is
  covered because the next run processes every un-processed date up to today.
- **No retroactive backfill for new slots (D-08):** `effectiveDate` = creation
  date is the floor, so a new slot never logs dates before it existed.

**Rejected alternative — a `processed_occurrences(slotId, date)` ledger table:**
also correct, but heavier (one row per class occurrence forever) with no benefit
at this scale. The single HWM column is the leanest correct design.

**Edge cases the planner must handle:**
- Slot created today with weekday == today → logs today (lower=effectiveDate=today).
- Timezone unset (`settings.timezone` is `null`): fall back to `America/New_York`
  (the Phase-4 default), documented in code — do not crash or skip silently.
- Amount is computed from the student's **current** `rateCents` at run time and
  frozen on the row (§5) — matches manual logging exactly.

---

## 3. Timezone-correct class-day resolution — native `Intl`, no new dependency (D-07)

`date-fns-tz` is **NOT installed** (only `date-fns@4`). Adding a dependency is
unnecessary — the two operations we need are cleanly done with the platform's
`Intl.DateTimeFormat`, and this keeps us consistent with the stack's
"avoid dependency sprawl" rule.

**(a) "Today" in the tutor's IANA timezone → `"yyyy-MM-dd"` string:**
```ts
function todayInZone(tz: string): string {
  // en-CA formats as yyyy-MM-dd
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}
```
This yields the tutor's *local calendar date* regardless of server/UTC time —
directly addressing the "don't let UTC introduce off-by-one days" pitfall the
Phase-2 `date` string-mode convention exists to prevent.

**(b) Weekday of a calendar-date string (TZ-independent, but must avoid local
`getDay()` midnight drift):** a `"yyyy-MM-dd"` string denotes a pure calendar
date; anchor it at UTC midnight and read `getUTCDay()`:
```ts
function weekdayOf(dateStr: string): number { // 0=Sun … 6=Sat
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}
```
Use the **0=Sunday…6=Saturday** convention (matches JS `getUTCDay`) for the slot's
`weekday` column so UI mapping and cron logic agree.

**(c) Iterating the `[lower … upper]` date window:** operate on strings, stepping
via UTC-anchored `Date` math (or `date-fns` `addDays` on the UTC-anchored value,
formatting back with `format(d,'yyyy-MM-dd')` after re-anchoring) so no step
crosses a DST boundary incorrectly. A small `lib/schedule/time.ts` helper module
should own `todayInZone`, `weekdayOf`, and `eachDateInclusive(lower, upper)`.

**Wall-clock start time is TZ-naive by design (UI-SPEC Surface 2):** the slot's
`startTime` is stored as `"HH:mm"` local wall-clock. Phase 5 only needs it for
display (`Mondays, 3:30–4:30 PM`) and to know *which day* to log — it does **not**
need to resolve start time to a UTC instant, because sessions store only a `date`
(not a timestamp). So no start-time→instant conversion is required this phase.

---

## 4. Middleware exemption + security (Success Criterion 4, D-09; CVE-2025-29927)

**Current `middleware.ts` matcher:**
```
matcher: ["/((?!login|_next/static|_next/image|favicon.ico).*)"]
```
The middleware redirects any request without an `isLoggedIn` iron-session to
`/login`. Left unmodified, it would redirect the cookie-less cron request to
`/login` **before** the route runs — breaking the job. Add `api/cron` to the
negative-lookahead:
```
matcher: ["/((?!login|api/cron|_next/static|_next/image|favicon.ico).*)"]
```
This exempts `/api/cron/*` (only) from the session gate. Authentication is then
enforced **inside the route** by the `CRON_SECRET` bearer check (§1).

**Constant-time compare** (CLAUDE.md discipline mirrors the `APP_PASSWORD` gate):
```ts
import { timingSafeEqual } from "node:crypto";
function safeBearerEqual(header: string | null, secret: string): boolean {
  const expected = `Bearer ${secret}`;
  if (!header || header.length !== expected.length) return false; // length leak is acceptable; avoids Buffer length mismatch throw
  return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}
```
The route must run on the **Node.js runtime** (not Edge) so `node:crypto` and the
Neon/Drizzle DB client are available — Next.js App Router route handlers default
to Node; do not add `export const runtime = "edge"`.

**CVE-2025-29927** (middleware auth-bypass, affects Next 11.1.4–15.2.2): the app
is on **Next 16.2.10**, which is patched. Additionally, cron auth does NOT depend
on middleware — the route's own bearer check is the authority — so even a
middleware bypass would not make the job publicly triggerable. Note this in each
plan's `<threat_model>`.

---

## 5. Schema shape + reuse of the Phase-2 amount formula (D-04, D-06)

### New table `schedule_slots` (planner's discretion on exact name, D-04)
```ts
export const scheduleSlots = pgTable("schedule_slots", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull()
    .references(() => students.id, { onDelete: "restrict" }), // mirror sessions — never cascade
  weekday: integer("weekday").notNull(),          // 0=Sun … 6=Sat (getUTCDay convention)
  startTime: varchar("start_time", { length: 5 }).notNull(), // "HH:mm" 24h local wall-clock, TZ-naive
  durationMinutes: integer("duration_minutes").notNull(),
  effectiveDate: date("effective_date", { mode: "string" }).notNull(), // D-08: = creation date
  lastLoggedDate: date("last_logged_date", { mode: "string" }),         // D-05 high-water-mark; null=never run
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

### `sessions` auto/slot link (D-04)
Add **one nullable FK column** and drive the marker off it:
```ts
scheduleSlotId: integer("schedule_slot_id")
  .references(() => scheduleSlots.id, { onDelete: "set null" }),
```
- Marker (D-03) = `session.scheduleSlotId !== null`.
- `onDelete: "set null"` preserves historical session rows when a slot is removed
  (D-06 — never cascade-delete billing history), matching the existing
  `sessions.invoiceId` set-null discipline.
- **Accepted minor tradeoff:** deleting a slot nulls the marker on its historical
  auto-sessions (they revert to looking manual). Billing is unaffected
  (`amountCents` is frozen), and slot deletion is a rare end-of-engagement event.
  Idempotency does **not** depend on this FK (it uses the slot HWM, §2), so the
  null-out is safe. (A separate persistent `source` enum was considered to keep
  the marker after slot deletion; rejected as extra surface for a cosmetic edge.)

### Reuse the exact Phase-2 amount computation (code_context requirement)
`lib/actions/sessions.ts` computes `amountCents = Math.round(durationMinutes *
student.rateCents / 60)` inline in two places. **Extract this to a shared helper**
so the cron and the manual path share one source of truth:
```ts
// lib/sessions/amount.ts
export function computeAmountCents(durationMinutes: number, rateCents: number) {
  return Math.round((durationMinutes * rateCents) / 60);
}
```
Rewire the two call sites in `sessions.ts` to import it (low-risk, no behavior
change). The cron re-fetches the student's **current** `rateCents` at run time
and freezes the result on the row (P2 D-14) — never trusts a stored/estimated
value. Auto-sessions become indistinguishable from manual ones at the data level.

### Migration / schema push (MANDATORY — see §6)
Both changes require a Drizzle migration + a **live push** to Neon. Build/type
checks pass without the push (types come from `schema.ts`, not the live DB),
creating a false-positive verification — so the push is a blocking task.

---

## 6. Slot CRUD + validation (SCHED-01/02) and UI reuse

- **Validation:** new `lib/validation/schedule.ts` following `lib/validation/session.ts`
  (`createInsertSchema(scheduleSlots, {...})`, coerce FormData strings, bound
  fields). Validate: `weekday` ∈ 0–6, `startTime` matches `^\d{2}:\d{2}$` (00:00–23:59),
  `durationMinutes` positive & ≥ 15 (UI-SPEC error: "Length must be at least 15
  minutes."), `studentId` positive int.
- **Server actions:** new `lib/actions/schedule.ts` (`"use server"`, async-only
  exports) — `addSlotAction`, `editSlotAction`, `deleteSlotAction`. On add,
  `effectiveDate = todayInZone(settings.timezone ?? "America/New_York")` and
  `lastLoggedDate = null`. Each mutation calls `revalidatePath` on the students
  roster view (`/` or `/students` — confirm the route the roster renders on).
  Editing/removing a slot must **not** touch existing sessions (D-06).
- **UI (per UI-SPEC, all reuse existing components):**
  - Roster gets a per-student **"Schedule"** button in `student-table.tsx`'s
    `renderActions` (outline/sm), opening a **Weekly Schedule dialog** listing slots
    with Edit/Remove + an "Add slot" CTA + empty state.
  - **Slot form dialog** = a new `schedule-slot-form-dialog.tsx` cloning
    `session-form-dialog.tsx` verbatim (`useActionState`, `noValidate`,
    close-only-on-real-success). Fields: Day `<Select>`, Start time
    `<input type="time" step="900">` styled with `Input` classes, Length = the
    exact two-`Select` hrs(0–8)+min(0/15/30/45) control (combine into hidden
    `durationMinutes`).
  - Remove requires the confirm dialog copy from UI-SPEC ("Sessions already logged
    from it stay. Only future auto-logging stops.").
  - **Marker:** lucide `Repeat` icon, `size-4`/`size-3.5`, `text-zinc-400`,
    `aria-label`+`title`="Auto-logged from weekly schedule", left of the Date value
    in `session-table.tsx` (table + mobile card) and `dashboard-table.tsx`
    expansion. Render only when `scheduleSlotId !== null`. `lucide-react` already a
    dep (`ChevronDown` in use) — no install.

**Existing patterns confirmed (from reading the code):**
- `sessions.date` is `date` mode `"string"` — keep all date handling string-based.
- Server-side zod is the sole validation authority; forms use `noValidate`.
- FK discipline: `restrict` (studentId) / `set null` (invoiceId) — never cascade.
- shadcn `Select` uses render-prop `SelectValue`; `Dialog` uses `render` prop on
  `DialogTrigger`/`DialogClose` (base-ui build) — clone exactly.

---

## 7. Open decisions handed to the planner (all Claude's-discretion per CONTEXT)

1. **Weekday convention:** 0=Sun…6=Sat (aligns with `getUTCDay`). ✅ recommended.
2. **`sessions` link:** single nullable `scheduleSlotId` FK, `onDelete set null`;
   marker = FK-not-null. ✅ recommended (§5).
3. **Idempotency:** per-slot `lastLoggedDate` HWM + per-slot transaction. ✅ (§2).
4. **Cron schedule:** `0 8 * * *` UTC (DST-safe for Eastern). ✅ (§1).
5. **Timezone fallback when `settings.timezone` is null:** `"America/New_York"`
   (Phase-4 default). ✅
6. **"Run now"/manual backfill trigger:** OUT — testing hits the route directly
   with `Authorization: Bearer $CRON_SECRET` via curl. Keeps scope tight.
7. **Roster route for `revalidatePath`:** confirm which route renders the student
   roster (the "Schedule" button lives there) before wiring revalidation.

---

## RESEARCH COMPLETE
