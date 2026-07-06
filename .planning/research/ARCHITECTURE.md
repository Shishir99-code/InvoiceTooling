# ARCHITECTURE Research — TutorInvoice v1.1 (Scheduling & Automation)

> Produced inline. How the v1.1 features integrate with the existing App-Router + Server-Actions + Neon/Drizzle + iron-session architecture. New vs modified components are called out explicitly.

## The one big new surface: a scheduler

The v1 app is request/response-only. v1.1 adds **Vercel Cron → secured Route Handler → server logic**. This is the only structural addition; everything else is columns, a table, and UI.

### Cron entry points (NEW)

- `app/api/cron/route.ts` — a **single dispatcher** GET handler (Hobby cron-count limits favor one route). It runs, in order:
  1. **auto-log** today's scheduled sessions, then
  2. **scheduled invoicing** if today is the cadence day.
  Ordering matters: log first, then (optionally) bill — but see PITFALLS on not auto-billing same-day auto-sessions.
- `vercel.json` → `{ "crons": [{ "path": "/api/cron", "schedule": "0 8 * * *" }] }` (daily; Hobby runs it ~once/day). The schedule is a daily tick; monthly/weekly logic lives in code.
- **Auth:** first line of the handler verifies `request.headers.get("authorization") === \`Bearer ${process.env.CRON_SECRET}\``; else `401`. Vercel injects this header automatically on cron calls.

### Middleware change (MODIFIED — security-critical)

`middleware.ts` currently gates every route behind the iron-session cookie. The cron path has **no cookie** and must be allowlisted so the platform can reach it — but it stays protected by `CRON_SECRET`, not left open. Add `/api/cron` to the middleware matcher exclusions (or early-return for that path). **This is a threat-model item, not a convenience.**

## Data model changes

| Change | Type | Detail |
|--------|------|--------|
| `students.zoomLink` | NEW column | `text` nullable. |
| `student_schedules` | NEW table | `id`, `studentId` FK (onDelete cascade — schedule dies with student), `weekday` (0–6 int), `startTime` (time/text), `durationMinutes` (int). Multiple rows per student. A table (not a JSON column) keeps per-slot editing and querying clean. |
| `sessions.source` | NEW column | enum-like `varchar`/pg enum `'manual' | 'schedule'`, default `'manual'`. Marks auto-created rows. |
| Auto-log idempotency key | NEW constraint | Unique index on `(studentId, date, scheduleId)` **or** `(studentId, date, startTime)` so a re-run of the daily cron can't duplicate a slot. Pairs with `INSERT … ON CONFLICT DO NOTHING`. Consider a nullable `sessions.scheduleId` FK to carry the origin slot. |
| `settings` cadence + tz | NEW columns | `invoiceFrequency` (`monthly'|'biweekly'|'weekly'`), `invoiceAnchorDay` (int, day-of-month or weekday), `lastInvoiceRunAt` (timestamp, dedup), `timezone` (IANA text, e.g. `America/New_York`). |

All schema edits applied to Neon via `drizzle-kit push` (the established flow), with `varchar`→`text`/additive columns being non-destructive.

## Reuse, don't fork, the billing logic

`generateInvoiceAction` in `lib/actions/invoices.ts` holds the **atomic** invoice INSERT + sessions-billed UPDATE (single `db.batch` CTE, double-billing guard). Extract its core into a shared function — e.g. `lib/invoice/generate.ts` `generateInvoiceForStudent(studentId)` — called by **both**:
- the existing manual Server Action, and
- the cron dispatcher (looping over students with unbilled sessions).

This keeps one source of truth for atomicity + the double-billing guard. **Do not** reimplement the write in the cron. neon-http: each student's generation is its own `db.batch` (loop per student); never one cross-student transaction.

## Auto-open email (MODIFIED, small, client-side)

The generate flow returns `invoiceId`; the client builds the `mailto:`/Gmail URL from the rendered snapshot and opens it. Because a Server Action round-trip breaks the user-gesture chain (pop-up blockers), prefer **same-tab `location.href = mailto:`** or the existing invoice-view page with an auto-triggered/prominent open. Independent of the cron work — can ship first as a quick win.

## Suggested build order (continues from Phase 03)

Dependencies flow **schema → cron → UI**, and the two low-risk quick wins can front-load:

1. **Phase 04 — Quick wins + Zoom + schema foundation:** auto-open email on Generate; `students.zoomLink` (+ optional `{zoom}` merge token); add the `timezone` setting. Small, ships value immediately, lays schema groundwork.
2. **Phase 05 — Recurring schedules + auto-logging:** `student_schedules` table + per-student schedule CRUD UI; `sessions.source` + idempotency key; the daily auto-log half of the cron dispatcher (+ `CRON_SECRET`, middleware allowlist, `vercel.json`).
3. **Phase 06 — Scheduled invoicing:** cadence settings (`invoiceFrequency`/`anchor`/`lastInvoiceRunAt`); extract shared `generateInvoiceForStudent`; the scheduled-invoicing half of the cron; dedup + skip-empty.

(The roadmapper may merge 05+06 or split differently; this is a dependency-respecting default.)

## New vs modified — at a glance

- **NEW:** `app/api/cron/route.ts`, `vercel.json`, `student_schedules` table + its CRUD UI/actions/validation, `lib/invoice/generate.ts` (extracted), `CRON_SECRET`.
- **MODIFIED:** `middleware.ts` (cron allowlist), `lib/db/schema.ts` (columns), `lib/actions/invoices.ts` (delegate to shared core), student form (Zoom + schedule), settings form (cadence + timezone), invoice generate UI (auto-open email).
