# Phase 4: Quick Wins — Auto-Open Email, Zoom Links & Timezone - Context

**Gathered:** 2026-07-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Three low-risk enhancements riding on the Phase 3 foundation — no new billing
logic, just extensions of the existing invoice, student, and settings surfaces:

1. **MAIL-05 — Auto-open email on generate.** After the tutor confirms
   "Generate & Freeze," the pre-filled Gmail compose draft opens automatically
   (no extra click), surviving the Server Action round-trip without being
   blocked as a pop-up. Sending stays fully client-side — the app never sends.
2. **ZOOM-01/02 — Per-student Zoom link + send.** Each student carries an
   optional Zoom link, editable in the student form. The link is surfaced via a
   dedicated **"Send Zoom link"** button on each student in the roster that
   opens its **own** separate parent-facing email draft (NOT baked into the
   invoice).
3. **SET-03 — Local timezone.** The tutor sets her IANA timezone in Settings.
   Phase 4 only **captures + stores** it; it is consumed later by Phase 5
   (class-day resolution) and Phase 6 (invoice cadence).

Requirements: MAIL-05, ZOOM-01, ZOOM-02, SET-03.

**Out of scope (unchanged from PROJECT.md / REQUIREMENTS.md):** app-sent
transactional email (the app only opens drafts — the tutor sends), Zoom-API
auto-created meetings (ZOOM-API-01 is v2 — static per-student links only), PDF
invoices, payment processing, branding. Recurring schedules (Phase 5) and
scheduled invoicing (Phase 6) are NOT part of this phase — the timezone is
merely captured here for them.

</domain>

<decisions>
## Implementation Decisions

### Auto-Open Email on Generate (MAIL-05)
- **D-01:** **Gmail draft opens in a NEW tab; the tutor stays on the frozen
  invoice page.** After a successful generate she still lands on
  `/history/[id]` (P3 D-09), and the Gmail compose draft opens in a separate
  browser tab so the invoice view — with Copy and re-send — remains one click
  away. Same-tab navigation was rejected (it would abandon the invoice page and
  the copy fallback).
- **D-02:** **Pop-up-blocker-safe pattern is mandatory.** A `window.open` fired
  after the Server Action resolves is NOT inside the original user gesture and
  will be blocked. The approach to implement: capture a window handle
  synchronously **inside the "Generate & Freeze" click** (e.g. `window.open("",
  "_blank")`), let the action run, then set that window's `location` to the
  Gmail compose URL once the action returns the invoice id + rendered
  subject/body. Researcher/planner must confirm the exact mechanics for this
  React 19 `useActionState` + `router.push` flow (the current
  `invoice-preview-dialog.tsx` already does the post-success navigate — the
  auto-open hooks into that same success branch).
- **D-03:** **Respect the existing over-length guard (P3 D-11).** When the
  Gmail URL exceeds `GMAIL_URL_MAX_LEN` (1800, from `lib/invoice/mailto.ts`),
  do NOT auto-open (it would silently truncate/garble). Instead land on the
  invoice page where the existing "too long — copy the text below" messaging +
  Copy button already handle it. Auto-open is best-effort: too-long → graceful
  copy-first fallback, blocked pop-up → the manual "Email Invoice" button is
  right there.
- **D-04:** **The manual "Email Invoice" button stays** on the invoice/history
  view (P3 D-10/D-15 re-send path is unchanged). Auto-open supplements it for
  the generate flow; it does not replace it.

### Zoom Link — Input (ZOOM-01)
- **D-05:** **Optional per student, loose URL validation.** Not every student
  needs a standing link. When provided it must look like a URL (server-side zod:
  a URL / `http(s)`-prefixed check); blank is allowed. Mirrors the loose-but-
  present spirit of the Zelle handle, but with a URL shape check rather than
  free text. New `zoomLink` column on the `students` table (nullable /
  default empty).
- **D-06:** **Edited in the existing student modal.** The Zoom link field is
  added to `components/student-form-dialog.tsx` (add + edit modes) alongside
  name / rate / parent email. No new surface for editing.

### Zoom Link — Surfacing & Send (ZOOM-02)
- **D-07:** **Dedicated "Send Zoom link" button on each student in the ROSTER.**
  The button lives on each student's row/card on the Students page (not the
  Dashboard, not the invoice). It is a student attribute, not a billing one, so
  it belongs with the student. It opens a Gmail compose draft to that student's
  parent email.
- **D-08:** **Separate email, simple built-in message — NOT the invoice.** The
  Zoom link is sent as its own email, never embedded in an invoice. The draft
  uses a short fixed built-in message (Claude's discretion on exact wording),
  e.g. subject "Zoom link for {student}'s tutoring" and a body containing a
  greeting + the link. **No editable Settings template for this** (rejected as
  over-engineering for v1.1) — it just works out of the box.
- **D-09:** **Reuse the invoice email pattern.** The Zoom send reuses the same
  `buildGmailComposeUrl` + new-tab-open + copy-fallback machinery as invoices
  (`lib/invoice/mailto.ts`, the compose/copy affordances). Parent email is
  guaranteed present (P1 D-13 required+unique), so no no-recipient guard is
  needed — but the button should be disabled/hidden when the student has **no
  Zoom link set** (nothing to send). Claude's discretion on disabled-vs-hidden.
- **D-10:** **NO `{zoom}` merge token in invoices.** Invoice subject/body
  templates stay at the existing **5** merge fields (`{invoice} {student}
  {total} {zelle} {period}`) — `lib/invoice/render.ts` `MERGE_FIELDS` is
  unchanged. This is a deliberate departure from the ROADMAP's "invoice via a
  template token" example: the tutor chose a separate send instead.

### Timezone (SET-03)
- **D-11:** **Auto-detect the browser IANA zone as the default + a US-timezone
  shortlist to override.** On the Settings page, prefill the value detected via
  `Intl.DateTimeFormat().resolvedOptions().timeZone` and let her pick/override
  from a short list of common US timezones (America/New_York, /Chicago,
  /Denver, /Los_Angeles, /Phoenix, /Anchorage, Pacific/Honolulu — Claude's
  discretion on the exact shortlist). Full ~400-entry searchable IANA list was
  rejected as heavier than a US-based single user needs.
- **D-12:** **Stored as an IANA string** (e.g. `America/New_York`) on the
  single-row `settings` table (new `timezone` column). Phase 4 does NOT consume
  it in any calculation — it is captured for Phase 5 (class-day resolution) and
  Phase 6 (invoice cadence). Validate server-side that it is a recognized IANA
  zone.

### Claude's Discretion
- Exact wording of the built-in Zoom-link email subject + body (D-08).
- Exact US-timezone shortlist entries and the Settings control (native `<select>`
  vs shadcn Select) for timezone (D-11).
- Disabled-vs-hidden treatment of the "Send Zoom link" button when a student has
  no link (D-09).
- Placement of the Zoom-link field within the student modal and the timezone
  field within the Settings form.
- The precise React mechanism for the pop-up-safe auto-open (D-02) — subject to
  researcher confirmation of the `useActionState` success-branch timing.
- Zoom link input: whether to normalize/trim; whether a bare `zoom.us/...`
  without scheme is coerced to `https://` or rejected (loose check only — D-05).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project scope & requirements
- `.planning/ROADMAP.md` §"Phase 4: Quick Wins — Auto-Open Email, Zoom Links &
  Timezone" — goal, the 3 success criteria, dependency on Phase 3. **Note:** SC2
  mentions a `{zoom}` invoice token as one option — this phase deliberately
  chose the *separate-email* alternative instead (D-07/D-10); the "surface the
  link where relevant" intent is met via the roster send button.
- `.planning/REQUIREMENTS.md` — MAIL-05, ZOOM-01, ZOOM-02, SET-03 (v1.1 block).
- `.planning/PROJECT.md` — client-side-email-only constraint, single-user /
  single-password, out-of-scope list (no app-sent email, no PDF, no payments).

### Prior phase decisions (carry forward — do NOT re-decide)
- `.planning/phases/03-invoicing-email-history/03-CONTEXT.md` — **D-09**
  (post-generate lands on the finished invoice — the auto-open hooks here),
  **D-10** (Gmail compose deep link is the primary handoff; the app never
  sends), **D-11** (Copy fallback always present + the ~1800-char over-length
  guard that MAIL-05 must respect), **D-12/D-13** (5 invoice merge fields — NOT
  extended by this phase). Reuse, don't reinvent.
- `.planning/phases/01-foundation-auth-gate-student-roster/01-CONTEXT.md` —
  **D-13** (parent email required + unique → every student is a guaranteed
  recipient for the Zoom send; no no-recipient guard needed), the student modal
  + `noValidate` + server-side-zod pattern.

### Stack & implementation guidance (LOCKED)
- `CLAUDE.md` — recommended stack (Next.js 16 App Router, React 19, Drizzle +
  Neon, zod at every Server Action boundary, shadcn/ui, Tailwind v4,
  `date-fns`). §"Email Delivery Pattern (client-side draft, no email service)"
  and §"What NOT to Use" (no transactional email API) bound both the invoice and
  Zoom-link email flows.

No external ADRs/specs beyond these — the decisions above are the source of truth.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/invoice/mailto.ts` — `buildGmailComposeUrl({to,subject,body})` +
  `isGmailUrlTooLong` + `GMAIL_URL_MAX_LEN = 1800`. **Reuse verbatim** for both
  the auto-open (MAIL-05) and the Zoom-link send (ZOOM-02). Do NOT hand-build
  Gmail URLs — this builder uses `URLSearchParams` to prevent `&`/`#`/newline
  injection (P3 Pitfall 6).
- `components/invoice-view.tsx` — already renders the "Email Invoice" anchor
  (gmail deep link), the over-length guard, and the Copy button + copy-failed
  textarea fallback. The auto-open success path and the Zoom send button can
  clone this component's exact affordances.
- `components/invoice-preview-dialog.tsx` — the "Generate & Freeze" modal.
  Its post-success branch (`state.invoiceId !== null → router.push(...)`) is the
  exact hook point for auto-open (D-02). The pop-up window handle must be grabbed
  in the form's submit gesture, before the action resolves.
- `components/student-form-dialog.tsx` + `lib/validation/student.ts` +
  `lib/actions/students.ts` — add/edit student modal (add + edit modes), the
  `createInsertSchema` + `noValidate` + `StudentActionState { fieldErrors }`
  pattern. Add the `zoomLink` field here (D-06) mirroring `parentEmail`.
- `components/settings-form.tsx` + `lib/validation/settings.ts` +
  `lib/actions/settings.ts` — single-row Settings page form + zod schema. Add
  the `timezone` field here (D-11/D-12).
- `components/student-table.tsx` — the responsive roster table (md+) / stacked
  cards (mobile); the "Send Zoom link" button (D-07) attaches per-student row.
- `lib/invoice/defaults.ts` — where the built-in Zoom-email default message
  text (D-08) can live as pure constants, mirroring `DEFAULT_BODY_TEMPLATE`.

### Established Patterns
- Server-side zod ONLY (`noValidate` on forms; server is the sole gate). The
  Zoom-link URL check, the timezone IANA check, and any new validation follow
  this — client never validates.
- Server Components read via `db.select()`; interactive bits are small client
  components wired to Server Actions with `useActionState`. `revalidatePath`
  after every mutation (student edit → revalidate roster; settings save →
  revalidate wherever consumed).
- `"use server"` files export only async functions — no plain-object exports
  (STATE.md reminder). Built-in Zoom message text goes in `lib/invoice/*`, not
  in an action file.
- Money is integer cents formatted only at the edge — not relevant to this
  phase (no money changes), noted so it isn't disturbed.

### Integration Points
- **`students` schema** (`lib/db/schema.ts`) — add nullable `zoomLink`
  (varchar). A `drizzle-kit` schema push is required (mirrors P3's added
  columns). Preserve the existing `onDelete: "restrict"` FKs.
- **`settings` schema** — add `timezone` (varchar) to the single-row table;
  needs a default so the pre-existing row (id=1) doesn't violate NOT NULL on
  push — ship a sensible default (e.g. detect-on-first-save, or default to
  `America/New_York`). Planner to decide default-vs-nullable so the migration is
  safe on the live DB (memory: schema already applied on Vercel/Neon).
- **Auto-open (highest-risk)** — the pop-up-survival mechanics (D-02) are the
  one genuinely tricky bit; everything else is additive CRUD. Verify against the
  React 19 Server Action round-trip during research.
- **Roster row actions** — `student-table.tsx` currently has edit/archive
  affordances; the Zoom send button is a new per-row action next to those.

</code_context>

<specifics>
## Specific Ideas

- The tutor explicitly reframed ZOOM-02 away from the roadmap's "invoice token"
  toward a **standalone "Send Zoom link" email** — she thinks of the class Zoom
  link as a separate parent communication from billing, not something bundled
  into an invoice. Keep the two email flows cleanly separated.
- Auto-open is about shaving the one extra click out of the "money shot" flow
  (generate → parent's inbox): after Generate & Freeze the draft should just be
  there, while she still sees the invoice + Copy in the tab she's on.
- Timezone is intentionally a no-op *this* phase — captured now purely to unblock
  Phase 5/6 scheduling. Don't over-build UI around it.

</specifics>

<deferred>
## Deferred Ideas

- **Editable Zoom-email template in Settings** — considered (D-08 option B) and
  deliberately deferred; v1.1 ships a fixed built-in message. Revisit only if
  the tutor wants to customize the Zoom email wording.
- **`{zoom}` merge token inside invoices** — the roadmap's original example
  (SC2); dropped in favor of the separate send (D-10). Could be re-added later
  if she ever wants the link in the invoice body too.
- **Zoom-API auto-created meetings (ZOOM-API-01)** — v2 per REQUIREMENTS.md;
  this phase is static per-student links only. Not in scope.
- **Consuming the timezone** — Phase 4 only stores it; class-day resolution
  (Phase 5) and invoice cadence (Phase 6) are the actual consumers.

### Reviewed Todos (not folded)
None — there were no pending todos to cross-reference.

Discussion stayed within Phase 4 scope (scheduling/cadence creep redirected to
Phases 5/6).

</deferred>

---

*Phase: 4-quick-wins-auto-open-email-zoom-links-timezone*
*Context gathered: 2026-07-06*
