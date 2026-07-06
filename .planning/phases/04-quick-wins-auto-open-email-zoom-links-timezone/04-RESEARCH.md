# Phase 4: Quick Wins — Research

**Researched:** 2026-07-06
**Method:** Inline (source-grounded against the live codebase; subagents unreliable in this env)
**Scope:** MAIL-05 (auto-open), ZOOM-01/02 (per-student link + separate send), SET-03 (timezone capture)

> Answers "what do I need to know to PLAN this well?" The only genuinely tricky
> bit is MAIL-05's pop-up-survival mechanics (CONTEXT D-02). Everything else is
> additive CRUD on already-shipped surfaces; the reusable assets are confirmed
> present and their exact signatures are captured below.

---

## 1. MAIL-05 — Pop-up-safe auto-open (the one hard part)

### The problem
A `window.open(url)` fired **after** `generateInvoiceAction` resolves is no
longer inside the original click gesture, so browsers block it as a pop-up. The
CONTEXT D-02 fix — grab a blank window handle synchronously **inside** the
Generate click, run the action, then redirect that handle once the action
returns — is the correct and only reliable pattern. Confirmed mechanics below.

### Confirmed React 19 flow (grounded in `components/invoice-preview-dialog.tsx`)
The dialog uses `useActionState(generateInvoiceAction, initialState)` and a
`<form action={formAction}>`. Two facts make D-02 work:

1. **`onSubmit` still fires for a function-action form.** In React 19 you can
   attach `onSubmit={handleSubmit}` to `<form action={formAction}>`. React
   dispatches the native submit event (your handler runs **synchronously,
   inside the user gesture**) and then invokes the action — provided you do
   **NOT** call `event.preventDefault()`. So `window.open("", "_blank")` inside
   `onSubmit` returns a real, un-blocked handle. Store it in a `useRef`.

2. **The success branch already exists.** The component already reacts to a
   resolved action in an "adjust-during-render" block:
   ```
   if (state !== prevState) {
     setPrevState(state);
     if (state.fieldErrors === null && state.invoiceId !== null) {
       setOpen(false);
       router.push(`/history/${state.invoiceId}`);   // ← D-09 landing
     }
   }
   ```
   The auto-open hooks into exactly this branch: build the Gmail URL from the
   action's returned draft, point the pre-opened handle at it, then navigate.

### Exact sequence to implement
- **onSubmit (sync, in gesture):** `popupRef.current = window.open("", "_blank")`.
  (Some hardened blockers still return `null` — treat a null handle as "blocked",
  fall through to navigate-only; the manual **Email Invoice** button on the
  landing page is the fallback, per D-04.)
- **Action resolves → success branch:**
  - Build `gmailUrl = buildGmailComposeUrl(state.emailDraft)`.
  - **If `isGmailUrlTooLong(gmailUrl)` (D-03):** `popupRef.current?.close()` and
    just `router.push('/history/[id]')` — the frozen invoice page's existing
    "too long — copy the text below" UI (`invoice-view.tsx`) handles it.
  - **Else if handle present:** `popupRef.current.location.href = gmailUrl`, then
    `router.push('/history/[id]')`.
  - **Else (blocked/null handle):** just `router.push('/history/[id]')`.
- **Action resolves → error branch (`fieldErrors !== null`, e.g. race lost / no
  unbilled sessions):** `popupRef.current?.close()` so no empty tab is orphaned;
  keep the dialog open (current behavior).

### Required action change (`lib/actions/invoices.ts`)
`generateInvoiceAction` already fetches `student` (has `parentEmail`) and
computes `renderedSubject` / `renderedBody`. It currently returns only
`{ fieldErrors, invoiceId }`. Extend `InvoiceActionState` and the success return
with the draft the client needs to build the Gmail URL **client-side** (reusing
`buildGmailComposeUrl` — do not build the URL on the server):
```
emailDraft: { to: string; subject: string; body: string } | null
```
Set it only on the success return; `null` on every error/early return and in
`initialState`. Sole consumer is `invoice-preview-dialog.tsx` — no other call
site breaks.

### Landmines
- **Never `preventDefault()` in the onSubmit** — it cancels the Server Action.
- **Do the `window.open` in `onSubmit`, not in an onClick on the button** — a
  `type="submit"` button's click also works, but keeping it on the form submit
  keeps it adjacent to the action and covers Enter-key submits too.
- **Setting `handle.location` during the render-phase state block** is a side
  effect, but it mirrors the component's existing `router.push`-in-render
  precedent; keep it in the same block for consistency (do not add a `useEffect`
  that races the navigation).
- **Over-length is silent** (Pitfall 5 from P3): `isGmailUrlTooLong` is the guard
  — must be checked before pointing the tab, exactly as `invoice-view.tsx` does.

---

## 2. ZOOM-01/02 — Per-student link + separate "Send Zoom link"

### Schema (ZOOM-01)
Add a **nullable** `zoomLink` column to `students` (`varchar`, generous length —
512). Nullable adds cleanly on `drizzle-kit push` against the live Neon DB (no
default backfill needed; existing rows get `NULL`). Preserve the existing
`onDelete: "restrict"` FKs on `sessions`/`invoices` (untouched by this change).

### Input + validation (ZOOM-01, D-05/D-06)
- Field added to `components/student-form-dialog.tsx` (add + edit) alongside
  parent email, `name="zoomLink"`, optional, `defaultValue={student.zoomLink ?? ""}`
  in edit mode.
- Validation follows the server-only zod pattern (`noValidate` on the form;
  server is sole gate). Blank is allowed; when present it must be an `http(s)`
  URL. zod v4 exposes top-level `z.url()` (same family as the existing
  `z.email()` used for `parentEmail`). Recommended shape:
  ```
  zoomLink: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.url("Enter a valid link starting with http:// or https://")
     .refine((u) => /^https?:\/\//i.test(u), "Link must start with http:// or https://")
     .optional(),
  )
  ```
  Requiring an explicit `http(s)` scheme is both the loose-URL check (D-05) AND a
  security guard: it blocks a `javascript:` value from ever being stored (defense
  in depth even though we never render it as an `href` in-app). Scheme coercion
  of a bare `zoom.us/...` is explicitly **out** (D-05 Claude's discretion) —
  reject with a clear message instead; keeps the validator simple and safe.
- `addStudentAction` / `editStudentAction` write `zoomLink: parsed.data.zoomLink ?? null`.

### Surfacing + send (ZOOM-02, D-07/D-08/D-09/D-10)
- **New client component** `components/send-zoom-link-button.tsx`. Given
  `{ studentName, parentEmail, zoomLink }`, it renders a Gmail-compose anchor
  **exactly like `invoice-view.tsx`'s "Email Invoice" anchor** —
  `<a href={gmailUrl} target="_blank" rel="noopener noreferrer">`. Because it is a
  direct anchor inside the user's click (no async round-trip), there is **no
  pop-up-blocker problem here** — MAIL-05's window-handle dance is unnecessary
  for the Zoom send.
- URL built with `buildGmailComposeUrl({ to: parentEmail, subject, body })` — the
  short built-in Zoom message can never exceed `GMAIL_URL_MAX_LEN` (1800), so no
  over-length/copy-fallback branch is warranted (avoiding over-engineering per
  v1.1 spirit; the invoice flow keeps its guard because invoice bodies can be
  long).
- **Hidden when the student has no `zoomLink`** (D-09 Claude's discretion:
  disabled-vs-hidden → hidden, keeps the roster clean; she sets a link via
  **Edit** to surface the button). Parent email is guaranteed present
  (P1 D-13 required+unique) — no no-recipient guard.
- **Built-in message** (D-08) lives in `lib/invoice/defaults.ts` (pure, no
  imports — same home as `DEFAULT_BODY_TEMPLATE`). A small pure builder:
  ```
  buildZoomEmailDraft(studentName, zoomLink) -> { subject, body }
  ```
  e.g. subject `"Zoom link for {studentName}'s tutoring"`, body a short greeting +
  the link + sign-off. NO editable Settings template (D-08 — deferred).
- **Wiring:** add `<SendZoomLinkButton .../>` into the `renderActions` callback in
  `app/(app)/page.tsx` (active roster only). `components/student-table.tsx` needs
  **no change** — it already renders whatever `renderActions` returns, and the
  archived page is deliberately not wired (D-07 = active roster).
- **Invoice templates unchanged (D-10):** `MERGE_FIELDS` in `lib/invoice/render.ts`
  stays at 5 fields — do NOT add a `{zoom}` token.

---

## 3. SET-03 — Local timezone capture

### Schema (D-12)
Add a **nullable** `timezone` column to `settings` (`varchar`, length 64).
**Decision: nullable, no NOT-NULL default.** This is both migration-safe (the
existing single row id=1 gets `NULL` on push — no default backfill) AND the right
UX: a NULL stored value lets the Settings form prefill the **browser-detected**
zone (D-11's auto-detect intent), instead of a hardcoded `America/New_York`
overwriting her real zone before she ever visits Settings.

### Input UX (D-11)
- Settings form control: a **shadcn `Select`** (`components/ui/select.tsx`,
  `@base-ui/react`) — the same primitive `session-form-dialog.tsx` already uses,
  so styling/keyboard behavior is consistent. (Native `<select>` was the other
  discretionary option; the shadcn Select matches the app's look.)
- The Select is a client control; its chosen value is mirrored into a hidden
  `name="timezone"` input so it submits with the existing `<form action=...>`
  (same hidden-input pattern `session-form-dialog.tsx` uses for `studentId`/
  `durationMinutes`/`date`).
- **Options:** a US shortlist (Claude's discretion, D-11):
  `America/New_York, America/Chicago, America/Denver, America/Los_Angeles,
  America/Phoenix, America/Anchorage, Pacific/Honolulu` — stored as
  `{ value: IANA, label: friendly }[]` in a new `lib/settings/timezones.ts`.
- **Default selection:** `props.timezone` if set, else
  `Intl.DateTimeFormat().resolvedOptions().timeZone` (browser-detected). If the
  detected/stored zone is **not** in the shortlist, inject it as an extra option
  so her real zone is selectable and never silently dropped.

### Validation (D-12)
Server-side, accept **any recognized IANA zone** (not just the shortlist — the
auto-detected zone may be anything). Robust check via a pure helper:
```
export function isValidIanaTimeZone(tz: string): boolean {
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; }
  catch { return false; }   // RangeError for unknown zones
}
```
Node 20 (the project's runtime, per CLAUDE.md ≥20.9) throws `RangeError` for
unknown `timeZone` values — the try/catch is the portable, dependency-free
validator. Wire it into `settingsFormSchema` as a `.refine`, allowing blank
(optional) so a first save without touching the field doesn't error.

### Consumption
**None this phase.** SET-03 only captures + stores the zone; Phase 5 (class-day
resolution) and Phase 6 (invoice cadence) are the consumers (CONTEXT D-12,
Deferred). Do not add any timezone-dependent calculation now.

---

## 4. Migration mechanics (all schema changes)

The project uses **`drizzle-kit push`** (schema-first, no committed SQL
migrations — `drizzle.config.ts` sets `out: ./drizzle` but the dir is empty;
prior phases pushed directly). Both new columns are **nullable adds**, which
`push` applies non-destructively to the live Neon DB. A single `[BLOCKING]`
push task after the schema edit is mandatory — build/typecheck pass off the
Drizzle types alone and would give a **false-positive** verification if the live
DB never got the columns (this is a known GSD schema-push gate).

Command: `npx drizzle-kit push` (reads `DATABASE_URL` from `.env.local` via the
`dotenv` call in `drizzle.config.ts`). Non-interactive: the adds are additive so
push should not prompt; if it ever prompts, the task is `autonomous: false`.

---

## 5. Confirmed reusable assets (signatures)

| Asset | Signature / fact | Used by |
|---|---|---|
| `lib/invoice/mailto.ts` | `buildGmailComposeUrl({to,subject,body}): string` (URLSearchParams — no manual concat); `isGmailUrlTooLong(url): boolean`; `GMAIL_URL_MAX_LEN=1800` | MAIL-05, ZOOM-02 |
| `components/invoice-view.tsx` | new-tab `<a href target=_blank rel=noopener>` + over-length guard + copy fallback — clone the anchor for ZOOM-02 | ZOOM-02 |
| `components/invoice-preview-dialog.tsx` | `useActionState` + adjust-during-render success branch (`router.push`) — the D-02 hook point | MAIL-05 |
| `lib/actions/invoices.ts` | `generateInvoiceAction` already has `student.parentEmail`, `renderedSubject`, `renderedBody` — just widen the return | MAIL-05 |
| `components/student-form-dialog.tsx` + `lib/validation/student.ts` + `lib/actions/students.ts` | add/edit modal, `noValidate`, `createInsertSchema`, `z.email()` precedent, `StudentActionState{fieldErrors}` | ZOOM-01 |
| `app/(app)/page.tsx` `renderActions` | per-row action slot (Edit + Archive) — add the Zoom send here, no table edit | ZOOM-02 |
| `components/settings-form.tsx` + `lib/validation/settings.ts` + `lib/actions/settings.ts` | page form, `noValidate`, single-row `onConflictDoUpdate` upsert | SET-03 |
| `components/ui/select.tsx` + `session-form-dialog.tsx` | shadcn Select usage pattern (value/onValueChange + hidden input to submit) | SET-03 |
| `lib/invoice/defaults.ts` | pure constants home (no imports) — add the Zoom message builder here | ZOOM-02 |

---

## 6. Open questions / assumptions

- **A1 (verify in exec):** React 19 fires `onSubmit` on a function-action form
  when `preventDefault` is not called, and `window.open` in that handler is
  un-blocked. High confidence (documented React behavior); the executor must
  drive the real generate flow (`/verify`) and confirm the draft tab opens
  without a blocker prompt on at least one browser.
- **A2:** `drizzle-kit push` applies both nullable adds without an interactive
  prompt. If it prompts, mark the push task `autonomous: false`.
- **A3:** `z.url()` exists in the project's zod v4 (`^4.4.3`) — mirrors the
  already-used `z.email()`. If absent, fall back to a `z.string().refine(URL-parse)`.
