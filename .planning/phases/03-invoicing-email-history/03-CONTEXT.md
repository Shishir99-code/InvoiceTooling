# Phase 3: Invoicing, Email & History - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Close the billing loop: the tutor configures her Zelle handle + an editable
message template, turns a student's unbilled sessions into a **frozen invoice
snapshot** (which marks those sessions billed), opens a pre-filled Gmail draft to
the parent (with a copy-to-clipboard fallback), and browses a log of every
invoice she's generated. Four capabilities:

1. **Settings** — Zelle handle (SET-01) + editable email/invoice message template
   and subject line (SET-02). First consumed here, which is why they land in
   Phase 3.
2. **Invoice generation** — total a student's unbilled sessions into an itemized
   text summary; atomically mark those sessions billed and freeze the invoice as
   an immutable point-in-time snapshot (INV-01..04).
3. **Email handoff** — open a pre-filled Gmail compose draft addressed to the
   parent (invoice + Zelle instructions from the template), with a copy-text
   fallback (MAIL-01..03).
4. **Invoice history** — a log of every generated invoice, each openable to its
   frozen snapshot, with re-send/re-copy (HIST-01..02).

Requirements: SET-01, SET-02, INV-01..04, MAIL-01..04, HIST-01, HIST-02.

**Out of scope (unchanged from PROJECT.md):** app-sent transactional email (the
app only opens a draft — the user sends it), PDF invoices, payment processing /
Zelle API, business name / logo / branding on invoices. No new capabilities
beyond the four above — this is the final v1 phase.

</domain>

<decisions>
## Implementation Decisions

### Invoice Text Format
- **D-01:** **Itemized, with session notes shown.** Each billed session is a line
  item: `date · duration · amount`, plus the session's note appended when present
  (blank when absent). Then the total. The user explicitly wants the notes on the
  invoice — see D-02 for the downstream implication.
- **D-02:** ⚠ **Session notes are now PARENT-FACING.** In Phase 2 notes were framed
  as optional/internal (P2 D-07); rendering them on invoices makes them visible to
  parents. The planner should surface this to the tutor — e.g. a subtle "notes
  appear on invoices" hint near the session note field — so she doesn't
  accidentally expose an internal remark. No schema change; a UI/labeling concern.
- **D-03:** **Header shows the covered period range** — the min–max date span of
  the billed sessions (e.g. "Jun 3 – Jun 17, 2026"), not a "generated on" date and
  not both. Per-invoice, frozen into the snapshot.
- **D-04:** **No invoice numbers.** Invoices are identified by student + date in
  history (see D-14). Keep it informal; one less thing to manage/sequence.
- **D-05:** No tutor/business name or branding in the invoice text (PROJECT.md
  out-of-scope). Header is essentially "Tutoring Invoice — {student}" + period.

### Generate-Invoice Flow
- **D-06:** **Triggered per-student from the Dashboard.** A "Generate invoice"
  action on each student's row on the existing who-owes-what Dashboard (P2 D-11),
  where the unbilled total + expandable sessions already live. Not a separate
  Invoices page. Invoicing happens right where she decides who to invoice.
- **D-07:** **Preview-then-confirm before freezing.** Generation shows the exact
  rendered invoice text with a "Generate & freeze" confirm — because the action is
  irreversible (marks sessions billed + freezes the snapshot). A plain yes/no
  confirm and one-click-generate were both rejected.
- **D-08:** **Scope = ALL of the student's unbilled sessions** (per ROADMAP success
  criterion — locked, not re-decided). No per-session cherry-picking in the
  generate step; to exclude a session she edits/deletes it first, or voids +
  regenerates after (see D-16). If she has zero unbilled sessions, the generate
  affordance is disabled/hidden (Claude's discretion).
- **D-09:** **After generating, land on the finished invoice** with the send
  buttons ready (Gmail draft + copy) — generate → send is one continuous flow,
  matching the core value ("sessions → parent's inbox in a couple clicks"). Not a
  bounce back to the Dashboard.

### Settings, Template & Email Handoff
- **D-10:** **Gmail compose deep link is the PRIMARY "Email invoice" handoff**
  (`https://mail.google.com/mail/?view=cm&fs=1&to=…&su=…&body=…`), opening Gmail's
  compose window pre-filled with recipient/subject/body — she clicks Send. The
  tutor uses Gmail (srajen2018@gmail.com). The app never sends; she sends from her
  own client (PROJECT.md constraint). A `mailto:` default-client link was the
  alternative and was not chosen as primary.
- **D-11:** **"Copy invoice text" button is always present as a fallback** (MAIL-03)
  — required because Gmail/mailto URLs have a ~2,000-char length ceiling and an
  itemized-with-notes invoice for a student with many sessions can exceed it and
  truncate. The copy button guarantees nothing is lost. Planner should handle the
  over-length case gracefully (e.g. still open the draft but nudge toward copy, or
  detect length and prompt copy).
- **D-12:** **Template = the full email body, editable in Settings, with an
  `{invoice}` placeholder** where the itemized list drops in. She controls
  greeting, tone, and closing around it. (The "auto-invoice + editable closing
  blurb only" model was rejected — she wants full control.)
- **D-13:** **Supported merge fields:** `{invoice}` (always — the itemized list),
  `{student}`, `{total}` (formatted $X.XX), `{zelle}`, `{period}`. **Subject line
  is also editable in Settings** and supports the same fields (e.g. "Tutoring
  invoice for {student}"). Ship a sensible default template + default subject she
  can edit (Claude's discretion on exact default wording).

### Invoice History & Mistake Recovery
- **D-14:** **History is a flat, newest-first log** — one chronological list of
  every invoice showing student, generated/period date, period range, and total.
  (Grouped-by-student and flat-with-filter were both rejected in favor of the
  simplest scan.)
- **D-15:** **Open a past invoice → view its frozen snapshot AND re-send/re-copy**
  (HIST-02) — the same Gmail-draft + copy buttons are available on a historical
  invoice, for "the parent says they never got it" / resend-as-reminder. Reuses
  the send affordances from D-10/D-11. Not view-only.
- **D-16:** **Mistake recovery = DELETE the invoice + un-bill its sessions.** A
  wrong/early invoice can be fully deleted from history; deleting it returns ALL of
  its sessions to unbilled (back on the Dashboard) so she can regenerate correctly.
  Full delete (no "voided" tombstone) was chosen over a void-with-trace and over
  no-undo. **This coexists with INV-03/INV-04 immutability:** while an invoice
  exists its snapshot content is frozen and never retroactively altered by session
  edits — deletion removes the invoice wholesale rather than mutating it. Deletion
  is the only escape hatch; there is no partial edit of a generated invoice.

### Claude's Discretion
- Default template body + default subject-line wording (ship editable defaults).
- Settings page layout and where **Settings** + **History** live in the top nav
  (see Integration Points — nav must gain both destinations).
- Zelle handle input: a single free-text field accepting an email OR phone
  (SET-01); loose validation only (non-empty; no strict phone/email format
  enforcement required).
- Empty/edge states: student with $0 unbilled → generate disabled/hidden; a
  session note that's blank → line omits the note segment; period range when a
  single session → single date.
- Exact "delete invoice" confirm affordance (reuse the existing confirm-dialog
  pattern) and whether delete is reachable from the invoice view, history row, or
  both.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project scope & requirements
- `.planning/ROADMAP.md` §"Phase 3: Invoicing, Email & History" — goal, the 5
  success criteria (esp. the atomic mark-billed + immutable-snapshot criterion),
  dependency on Phase 2.
- `.planning/REQUIREMENTS.md` — SET-01/02, INV-01..04, MAIL-01..04, HIST-01/02.
  **Note:** MAIL-04 ("graceful guard when a student has no parent email") is
  effectively moot — see the note in Deferred Ideas — because P1 D-13 makes parent
  email required + unique for every student.
- `.planning/PROJECT.md` — core value, single-user/single-password constraint, and
  the out-of-scope list (client-side email only, no PDF, no payment processing, no
  branding) that bounds this phase.

### Prior phase decisions (carry forward — do NOT re-decide)
- `.planning/phases/01-foundation-auth-gate-student-roster/01-CONTEXT.md` —
  D-07 (money = integer cents), D-13 (parent email **required + unique** → every
  student is a guaranteed recipient; kills MAIL-04's guard need), D-14 (modal
  dialog pattern), confirm-dialog pattern.
- `.planning/phases/02-session-logging-unbilled-dashboard/02-CONTEXT.md` —
  D-08 (Sessions grouped by student), D-11 (Dashboard = per-student unbilled rows,
  expandable — the home for the Generate button in D-06), D-13 (billed excluded
  from unbilled totals), **D-14 (frozen `amountCents` snapshot philosophy — invoice
  snapshots extend the same "freeze at generation, don't retroactively change"
  model)**.

### Stack & implementation guidance (LOCKED)
- `CLAUDE.md` — recommended stack (Next.js 16 App Router, React 19, Drizzle ORM +
  Neon Postgres, zod at every Server Action boundary, shadcn/ui, Tailwind v4,
  `date-fns`, `iron-session`). Directly relevant here:
  - **"Email Delivery Pattern (client-side draft, no email service)"** — the
    `mailto:` / Gmail-compose deep-link approach and the ~2,000-char mailto limit
    that motivates the copy fallback (D-10/D-11).
  - **"What NOT to Use"** — no transactional email API (Resend/SendGrid/Postmark),
    no Stripe/payment SDK, no PDF libraries.

No external ADRs/specs beyond these — the decisions above are the source of truth.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/db/schema.ts` — `students`, `sessions` (already has the `billed boolean
  default false` flag Phase 3 finally **sets**), `loginAttempts`. Phase 3 adds:
  an **`invoices`** table (frozen snapshot: student ref, period start/end, total
  cents, rendered/line-item snapshot, generatedAt) and a **`settings`** table (or
  single-row settings: `zelleHandle`, `bodyTemplate`, `subjectTemplate`). Follow
  the existing integer-cents + comment-annotated style; note `sessions.studentId`
  uses `onDelete: "restrict"` — invoices referencing sessions/students must keep
  history intact.
- `lib/format.ts` — `formatCents` ($X.XX) and `formatDuration` ("{h} hr(s) {m}
  min") are the **single source of truth** for money/duration and were explicitly
  written to also serve "future Phase 3 invoices." Use them to render invoice line
  items and totals — do NOT reinvent formatting.
- `lib/actions/sessions.ts` — the `"use server"` + zod `safeParse` +
  `SessionActionState { fieldErrors }` + `revalidatePath` pattern. Invoice-generate,
  invoice-delete, and settings-save actions mirror it. **Reminder from STATE.md:** a
  `"use server"` file may only export async functions — no plain-object exports.
- `components/session-form-dialog.tsx` + `components/ui/dialog.tsx` — modal pattern
  to clone for the Settings form and the generate-preview modal (D-07).
- `components/session-delete-confirm-dialog.tsx` / `components/archive-confirm-dialog.tsx`
  — confirm-dialog pattern to clone for the "Delete invoice?" confirm (D-16).
- `components/dashboard-table.tsx` — the per-student expandable Dashboard rows; the
  "Generate invoice" trigger (D-06) attaches here.
- `components/session-table.tsx` / `components/student-table.tsx` — responsive
  table (md+) → stacked cards (mobile) pattern to reuse for the History list (D-14)
  and any invoice line-item display.

### Established Patterns
- Server Components read via `db.select()…orderBy(…)`; interactive bits are small
  client components wired to Server Actions. History page, Settings page, and
  invoice view follow this.
- Money: always integer cents; format only at the display edge via `lib/format.ts`.
  Invoice total = sum of the billed sessions' stored `amountCents` (NOT re-derived
  from the student's current rate — mirrors P2 D-14). Freeze that sum into the
  invoice row.
- Validation is **server-side zod only** (Phase 1 added `noValidate`; server is the
  sole gate). Settings form (Zelle handle, templates) and the generate action
  follow this.
- `revalidatePath` after every mutation — generating an invoice must revalidate the
  Dashboard (unbilled totals drop) and History; deleting an invoice must revalidate
  both (sessions return to unbilled). Settings save revalidates wherever the
  template is consumed.

### Integration Points
- **Atomicity (highest-risk):** generating an invoice must, in ONE transaction,
  (a) read the student's unbilled sessions, (b) freeze the snapshot row, and (c)
  flip those sessions' `billed = true`. Partial failure must not bill sessions
  without a matching invoice, nor create an invoice without billing. Deleting an
  invoice (D-16) must, in one transaction, delete the invoice AND flip its sessions
  back to `billed = false`. Drizzle transaction over the Neon HTTP driver — verify
  transaction support/pattern for `@neondatabase/serverless` during research.
- **Snapshot immutability (INV-03/04):** the invoice must store enough to render
  itself unchanged forever — the safest approach is to store the frozen line items
  (or the fully rendered text) + total at generation, so later edits/deletes of the
  underlying sessions never alter a past invoice. Do not re-render a historical
  invoice from live session rows.
- **Top nav** (`components/top-nav.tsx`) currently has exactly three flat items
  (Students / Dashboard / Sessions). Phase 3 must add **Settings** and **History**
  (or "Invoices") destinations — decide placement (e.g. two more flat items, or a
  gear/Settings split from a History tab). This is the one nav change this phase
  requires.
- **Dashboard** (`app/(app)/dashboard/page.tsx` + `dashboard-table.tsx`) is where
  the Generate button lives (D-06) and where totals must recompute after
  generate/delete.

</code_context>

<specifics>
## Specific Ideas

- The generate → land-on-invoice → Gmail-draft path is deliberately the "money
  shot" of the whole app (core value): the tutor should feel she went from "who
  owes me" to "draft in the parent's inbox" in ~2 clicks.
- Notes-on-invoice (D-01) reflects that the tutor treats notes as a
  parent-communication field, not purely internal — but the app was built with the
  opposite assumption, hence the D-02 heads-up.
- Delete-and-un-bill (D-16) over a formal void: she wants a clean history with no
  "voided" clutter — a mistaken invoice should vanish entirely and free its
  sessions, not linger as a tombstone.
- Full-body editable template (D-12) over an auto-format: she wants her own voice
  in the greeting/closing, not just an app-generated block.

</specifics>

<deferred>
## Deferred Ideas

- **MAIL-04 reconciliation (follow-up, not blocking):** MAIL-04 ("gracefully guard
  the send when a student has no parent email") is effectively **moot** because
  P1 D-13 made parent email required + unique — every student always has a
  recipient. Recommend either dropping MAIL-04 or restating it as a trivial
  invariant (email is guaranteed present). This mirrors the P1-CONTEXT deferred
  note that flagged the same D-13 override. Reconcile in REQUIREMENTS.md via
  `/gsd-phase` or a direct edit; do not build a no-email guard UI.
- **Per-session cherry-picking at generate time** — raised implicitly by D-08;
  deliberately NOT in scope (ROADMAP locks "all unbilled sessions"). If it ever
  becomes a real need, it's a v2 enhancement, not this phase. For now: edit/delete
  a session first, or void+regenerate (D-16).

### Reviewed Todos (not folded)
None — there were no pending todos to cross-reference.

Discussion stayed within Phase 3 scope (no v2/scheduling/Zoom creep this round).

</deferred>

---

*Phase: 3-invoicing-email-history*
*Context gathered: 2026-07-05*
