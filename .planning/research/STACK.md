# STACK Research — TutorInvoice v1.1 (Scheduling & Automation)

> Produced inline (research subagents were unavailable this session). Scope: only stack additions the v1.1 features need. Existing v1.0 stack (Next.js 16 App Router, React 19, TS, Neon Postgres via @neondatabase/serverless, Drizzle 0.45, Tailwind v4 + shadcn/ui, zod, iron-session, date-fns, Vercel Hobby) is unchanged and not re-evaluated.

## Verdict: almost no new dependencies

The four v1.1 features are overwhelmingly served by the **existing stack + Vercel platform primitives**. The only genuinely new pieces are (a) Vercel Cron config, (b) a timezone helper, and (c) schema columns/tables. No job queue, no RRULE library, no Zoom SDK.

## Additions

| Need | Decision | Rationale |
|------|----------|-----------|
| Scheduler (auto-log sessions, scheduled invoicing) | **Vercel Cron Jobs** (native) — `crons` array in `vercel.json` + a secured App Router Route Handler | Zero new infra; same deploy. No BullMQ/Inngest/Quirrel — a job queue is massive overkill for ~1 daily tick at one-tutor scale. |
| Cron endpoint auth | **`CRON_SECRET` env var** + `Authorization: Bearer` check in the route handler | Vercel automatically sends `Authorization: Bearer $CRON_SECRET` on cron invocations. The route must verify it (else it's publicly callable). |
| Timezone-correct "today" (cron runs in UTC) | **`date-fns-tz`** (small companion to the already-present `date-fns`) OR native `Intl.DateTimeFormat` with an IANA tz stored in settings | Classes are local; a UTC cron must resolve the tutor's local calendar day. IANA string handles DST automatically. Prefer `date-fns-tz` for parity with existing date code. |
| Recurring-schedule modeling | **Plain data** — per-student rows of `{weekday 0–6, startTime, durationMinutes}`, evaluated with date-fns. **No `rrule.js`.** | The requirement is "typical weekly class days," not arbitrary calendar recurrence. A weekday list + time + duration covers it; RRULE is unused complexity. |
| Auto-open email on Generate | **No dependency** — native `window.location.href = mailto:…` / Gmail compose URL; reuse the existing `lib/invoice/mailto.ts` helper | Already have the draft-URL builder. Only the *trigger* changes (open on generate). See PITFALLS for the pop-up-blocker gotcha. |
| Zoom link | **No dependency** — a `text` column on `students`, rendered as a link | Static link only this milestone (Zoom API/OAuth explicitly deferred). |

## Vercel Cron on Hobby — hard limits to design around

- **Frequency granularity:** Hobby cron jobs are **triggered at most once per day** and only within an approximate window (not to-the-minute). **Design for daily runs.** Monthly/weekly cadence is implemented as a *daily cron that checks "is today the cadence day?"*, not as a monthly cron expression.
- **Count:** Hobby allows a **small number of cron jobs (≈2)**. If more than that is needed, use **one dispatcher route** that branches by task rather than many cron entries.
- **Escalation path:** finer/more frequent cadence → Vercel **Pro** ($20/mo). This is a **billing decision, not an architecture change** — the cron route stays identical.

> Verify the current exact Hobby limits against `vercel.com/docs/cron-jobs/usage-and-pricing` at build time; they have shifted historically. The "daily granularity, few jobs, secure with CRON_SECRET" shape is stable.

## What NOT to add

- ❌ `rrule.js` / `later.js` — weekday array + date-fns is enough.
- ❌ BullMQ / Inngest / Quirrel / any queue — Vercel Cron covers it; a queue adds Redis/infra for nothing.
- ❌ Zoom SDK / OAuth client — deferred; static link only.
- ❌ A separate "email service" — the client-side draft constraint still holds; nothing app-sent.
- ❌ node-cron / self-hosted scheduler — cannot run reliably on serverless; use the platform cron.

## Env vars introduced

- `CRON_SECRET` — random high-entropy string, set in Vercel project env (Production). Referenced by both the cron config (auto-injected header) and the route handler check.
- (Timezone is app data, stored in the DB settings row, not an env var.)
