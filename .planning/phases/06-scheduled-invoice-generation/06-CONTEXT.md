# Phase 6: Scheduled Invoice Generation - Context

**Gathered:** 2026-07-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Give the tutor a **scheduled invoicing layer** on top of Phase 3's manual
invoice generation: she sets a **cadence** (monthly, on a day she chooses) and a
background job auto-generates a **frozen invoice snapshot for every student who
has unbilled sessions** on that day — reusing Phase 3's existing atomic
generation. Auto-generated invoices are **never auto-sent**: they land in Invoice
History for her to review and send with one click. Sending stays entirely
client-side (her own email client), exactly as in Phase 3/4.

Four capabilities:

1. **Configurable cadence (RINV-01)** — a Settings on/off toggle + a
   day-of-month; auto-invoicing fires monthly on that day.
2. **Auto-generate on cadence (RINV-02)** — on the cadence day, generate one
   invoice per student with unbilled sessions (skip those with none), reusing
   the Phase 3 atomic single-`db.batch` CTE + double-billing guard; the cadence
   cannot fire twice within one window (monthly high-water-mark), and it
   self-heals a missed/late daily cron.
3. **Adjustable timeframe on manual generate (RINV-03)** — when generating
   manually, she can optionally cap which sessions an invoice covers via a
   "bill through [date]" cutoff; default remains all currently-unbilled sessions.
4. **Review-not-send + sent tracking (RINV-04)** — auto-generated invoices are
   marked in History and carry a sent/unsent state so she has a clear "what still
   needs sending" queue; opening the email draft marks an invoice sent.

**Explicitly out of scope for Phase 6:**
- **Any app-side email sending / delivery tracking** — the app never sends;
  "sent" is a best-effort local flag she controls, not a delivery confirmation.
  (PROJECT.md: client-side email only.)
- **Weekly / biweekly / arbitrary cadences** — v1 is monthly-on-a-day only
  (see D-01). Other frequencies were considered and deferred.
- **Full start+end date range on manual generate** — only an optional "through"
  cutoff ships (D-06); an arbitrary start bound was rejected as unneeded.
- **PDF invoices, new email transports, per-student cadences** — not requested;
  cadence is a single global setting.
- **Changing Phase 3's invoice snapshot/immutability model or Phase 5's
  auto-log** — Phase 6 reuses both unchanged; auto-invoices flow through the
  same `invoices` table and History surfaces.

</domain>

<decisions>
## Implementation Decisions

### Cadence configuration (RINV-01)
- **D-01:** **Monthly-only, day-of-month, with an on/off toggle — in Settings.**
  Auto-invoicing is configured in the existing Settings surface: a boolean
  "auto-generate invoices" toggle plus a day-of-month selector. No weekly/
  biweekly options in v1 (rejected — no stated need, more edge cases). The
  toggle lets her pause auto-invoicing without losing the chosen day.
- **D-02:** **Short-month clamp.** If she picks a day past a given month's last
  day (e.g. 31 in February), the run fires on that month's **last day** instead.
  Offer a "last day of month" option explicitly so she can express "always end of
  month" without picking a number. (Recommend supported day range 1–28 + an
  explicit "last day" choice; planner/researcher confirm the exact control.)

### Cadence firing & double-fire guard (RINV-02)
- **D-03:** **Catch-up-once-per-month, self-healing.** On each daily cron run:
  if the auto-invoice toggle is on AND today (in `settings.timezone`) is on or
  after the cadence day for the current month AND this month has not already been
  invoiced → fire, then record the current month as invoiced. This makes a
  late/skipped Vercel Hobby daily cron self-heal (fires the next day) while a
  **monthly high-water-mark guarantees it never fires twice in one calendar
  month** (mirrors Phase 5's `lastLoggedDate` HWM discipline). "Strict day-only,
  skip if missed" was rejected — it silently drops a whole month on a cron skip.
- **D-04:** **Reuse Phase 3 atomic generation per student, iterated.** The
  cadence job iterates students with unbilled sessions and, for each, runs the
  **same atomic single-`db.batch` CTE + double-billing guard** as
  `generateInvoiceAction` (never `db.transaction` — throws on neon-http).
  Students with zero unbilled sessions are skipped. One student's failure must
  not block the rest (per-student try/catch, mirroring Phase 5 auto-log).
- **D-05:** **Cadence invoices every student who owes, archived included.** The
  run generates for any student with unbilled sessions regardless of `archived`
  status — mirrors Phase 5 auto-log ("billing is downstream; history
  preserved"). An archived student who still owes should not silently escape
  invoicing.

### Adjustable timeframe on manual generate (RINV-03)
- **D-06:** **Optional "bill through [date]" cutoff; default = all unbilled.**
  The manual generate flow keeps its current default (all of a student's unbilled
  sessions) but gains an optional end-cutoff: "only through [date]" excludes
  unbilled sessions dated after the cutoff (so she can bill this month and leave
  next month's for later). No start bound (rejected — unbilled sessions already
  begin where the last invoice ended). **The cadence/auto-run always uses
  all-unbilled** — the cutoff is a manual-generation-only affordance.

### Review, distinguish & sent-state (RINV-04)
- **D-07:** **Auto-generated invoices are marked in History.** Invoices gain a
  flag indicating auto-vs-manual origin (new column on `invoices`, e.g.
  `autoGenerated boolean` — planner picks exact shape; requires a schema push).
  History shows an "Auto" indicator so she can tell scheduled invoices apart.
- **D-08:** **Track a sent/unsent state; auto-invoices start unsent.** Invoices
  gain a `sent` flag (new column). Auto-generated invoices start **unsent** and
  show an "Auto · not sent yet" badge in History, giving her a clear review
  queue. (Manual invoices predating this feature default to **sent = true** so
  they don't flood the queue with false "unsent" badges — planner confirms the
  backfill default.)
- **D-09:** **Opening the email draft marks the invoice sent (best-effort).**
  Clicking "Review & send" — which opens the pre-filled email draft (the existing
  MAIL-01/MAIL-05 Gmail/mailto handoff) — optimistically flips `sent = true`,
  clearing it from the review queue in one action. Because the app can't observe
  an actual send, provide a manual "Mark unsent"/toggle to undo if she didn't
  send. An explicit-only "Mark sent" step (no auto) was rejected as too easy to
  forget.

### Claude's Discretion
- Exact new-column shapes and names on `settings` (cadence enabled flag,
  day-of-month, `lastInvoicedMonth`/HWM marker) and on `invoices`
  (`autoGenerated`, `sent`) — following existing snake_case + drizzle-zod
  conventions; requires a `drizzle-kit push`.
- **Whether the cadence job is a new `/api/cron/*` route or folds into the
  existing `/api/cron/auto-log` daily run.** Vercel Hobby limits cron count and
  both jobs are daily; folding (run auto-log first so the day's sessions exist,
  then run the invoice cadence) is a reasonable default — but a separate route is
  fine if cleaner. Researcher/planner decides. Either way it reuses
  `isAuthorizedCronRequest` (`CRON_SECRET`) and the existing `api/cron`
  middleware exemption — no new auth or middleware work needed.
- Exact HWM storage/semantics for the monthly "already invoiced this month"
  guard (a `YYYY-MM` string vs a date), and how the toggle-off state short-
  circuits the run.
- The Settings control layout for the toggle + day picker, and the History
  badge/indicator styling — follow existing shadcn + Settings-form patterns.
- Refactoring `generateInvoiceAction` so the atomic generation core is callable
  both from the Server Action (manual, with `emailDraft` return) and from the
  cron loop (per student, no email draft) — extract a shared helper vs. duplicate.
- Exact copy for the "Auto · not sent yet" / "Sent" badges and the "Mark
  unsent" affordance.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project scope & requirements
- `.planning/ROADMAP.md` §"Phase 6: Scheduled Invoice Generation" — goal, the 4
  success criteria (esp. SC2 reuse-atomic-generation + skip-empty +
  no-double-bill + can't-fire-twice; SC4 never-auto-sent), dependencies on Phase
  5 (cron dispatcher + `CRON_SECRET` + middleware allowlist) and Phase 3 (atomic
  generation + double-billing guard).
- `.planning/REQUIREMENTS.md` — RINV-01, RINV-02, RINV-03, RINV-04.
- `.planning/PROJECT.md` — single-user/single-password; **client-side email
  only** (the app never sends — governs D-08/D-09 "sent" being a local flag, not
  a delivery signal); text-only invoices; out-of-scope list.

### Prior phase decisions (carry forward — do NOT re-decide)
- `.planning/phases/03-invoicing-email-history/03-CONTEXT.md` — invoice snapshot
  immutability, frozen `renderedBody`/`renderedSubject`, integer-cents totals,
  the manual generate → email → History flow Phase 6 extends (RINV-03/RINV-04
  build directly on it).
- `.planning/phases/05-recurring-class-schedules-auto-logged-sessions/05-CONTEXT.md`
  — **D-05/D-07/D-09** the cron + `CRON_SECRET` + login-gate-bypass pattern and
  the `lastLoggedDate` **high-water-mark self-healing** model that D-03's monthly
  cadence guard mirrors; the "one bad row never blocks the rest" per-item
  try/catch discipline (D-04).
- `.planning/phases/04-quick-wins-auto-open-email-zoom-links-timezone/04-CONTEXT.md`
  — `settings.timezone` IANA zone (the cadence-day resolution uses it, NOT
  server/UTC day) and the MAIL-05 auto-open-email-draft mechanism D-09 reuses.

### Stack & implementation guidance (LOCKED)
- `CLAUDE.md` — recommended stack (Next.js 16 App Router, React 19, Drizzle +
  Neon, zod at every Server Action boundary, shadcn/ui, Tailwind v4, `date-fns`).
  Vercel Cron is the deployment target. Secrets in env not code (`CRON_SECRET`).

### Existing code (read before editing)
- `lib/actions/invoices.ts` — `generateInvoiceAction` (the atomic single-
  `db.batch` CTE + double-billing guard to reuse per-student in the cadence loop;
  D-04) and `deleteInvoiceAction` (the un-bill recovery pattern). **This is the
  core engine Phase 6 factors out and reuses.**
- `app/api/cron/auto-log/route.ts` + `lib/schedule/auto-log.ts` — the existing
  daily cron route + HWM catch-up engine; the cadence job either folds in here or
  clones this shape (Claude's discretion).
- `lib/cron/auth.ts` — `isAuthorizedCronRequest` (`CRON_SECRET` bearer); reused
  as-is.
- `middleware.ts` — matcher already excludes `api/cron` (whole prefix), so a new
  cadence cron route under `/api/cron/*` is **already exempt** — no middleware
  change needed.
- `vercel.json` — existing `crons` array (one daily job at `0 8 * * *`); add or
  reuse for the cadence run (mind Vercel Hobby cron-count limits).
- `lib/db/schema.ts` — `invoices`, `settings`, `sessions`; Phase 6 adds cadence
  columns to `settings` and `autoGenerated`/`sent` to `invoices`.
- `lib/validation/settings.ts` + `lib/actions/settings.ts` — where the cadence
  toggle/day-of-month validation and persistence attach.
- `lib/invoice/render.ts` + `lib/invoice/defaults.ts` — snapshot rendering reused
  unchanged by the cadence loop.
- `components/` invoice-history / invoice-view surfaces — where the "Auto",
  "unsent"/"sent", and "Review & send" affordances (D-07/D-08/D-09) render.

No external ADRs/specs beyond these — the decisions above are the source of truth.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `generateInvoiceAction` (`lib/actions/invoices.ts`) — the atomic single-
  `db.batch` CTE (INSERT invoice gated on all targets still unbilled + UPDATE
  mark-billed) IS the generation engine; factor its core so both the Server
  Action (manual) and the cron loop (per student) call it. The cron path needs
  no `emailDraft` return.
- `runAutoLog` / `lib/schedule/auto-log.ts` — template for the cadence job: load
  candidates, per-item try/catch so one failure doesn't block the batch, advance
  a durable HWM. The monthly-invoiced guard is the direct analog of
  `lastLoggedDate`.
- `isAuthorizedCronRequest` (`lib/cron/auth.ts`) — constant-time `CRON_SECRET`
  bearer check; reuse unchanged for whichever route runs the cadence.
- `todayInZone` / timezone helpers (`lib/schedule/time.ts`) — resolve the current
  calendar date in `settings.timezone` for cadence-day comparison (do NOT use
  server/UTC day).
- Settings form + `settingsFormSchema` (`lib/validation/settings.ts`) — extend
  with the cadence toggle + day-of-month fields following the existing zod +
  `.max()`-bounds convention.
- Invoice History + invoice-view components — reuse for the review queue; add
  the auto/sent badges and the "Review & send" button.

### Established Patterns
- **Atomicity via `db.batch`, never `db.transaction`** (Phase 3 P-2) — the
  interactive transaction API throws at runtime on the neon-http driver; every
  multi-write Phase 6 op must use `db.batch` / a single CTE.
- **Money is integer cents, frozen at write time; invoice snapshots are
  immutable** — the cadence loop sums stored `amountCents`, never re-derives from
  current rate.
- **HWM idempotency, not row-existence** (Phase 5 D-05) — the "already invoiced
  this month" guard is a durable marker, so re-running the daily cron never
  double-generates.
- **`settings.timezone` drives calendar-day resolution** (Phase 4) — never the
  UTC/server day; the timezone may be null → fall back to `DEFAULT_TIMEZONE`
  (as `runAutoLog` already does).
- **Server-side zod only; `"use server"` files export only async functions;
  `revalidatePath` after every mutation** (`/history`, `/dashboard`).
- **FK discipline** — invoices/sessions FKs use `onDelete: "restrict"`/`"set
  null"`, never cascade.

### Integration Points
- **New `settings` columns** (cadence enabled, day-of-month, monthly HWM) +
  **new `invoices` columns** (`autoGenerated`, `sent`) → one `drizzle-kit push`
  (coordinate with deploy state — see [[deploy-phase3-after-gap-fix]] and
  [[vercel-hobby-cron-constraints]]).
- **Cadence cron** — either fold into `/api/cron/auto-log` (run auto-log first,
  then invoice) or a new `/api/cron/*` route; both are already middleware-exempt
  and use `CRON_SECRET`. Mind Vercel Hobby cron-count/precision limits
  ([[vercel-hobby-cron-constraints]]).
- **Refactor** `generateInvoiceAction` to expose a reusable per-student atomic
  generation core.
- **History UI** gains auto/sent indicators + "Review & send" (opens draft +
  marks sent, D-09) + "Mark unsent" toggle.

</code_context>

<specifics>
## Specific Ideas

- The feeling to preserve: she opens the app, sees this month's invoices already
  drafted for everyone who owes, and just clicks through sending them — the app
  did the "who owes what, totalled and frozen" busywork overnight, but she stays
  the one who hits send. Auto-generation must never feel like it took the send
  decision away from her (RINV-04 is the emotional core).
- The "review queue" mental model: an unsent auto-invoice is a to-do item; the
  sent flag (D-08/D-09) exists so she can see, at a glance, what's left to send
  this month without cross-checking her outbox.
- Cadence + missed-day self-heal (D-03) directly inherits the Phase 5 lesson that
  Vercel Hobby crons are daily-only, imprecise, and skippable — so the cadence
  guard is designed around "at most once per month, but resilient to a late run."

</specifics>

<deferred>
## Deferred Ideas

- **Weekly / biweekly / arbitrary cadences** — v1 is monthly-on-a-day only.
  Revisit if she wants finer control.
- **Per-student cadences** — the cadence is a single global setting; per-student
  billing schedules were not requested.
- **Full start+end date range on manual generate** — only the optional "through"
  cutoff ships (D-06); an arbitrary start bound is deferred.
- **Real send/delivery confirmation** — out of scope permanently under
  client-side-email-only; "sent" stays a best-effort local flag.
- **Notifications** ("your invoices are ready" / "you have 3 unsent invoices") —
  no notification infrastructure in this app; deferred.

### Reviewed Todos (not folded)
None — there were no pending todos to cross-reference.

Discussion stayed within Phase 6 scope.

</deferred>

---

*Phase: 6-scheduled-invoice-generation*
*Context gathered: 2026-07-06*
