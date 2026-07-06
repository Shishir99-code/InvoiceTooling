# Research SUMMARY — TutorInvoice v1.1 (Scheduling & Automation)

> Synthesized inline from STACK / FEATURES / ARCHITECTURE / PITFALLS (research subagents were unavailable this session). Consumed by requirements definition and the roadmapper.

## One-paragraph orientation

v1.1 turns the all-manual v1 app into a schedule-driven one by adding a **single new architectural surface — a Vercel Cron job hitting a secured Route Handler** — plus a handful of schema columns/tables and two low-risk client-side quick wins. There are **essentially no new libraries** (maybe `date-fns-tz`); the recurring model is plain weekday-slot data, and Zoom is a static link. The dominant risks are all **automation-correctness**: timezones, idempotency, cron-endpoint security, and not auto-billing cancelled classes.

## Stack additions (minimal)

- **Vercel Cron** (native, `vercel.json` `crons` + `app/api/cron` route) — the scheduler. No queue/library.
- **`CRON_SECRET`** env var — secures the cron endpoint (`Authorization: Bearer`).
- **`date-fns-tz`** (or `Intl`) — resolve the tutor's local "today"/cadence day from a UTC cron.
- **No** rrule.js, **no** job queue, **no** Zoom SDK, **no** email service. Hobby cron = **daily granularity, ~2 jobs** → use one daily dispatcher; finer cadence is a Pro billing decision, not a redesign.

## Feature table-stakes

| Feature | Stakes | Complexity |
|---------|--------|-----------|
| Auto-open email on Generate | Open the pre-filled draft in one step (sending stays client-side) | Low (pop-up-blocker handling) |
| Zoom link per student | Store + display a static link (optional `{zoom}` merge token) | Low |
| Recurring class schedule → auto-log | Per-student weekly slots; daily auto-create real sessions; edit/delete on deviation | High |
| Scheduled invoicing | Configurable cadence auto-generates snapshots; tutor still sends one-click | Medium–High |

## Architecture shape

- **Cron dispatcher** `app/api/cron/route.ts` (GET): verify `CRON_SECRET` → auto-log today's scheduled sessions → if cadence day, generate invoices. `vercel.json` daily schedule.
- **Middleware:** allowlist `/api/cron` (no session cookie) but keep it secured by `CRON_SECRET` — a threat-model item.
- **Schema:** `students.zoomLink`; new `student_schedules` table (`weekday`, `startTime`, `durationMinutes`); `sessions.source` (`manual|schedule`) + unique idempotency key (`studentId,date,scheduleId`); `settings` gains `invoiceFrequency`, `invoiceAnchorDay`, `lastInvoiceRunAt`, `timezone`. Applied via `drizzle-kit push`.
- **Reuse:** extract `generateInvoiceForStudent` from the existing atomic `generateInvoiceAction`; call it from both the manual button and the cron. One `db.batch` per student — never `db.transaction()` (throws on neon-http), never a cross-student transaction.

## Watch Out For (top risks → bake into phases)

1. **Timezone** — store IANA tz in Settings; compute local "today"/cadence in the cron. DST-safe.
2. **Idempotency** — DB unique constraint + `ON CONFLICT DO NOTHING` for auto-log; `lastInvoiceRunAt` + existing billed-guard for invoicing; skip zero-unbilled students.
3. **Cron auth** — `CRON_SECRET` Bearer check is mandatory; the endpoint bypasses the login gate.
4. **Pop-up blocker** — auto-open email via same-tab `location.href`, not a post-await `window.open`.
5. **Auto-billing cancelled classes** — sending stays manual (review gate); consider excluding same-day auto-sessions from auto-invoices.
6. **Rate snapshot** — auto-logged `amountCents` from a fresh `rateCents` read at write time (D-14 precedent).

## Suggested phase decomposition (continues from Phase 03; roadmapper finalizes)

- **Phase 04 — Quick wins + foundation:** auto-open email on Generate; Zoom link; add `timezone` setting. Ships value fast, lays schema groundwork.
- **Phase 05 — Recurring schedules + auto-logging:** `student_schedules` + CRUD UI; `sessions.source` + idempotency; the auto-log half of the cron (+ `CRON_SECRET`, middleware allowlist, `vercel.json`).
- **Phase 06 — Scheduled invoicing:** cadence settings; extracted shared generate; the invoicing half of the cron; dedup + skip-empty + review gate.

## Open product decisions for phase discussion

- Global vs per-student invoice cadence (default: global for one tutor).
- Editable billing timeframe: a Settings default anchor vs a per-run date-range picker (default: cadence covers all currently-unbilled).
- Whether to exclude same-day auto-logged sessions from auto-generated invoices (recommended safeguard).
