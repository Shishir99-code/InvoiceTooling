# Phase 3: Invoicing, Email & History - Research

**Researched:** 2026-07-05
**Domain:** Atomic multi-statement DB writes over an HTTP-only Postgres driver (Neon), immutable snapshot schema design, client-side "mailto"-style email handoff, dependency-free template merge-fields
**Confidence:** HIGH (transactions, stack versions, existing-code integration) / MEDIUM (Gmail compose URL exact behavior — reverse-engineered, not officially documented by Google)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Invoice Text Format**
- **D-01:** Itemized, with session notes shown. Each billed session is a line item: `date · duration · amount`, plus the session's note appended when present (blank when absent). Then the total.
- **D-02:** Session notes are now PARENT-FACING. Rendering them on invoices makes them visible to parents. Surface this to the tutor (e.g. a subtle "notes appear on invoices" hint near the session note field). No schema change; a UI/labeling concern.
- **D-03:** Header shows the covered period range — the min-max date span of the billed sessions (e.g. "Jun 3 - Jun 17, 2026"), not a "generated on" date and not both. Per-invoice, frozen into the snapshot.
- **D-04:** No invoice numbers. Invoices are identified by student + date in history (see D-14).
- **D-05:** No tutor/business name or branding in the invoice text. Header is essentially "Tutoring Invoice - {student}" + period.

**Generate-Invoice Flow**
- **D-06:** Triggered per-student from the Dashboard. A "Generate invoice" action on each student's row on the existing who-owes-what Dashboard (P2 D-11). Not a separate Invoices page.
- **D-07:** Preview-then-confirm before freezing. Generation shows the exact rendered invoice text with a "Generate & freeze" confirm — the action is irreversible.
- **D-08:** Scope = ALL of the student's unbilled sessions (locked, not re-decided). No per-session cherry-picking in the generate step. If zero unbilled sessions, the generate affordance is disabled/hidden (Claude's discretion).
- **D-09:** After generating, land on the finished invoice with the send buttons ready (Gmail draft + copy) — generate → send is one continuous flow. Not a bounce back to the Dashboard.

**Settings, Template & Email Handoff**
- **D-10:** Gmail compose deep link is the PRIMARY "Email invoice" handoff (`https://mail.google.com/mail/?view=cm&fs=1&to=…&su=…&body=…`). The app never sends; she sends from her own client. A `mailto:` default-client link was the alternative and was not chosen as primary.
- **D-11:** "Copy invoice text" button is always present as a fallback (MAIL-03) — required because Gmail/mailto URLs have a ~2,000-char length ceiling and an itemized-with-notes invoice can exceed it and truncate. Planner should handle the over-length case gracefully.
- **D-12:** Template = the full email body, editable in Settings, with an `{invoice}` placeholder where the itemized list drops in. She controls greeting, tone, and closing around it.
- **D-13:** Supported merge fields: `{invoice}` (always), `{student}`, `{total}` (formatted $X.XX), `{zelle}`, `{period}`. Subject line is also editable in Settings and supports the same fields. Ship a sensible default template + default subject (Claude's discretion on exact wording).

**Invoice History & Mistake Recovery**
- **D-14:** History is a flat, newest-first log — one chronological list of every invoice showing student, generated/period date, period range, and total.
- **D-15:** Open a past invoice → view its frozen snapshot AND re-send/re-copy (HIST-02) — the same Gmail-draft + copy buttons are available on a historical invoice. Not view-only.
- **D-16:** Mistake recovery = DELETE the invoice + un-bill its sessions. Deleting it returns ALL of its sessions to unbilled (back on the Dashboard). Full delete (no "voided" tombstone) was chosen over a void-with-trace and over no-undo. This coexists with INV-03/INV-04 immutability: while an invoice exists its snapshot content is frozen and never retroactively altered by session edits — deletion removes the invoice wholesale rather than mutating it. Deletion is the only escape hatch; there is no partial edit of a generated invoice.

### Claude's Discretion
- Default template body + default subject-line wording (ship editable defaults).
- Settings page layout and where Settings + History live in the top nav.
- Zelle handle input: a single free-text field accepting an email OR phone (SET-01); loose validation only (non-empty; no strict phone/email format enforcement required).
- Empty/edge states: student with $0 unbilled → generate disabled/hidden; a session note that's blank → line omits the note segment; period range when a single session → single date.
- Exact "delete invoice" confirm affordance (reuse the existing confirm-dialog pattern) and whether delete is reachable from the invoice view, history row, or both.

### Deferred Ideas (OUT OF SCOPE)
- **MAIL-04 reconciliation (follow-up, not blocking):** MAIL-04 ("gracefully guard the send when a student has no parent email") is effectively moot because P1 D-13 made parent email required + unique — every student always has a recipient. Recommend either dropping MAIL-04 or restating it as a trivial invariant. Do not build a no-email guard UI.
- **Per-session cherry-picking at generate time** — deliberately NOT in scope (ROADMAP locks "all unbilled sessions"). If it ever becomes a real need, it's a v2 enhancement, not this phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SET-01 | Set/edit the Zelle handle (email or phone) used in invoice payment instructions | Settings schema sketch (single-row `settings` table); loose non-empty validation per Claude's Discretion — see Code Examples |
| SET-02 | Set/edit the email/invoice message template that fills into each send | `bodyTemplate`/`subjectTemplate` columns + dependency-free `renderTemplate()` merge-field pattern — see Architecture Pattern 3 |
| INV-01 | Generate an invoice for a student that totals all their unbilled sessions | Server Action re-`SELECT`s unbilled sessions server-side (never trusts client echo) — see System Architecture Diagram + Anti-Patterns |
| INV-02 | Generating an invoice produces a copyable text summary of the sessions and total | `renderedBody` frozen column + `formatCents`/`formatDuration` reuse — see Don't Hand-Roll, Code Examples (schema sketch) |
| INV-03 | Generating an invoice atomically marks its sessions billed and stores an immutable snapshot | `db.batch()` atomicity pattern (Architecture Pattern 1) resolves the core atomicity risk; see Pitfall 1 for the two-statement ID sequencing nuance |
| INV-04 | Editing/deleting a session after billing does not alter any previously generated invoice snapshot | Frozen `lineItems`/`renderedBody`/`totalCents` columns, never re-derived from live `sessions` — see Schema sketch, Anti-Patterns, Pitfall 4 |
| MAIL-01 | Open a pre-filled email draft in the user's own client, addressed to the parent | Gmail compose URL construction — see Code Examples, Pitfall 5/6 |
| MAIL-02 | Draft body contains invoice summary + Zelle instructions from the settings template | `renderTemplate()` merge fields (`{invoice}`, `{zelle}`, etc.) — see Architecture Pattern 3 |
| MAIL-03 | Copy invoice text to clipboard as a fallback | `navigator.clipboard.writeText()` — see Code Examples (MDN-cited) |
| MAIL-04 | Guard the send when a student has no parent email | Moot per P1 D-13 (parent email required+unique) — see Deferred Ideas above; no build needed |
| HIST-01 | View a log of all previously generated invoices | Flat newest-first query mirrors existing Dashboard/Sessions Server Component read pattern — see Recommended Project Structure |
| HIST-02 | Open a past invoice to see its frozen snapshot | Same `invoice-view.tsx` component reused for post-generate landing and History "open" — see System Architecture Diagram |
</phase_requirements>

## Summary

This phase's single highest-risk item is atomicity: generating an invoice must, in one indivisible unit, freeze a snapshot row and flip its sessions to `billed = true`; deleting an invoice must reverse both. The project's DB client (`lib/db/index.ts`) uses `drizzle-orm/neon-http`, and **`db.transaction()` is explicitly unsupported on that driver** — Drizzle and Neon's own docs confirm it throws `"No transactions support in neon-http driver"` at runtime. The fix does **not** require adding a second driver or dependency: Drizzle's **`db.batch([...])`** API is built specifically for `neon-http` and *is* atomic — Neon's underlying `transaction()` HTTP primitive concatenates all statements with a real `BEGIN`/`COMMIT`, sends them as one HTTP request, and rolls back automatically if any statement fails. This is a drop-in fit for both the generate-invoice and delete-invoice flows, using the exact same imports and `db` instance already in the codebase.

Everything else in this phase is standard CRUD following patterns already established in Phase 1/2 (`"use server"` + zod `safeParse` + `revalidatePath`, modal dialogs, responsive table→card lists). The two areas needing net-new design are (1) an `invoices` schema that stores enough frozen data to render a past invoice forever without re-touching `sessions`, and (2) the Gmail compose deep link + clipboard fallback, which is an unofficial-but-widely-used URL scheme with a practical (not hard-documented) length ceiling around ~2,000 characters — corroborating the phase's own D-11 decision to always show a copy-to-clipboard fallback.

**Primary recommendation:** Use `db.batch([...])` (not `db.transaction()`) on the existing `neon-http` driver for both invoice generation and invoice deletion; give `sessions` a nullable `invoiceId` FK (`onDelete: "set null"`) so un-billing is a single `UPDATE ... WHERE invoiceId = X` in the same batch as the invoice delete; store the invoice's line items as a frozen JSON array plus a separately-frozen rendered body/subject text, never re-rendering from live `sessions` rows.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Settings (Zelle handle, templates) | API / Backend (Server Action + Server Component read) | Database (single-row table) | Single-user config, read on every invoice render/generate; no client-only state needed |
| Invoice generation (total + freeze + bill) | API / Backend (Server Action, `db.batch`) | Database (invoices + sessions tables) | Atomicity requirement makes this a backend/DB-transaction concern exclusively; UI only triggers + previews |
| Invoice preview (pre-freeze) | Frontend Server (Server Component render of unsaved draft) | Browser/Client (confirm dialog) | Preview text can be computed server-side from unbilled sessions without writing; D-07 requires showing exact rendered text before commit |
| Email handoff (Gmail deep link + copy) | Browser / Client | — | Must run in the browser: opens a new tab via `window.open`/`<a target="_blank">` and uses `navigator.clipboard`, both client-only browser APIs |
| Invoice history (list + view snapshot) | Frontend Server (Server Component reads) | Browser/Client (open/re-send/delete interactions) | Read-heavy, no live aggregation — mirrors Dashboard/Sessions pattern already in the repo |
| Delete-and-un-bill | API / Backend (Server Action, `db.batch`) | Database | Same atomicity requirement as generation, reversed |

## Standard Stack

### Core
No new core libraries — this phase is built entirely on the stack already installed and locked in `CLAUDE.md` / `package.json`.

| Library | Version (installed) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `drizzle-orm` | 0.45.2 `[VERIFIED: npm registry, matches package.json]` | Schema, queries, `db.batch()` for atomic multi-statement writes | Already the project's ORM; `db.batch` is documented specifically for the `neon-http` driver this project uses |
| `@neondatabase/serverless` | 1.1.0 `[VERIFIED: npm registry, matches package.json]` | HTTP driver underlying `db.batch`'s atomic transaction primitive | Already the project's driver; no new driver needed for this phase's atomicity requirement |
| `zod` | 4.4.3 `[VERIFIED: npm registry, matches package.json]` | Settings form + generate/delete action input validation | Existing Server Action boundary convention (`sessionFormSchema`, `studentFormSchema`) |
| `date-fns` | 4.4.0 (installed) | Format invoice period range, `generatedAt` display in History | Already used in `dashboard-table.tsx` (`formatSessionDate`) |

### Supporting
No new supporting libraries. Merge-field templating, Gmail URL construction, and clipboard copy are all hand-rolled with zero dependencies (see Don't Hand-Roll section for why this is the *correct* call here, not a shortcut).

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `db.batch()` on `neon-http` | Add `drizzle-orm/neon-serverless` + `Pool` (WebSocket) purely for `db.transaction()` | Real interactive transactions (can branch mid-transaction on read results), but adds a second driver/connection type, a `ws` polyfill concern outside Node runtime, and is unnecessary here since neither generate nor delete needs to branch conditionally mid-write — batch's "fixed set of queries decided up front" model is a precise fit |
| Nullable `sessions.invoiceId` FK | Join table `invoice_sessions (invoiceId, sessionId)` | Join table is more "normalized" for potential future many-to-many, but D-08 locks "always ALL unbilled sessions" (never partial/many invoices per session) — a nullable FK is simpler, `onDelete: "set null"` gives free un-billing semantics, and matches the existing `sessions.studentId` FK style already in the schema |
| Frozen JSON line items + frozen rendered text | Re-render from `sessions` rows at view time, joining on `invoiceId` | Explicitly rejected by INV-04 — editing/deleting a session must never alter a past invoice; storing nothing but a session-id list would break immutability the moment a linked session is edited |
| Simple `{token}` string-replace for templates | `mustache`, `handlebars`, `es-toolkit` template helpers | 5 known, fixed merge fields (`{invoice}`, `{student}`, `{total}`, `{zelle}`, `{period}`) — a templating engine adds a dependency, a syntax surface (loops/conditionals) this app never needs, and an injection-shaped attack surface for zero benefit |

**Installation:**
```bash
# No new packages required for this phase.
```

**Version verification:** Confirmed live against npm registry 2026-07-05 — `drizzle-orm@0.45.2`, `@neondatabase/serverless@1.1.0`, `zod@4.4.3` all match `package.json` exactly; no drift from CLAUDE.md's recommended versions.

## Package Legitimacy Audit

**Not applicable — this phase introduces zero new npm packages.** All functionality (atomic batch writes, template merge-fields, Gmail URL construction, clipboard copy) is built from libraries already installed and audited in prior phases, plus hand-rolled browser/Node APIs (`navigator.clipboard`, `URLSearchParams`/`encodeURIComponent`). No `slopcheck`/registry verification step is required.

## Architecture Patterns

### System Architecture Diagram

```
Dashboard row (per-student, unbilled total)
        │  "Generate invoice" click
        ▼
Server Action: previewInvoice(studentId)          [Frontend Server / read-only]
        │  SELECT unbilled sessions WHERE studentId=X AND billed=false
        │  compute totalCents, period min/max date, render text (no writes yet)
        ▼
Preview modal (D-07) — shows exact rendered text, "Generate & freeze" confirm
        │  confirm click
        ▼
Server Action: generateInvoiceAction(studentId)   [API/Backend]
        │  1. SELECT unbilled sessions again (re-fetch inside the action —
        │     never trust client-echoed session IDs/amounts, same Pitfall-1
        │     precedent as sessions.ts)
        │  2. build frozen lineItems[] JSON + renderedBody + totalCents
        │  3. db.batch([
        │       db.insert(invoices).values({...}).returning({ id }),
        │       db.update(sessions).set({ billed: true, invoiceId: ??? })
        │         .where(inArray(sessions.id, sessionIds))
        │     ])   ← ATOMIC (see Pitfall 1 for the two-statement ID problem)
        ▼
revalidatePath("/dashboard"), revalidatePath("/history")
        ▼
Land on invoice view (D-09) — Gmail draft + Copy buttons ready
        │
        ├──▶ "Email invoice" → window.open(gmailComposeUrl)  [Browser/Client]
        └──▶ "Copy invoice text" → navigator.clipboard.writeText(renderedBody)

History list (flat, newest-first)  [Frontend Server]
        │  open a row
        ▼
Invoice view (same component as post-generate view) — renders the FROZEN
renderedBody/lineItems JSON, never re-queries `sessions`
        │
        ├──▶ re-send / re-copy (D-15, same buttons)
        └──▶ "Delete invoice" confirm → deleteInvoiceAction(invoiceId) [API/Backend]
                  db.batch([
                    db.update(sessions).set({ billed: false, invoiceId: null })
                      .where(eq(sessions.invoiceId, invoiceId)),
                    db.delete(invoices).where(eq(invoices.id, invoiceId))
                  ])   ← ATOMIC, un-bills all sessions in one shot
                  revalidatePath("/dashboard"), revalidatePath("/history")
```

### Recommended Project Structure
```
lib/
├── db/
│   └── schema.ts          # add `invoices` + `settings` tables here
├── actions/
│   ├── invoices.ts        # generateInvoiceAction, deleteInvoiceAction (mirrors sessions.ts)
│   └── settings.ts        # saveSettingsAction (single-row upsert)
├── validation/
│   ├── invoice.ts         # (mostly just an id schema — invoice content isn't user-typed)
│   └── settings.ts        # zelleHandle/bodyTemplate/subjectTemplate zod schema
└── invoice/
    ├── render.ts           # buildLineItems(), renderTemplate(), formatPeriod() — pure functions, unit-testable, no DB/React import
    └── mailto.ts           # buildGmailComposeUrl(), buildMailtoUrl() — pure functions

components/
├── settings-form.tsx           # clone of student-form-dialog pattern (not modal — settings is its own page)
├── invoice-preview-dialog.tsx  # D-07 preview-then-confirm modal, clones session-form-dialog's useActionState pattern
├── invoice-delete-confirm-dialog.tsx  # clones session-delete-confirm-dialog.tsx exactly
├── invoice-view.tsx             # shared by post-generate landing AND History → open-invoice (renders frozen snapshot + send/copy buttons)
└── invoice-history-table.tsx    # clones dashboard-table.tsx's table(md+)/cards(mobile) responsive pattern

app/(app)/
├── settings/page.tsx
└── history/page.tsx
```

### Pattern 1: Atomic batch write via `db.batch()` (neon-http)
**What:** Drizzle's `db.batch([...queries])` sends multiple pre-built Drizzle query objects as one HTTP request to Neon; Neon wraps them in a real `BEGIN...COMMIT` and rolls back all of them if any one fails.
**When to use:** Any place two+ writes must succeed or fail together on this project's `neon-http` driver — exactly the generate/delete invoice flows.
**Example:**
```typescript
// Source: https://orm.drizzle.team/docs/batch-api (confirmed atomic via
// https://neon.com/docs/serverless/serverless-driver + DeepWiki explainer of
// neondatabase/serverless's transaction() primitive, which db.batch wraps)
const [invoiceRow] = await db.batch([
  db
    .insert(invoices)
    .values({
      studentId,
      periodStart,
      periodEnd,
      totalCents,
      lineItems, // jsonb
      renderedBody,
      generatedAt: new Date(),
    })
    .returning({ id: invoices.id }),
  db
    .update(sessions)
    .set({ billed: true })
    .where(inArray(sessions.id, unbilledSessionIds)),
]);
```
**Caveat (verify at implementation time):** `db.batch` statements cannot read each other's results mid-batch (it's non-interactive) — you cannot get the just-inserted `invoices.id` back and use it in the *same* batch's `UPDATE ... SET invoiceId = ?` statement. See Pitfall 1 for the two viable resolutions.

### Pattern 2: `db.transaction()` is NOT available — do not attempt it
**What:** `drizzle-orm/neon-http`'s `db.transaction(async (tx) => {...})` throws `"No transactions support in neon-http driver"` at runtime (not a type error — it fails at call time).
**When to use:** Never, on this project's current driver. If a future phase needs truly interactive (read-then-branch) transactions, that requires switching (or adding a second connection) to `drizzle-orm/neon-serverless` with a WebSocket `Pool` — explicitly out of scope for this phase per the "don't add a driver you don't need" principle above.
**Example:**
```typescript
// Source: https://orm.drizzle.team/docs/connect-neon ,
// https://github.com/better-auth/better-auth/issues/4747 (exact error text)
// DO NOT WRITE THIS — it will throw at runtime on this project's db:
await db.transaction(async (tx) => { ... }); // ❌ throws on neon-http
```

### Pattern 3: Merge-field template rendering (dependency-free)
**What:** A single pure function that does sequential `String.prototype.replaceAll` (or one regex pass) over the five known tokens, run server-side at *send/render* time from the frozen invoice snapshot (not stored pre-rendered per-field, but the whole body IS frozen — see Schema section for the distinction between "template" (Settings, mutable) and "rendered body" (Invoice row, frozen)).
**When to use:** Settings body/subject template → concrete Gmail draft body/subject, both at initial generation and on every re-send from History.
**Example:**
```typescript
// lib/invoice/render.ts — pure function, no React/DB import
const MERGE_FIELDS = ["invoice", "student", "total", "zelle", "period"] as const;

function renderTemplate(
  template: string,
  values: Record<(typeof MERGE_FIELDS)[number], string>,
): string {
  return MERGE_FIELDS.reduce(
    (text, field) => text.replaceAll(`{${field}}`, values[field]),
    template,
  );
}
// Unknown/typo'd tokens (e.g. "{Invoice}" or "{stuent}") are simply left
// verbatim in the output — no throw, no silent strip — matching D-13's
// "Claude's discretion" latitude and giving the tutor an obvious visual cue
// (a literal "{stuent}" in her draft) that she mistyped a field, rather than
// silently disappearing text.
```

### Anti-Patterns to Avoid
- **Re-deriving a historical invoice from live `sessions` rows:** breaks INV-04 the moment any linked session is later edited/deleted. Always render History's "open invoice" view from the frozen `invoices.lineItems`/`renderedBody` columns, never a fresh JOIN.
- **`dangerouslySetInnerHTML` for notes or template body:** session notes are now parent-facing (D-02) and the template is user-authored free text — render everything as plain React text nodes (auto-escaped) or plain-text `<pre>`, never raw HTML injection, even though this is a single-trusted-user app.
- **Trusting client-submitted session IDs/amounts for the invoice total:** mirror the `addSessionAction`/`editSessionAction` precedent — re-`SELECT` the unbilled sessions server-side inside `generateInvoiceAction` rather than accepting an ID list or total from the preview step's form payload.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic multi-statement write on `neon-http` | A manual "insert, then update, then if update fails try to delete the insert" compensating-transaction shim | `db.batch([...])` | Neon already gives you real `BEGIN`/`COMMIT`/rollback semantics in one HTTP call — a hand-rolled compensating transaction can itself fail partway (e.g. process crash between insert and delete), which `db.batch` structurally cannot |
| Template variable substitution | A mini template engine / parser for `{field}` syntax | `String.replaceAll` over a fixed known token list | Only 5 fixed fields, no loops/conditionals ever needed — a parser is solving a problem this app doesn't have |
| Money/duration formatting on invoice lines | New formatting logic in the invoice renderer | `formatCents`/`formatDuration` from `lib/format.ts` | Explicitly built to be this phase's single source of truth per its own doc comment — duplicating logic here risks the invoice total ever showing differently than the Dashboard |

**Key insight:** Every "hard part" of this phase (atomicity, immutability, formatting) already has an existing, tested answer either in Neon's own HTTP transaction primitive or in this repo's `lib/format.ts` — the risk is not missing library but *reaching past* those answers into either the wrong driver API (`db.transaction`) or a duplicated formatter.

## Common Pitfalls

### Pitfall 1: `db.batch()` can't use the insert's returned ID in the same batch's UPDATE
**What goes wrong:** You want to `INSERT INTO invoices ... RETURNING id` and then `UPDATE sessions SET invoice_id = <that id>` — but batch statements are all built and sent together; the second statement can't reference the first's runtime result.
**Why it happens:** `db.batch` is Neon's *non-interactive* transaction primitive — all queries are serialized up front, not evaluated as a JS async sequence with intermediate branching.
**How to avoid — two viable resolutions (planner should pick one):**
  1. **Two-step, not one-batch:** Do `db.insert(invoices).values({...}).returning({ id })` as its own single statement (a single INSERT is not itself at atomicity risk — it either fully succeeds or fully fails per normal SQL semantics), THEN immediately `db.batch([ db.update(sessions).set({ billed: true, invoiceId: newId }).where(inArray(...)) ])` — the un-billing risk this phase actually cares about is "invoice exists but sessions not billed" or vice versa; if the insert succeeds but the process dies before the update batch runs, you have an orphaned invoice with no billed sessions, which is a detectable, recoverable inconsistency (not silent data loss) — recommend the generate action re-check for this and either complete the bill-step or let the tutor delete-and-retry (D-16 already covers deleting bad invoices).
  2. **Reserve the ID first:** insert a placeholder invoice row (or use a DB sequence value fetched via `nextval`) in a preceding single statement, then batch the fully-formed insert (with the pre-known ID) + the sessions update together. More complex; only worth it if two-step's small inconsistency window is unacceptable for a single-user low-concurrency app (it almost certainly is not).
  Given this is a single-user app with no concurrent writers, **recommend resolution 1** — simplest, and the tiny window between the two statements is not a realistic real-world failure mode.
**Warning signs:** If a plan tries to build one `db.batch([...])` call where the second statement's `.values()`/`.set()` references a variable that only exists after "awaiting" the first statement's result — that's the tell this pitfall wasn't resolved.

### Pitfall 2: Reaching for `db.transaction()` out of habit
**What goes wrong:** Every other Drizzle tutorial/example shows `db.transaction(async (tx) => {...})` as *the* transaction pattern — it's the far more commonly documented API. A planner or implementer skimming general Drizzle docs (not this project's specific driver caveat) may write it and only discover the runtime throw during execution/testing.
**Why it happens:** `db.transaction()` works fine on `node-postgres`, `postgres.js`, and `neon-serverless` (WebSocket) — it's *only* `neon-http` (this project's driver) that lacks it. The restriction isn't in the function's TypeScript signature, so it type-checks fine and only fails at runtime.
**How to avoid:** Any task touching invoice generate/delete must explicitly use `db.batch`, never `db.transaction`. Flag this in the plan's verification steps.
**Warning signs:** `npm run build` will NOT catch this (matches this project's own STATE.md precedent from 02-04 where a "use server" export-shape bug also wasn't caught by build) — only a live execution/checkpoint test of the generate/delete flow will surface the runtime throw.

### Pitfall 3: `sessions.studentId`'s `onDelete: "restrict"` does not, by itself, protect invoice history
**What goes wrong:** The existing FK (`sessions.studentId → students.id ON DELETE RESTRICT`) only stops a *student* row from being hard-deleted while sessions reference it — students are archived, never hard-deleted (Phase 1 D-10), so this was never actually a live risk for students. But if `invoices.studentId` is added without its own `onDelete` decision, deleting a student (even though the app never does this via UI) or an ON CASCADE default could silently orphan/destroy invoice history.
**Why it happens:** Copy-pasting the sessions FK pattern without re-deciding `onDelete` per relationship.
**How to avoid:** Set `invoices.studentId` to `onDelete: "restrict"` as well (matches the sessions precedent, and the app never hard-deletes students anyway) so history is provably safe even if a future phase ever adds hard-delete.
**Warning signs:** Missing/absent `onDelete` in the new `invoices` table definition (Postgres/Drizzle default is `NO ACTION`, which behaves similarly to `RESTRICT` in practice but should be explicit to match the codebase's "comment-annotated style" convention).

### Pitfall 4: Rendering the invoice body from the *current* Settings template instead of the frozen one
**What goes wrong:** If the tutor edits her Settings template/subject *after* generating an invoice, and History's "re-send" re-renders using the *current* (edited) template rather than the one frozen at generation time, a re-sent invoice's wording could silently drift from what she originally sent — or worse, from what's shown in the Invoice History's "view" (which correctly shows the frozen snapshot).
**Why it happens:** It's tempting to store only `lineItems` + `totalCents` in `invoices` and re-run `renderTemplate()` against the live Settings row every time the invoice is viewed/re-sent, since that's less storage and feels "DRY."
**How to avoid:** Freeze the **fully rendered body and subject** into the `invoices` row at generation time (in addition to structured `lineItems` for possible future re-formatting needs). "Re-send" (D-15) means re-opening the same Gmail draft with the SAME frozen text — never a live re-render against Settings' current template. This is a direct extension of INV-03/04's "immutable snapshot" requirement to the email content, not just the line items.
**Warning signs:** A plan step that calls `renderTemplate()` at *view/resend* time using a live `db.select().from(settings)` read, rather than reading the pre-rendered `invoices.renderedBody` column.

### Pitfall 5: Gmail compose URL silently truncating without any error
**What goes wrong:** Unlike a form validation error, an over-length Gmail compose URL doesn't throw or reject — Gmail just opens with a truncated/garbled body, and the tutor may not notice before hitting Send.
**Why it happens:** The Gmail compose URL scheme (`https://mail.google.com/mail/?view=cm&fs=1&to=…&su=…&body=…`, per this project's D-10-locked format) is an unofficial, reverse-engineered URL pattern — Google has never published a stable spec or documented length limit for it. Community write-ups converge on a *practical* safe ceiling of roughly 2,000 characters (consistent with the historical mailto/Outlook 1,026-char precedent CLAUDE.md already cites) before browsers/Gmail may truncate or mishandle the URL, but there's no hard documented number.
**How to avoid:** Compute the fully-encoded URL's length before opening it; if it exceeds a conservative threshold (recommend ~1,800–2,000 chars as a safety margin, matching CLAUDE.md's own prior research), either (a) skip opening Gmail and force the copy-to-clipboard fallback with a clear inline message ("This invoice is too long for a pre-filled email — copy the text below and paste it into your email"), or (b) still open Gmail with a shortened body (e.g. just the greeting + total + "see attached/pasted details") and prominently surface the copy button. Given D-11 already mandates the copy button be **always present** (not conditionally shown), recommend the simpler (a): the copy button is already there regardless, so on over-length bodies just suppress/disable the Gmail button (or open it with a truncation warning) rather than silently sending a corrupted draft.
**Warning signs:** No length check exists in the button's click handler before `window.open(gmailUrl)`.

### Pitfall 6: URL-encoding line breaks incorrectly in the Gmail `body` param
**What goes wrong:** Passing a raw `\n` inside a string built into a URL via plain string concatenation (rather than `encodeURIComponent`) produces an invalid/broken URL rather than a line break in the compose window.
**Why it happens:** `encodeURIComponent("\n")` correctly produces `%0A`, which Gmail's compose URL interprets as a line break — but hand-written string interpolation that forgets to run the body through `encodeURIComponent` (or uses `escape()`/`btoa()` by mistake) will not produce `%0A` and can break the whole URL at the first raw newline/space.
**How to avoid:** Build the URL with `URLSearchParams` (which encodes automatically, including `\n` → `%0A`... verify this specific behavior on implementation, see note below) or explicit `encodeURIComponent(body)` on each param value, never manual string concatenation of raw text into a URL.
**Note (unverified — flag for implementation-time check):** `URLSearchParams`'s `toString()` encodes spaces as `+` rather than `%20`; multiple community write-ups on Gmail-compose-URL construction use `+`-for-space with `%0A` for newlines, but this was **not independently confirmed against a live Gmail compose test in this research session** — recommend the planner include a manual "open the generated URL and confirm the draft renders correctly" checkpoint rather than trusting either encoding scheme as certain.

## Code Examples

### Gmail compose URL construction
```typescript
// Source: https://til.simonwillison.net/google/gmail-compose-url (community
// reverse-engineering write-up, MEDIUM confidence — not an official Google
// API/spec) + this project's own CLAUDE.md-locked format (D-10)
function buildGmailComposeUrl(params: {
  to: string;
  subject: string;
  body: string;
}): string {
  const query = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: params.to,
    su: params.subject,
    body: params.body,
  });
  return `https://mail.google.com/mail/?${query.toString()}`;
}
```
**Note:** community sources also document a newer `tf=cm` param replacing `view=cm&fs=1` in some Gmail UI versions — since D-10 explicitly locks the `view=cm&fs=1` form, ship that, but if manual testing during implementation shows it no longer opens a compose window reliably, `tf=cm` is the documented fallback to try (not a research-time blocker, a note for the implementer).

### Clipboard copy fallback
```typescript
// Source: MDN Clipboard API (https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText)
// [CITED: MDN] — requires a secure context (HTTPS, which Vercel provides) and
// a user-gesture-triggered call (a button onClick satisfies this).
async function copyInvoiceText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false; // caller shows a manual "select and copy" textarea fallback
  }
}
```

### Invoice schema sketch
```typescript
// lib/db/schema.ts additions — follow existing integer-cents +
// comment-annotated style
export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "restrict" }), // mirrors sessions' FK style (Pitfall 3)
  periodStart: date("period_start", { mode: "string" }).notNull(), // D-03: min session date
  periodEnd: date("period_end", { mode: "string" }).notNull(), // D-03: max session date
  totalCents: integer("total_cents").notNull(), // frozen sum at generation (D-14 philosophy extended)
  lineItems: jsonb("line_items").notNull(), // frozen array: {date, durationMinutes, amountCents, notes}[]
  renderedBody: text("rendered_body").notNull(), // frozen full email body incl. merge fields resolved (Pitfall 4)
  renderedSubject: varchar("rendered_subject", { length: 500 }).notNull(),
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
});

// sessions gets one new nullable column:
// invoiceId: integer("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
// -- nullable: unbilled sessions have invoiceId = null; billed sessions point
// -- at the invoice that billed them; deleting an invoice (ON DELETE SET NULL)
// -- automatically un-links sessions even outside the batch call, though the
// -- explicit `billed = false` flip still must happen in the same db.batch
// -- (SET NULL alone does not touch the `billed` boolean).

export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1), // single-row table, always id=1
  zelleHandle: varchar("zelle_handle", { length: 255 }).notNull().default(""),
  subjectTemplate: varchar("subject_template", { length: 500 }).notNull(),
  bodyTemplate: text("body_template").notNull(),
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `mailto:` links for pre-filled email | Gmail compose deep link (`https://mail.google.com/mail/?view=cm&...`) for Gmail-specific users | N/A — both remain valid, this is a per-provider choice, not a deprecation | D-10 already locked Gmail-specific as primary since the tutor's stated email is Gmail; `mailto:` remains the universal fallback pattern CLAUDE.md documents but is not this phase's primary path |
| `view=cm&fs=1` Gmail URL params | Some 2025-2026 community write-ups show `tf=cm` replacing `fs=1`/`view=cm` | Undocumented/informal, exact date unclear | Low impact — `view=cm&fs=1` reportedly still works per multiple sources; flagged as an implementation-time manual-test item, not a blocking finding |

**Deprecated/outdated:** None identified specific to this phase's stack — all core libraries are current per the version-verification step above.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Gmail compose URL practical length ceiling is ~2,000 characters before truncation/corruption | Common Pitfalls (Pitfall 5), Code Examples | If the real ceiling is meaningfully lower or higher, the length-check threshold either falsely blocks valid short invoices or lets a truncated draft through silently — low-severity either way since the copy button (D-11) is the guaranteed fallback regardless |
| A2 | `URLSearchParams.toString()` correctly encodes `\n` in the body param the way Gmail expects (as `%0A`) | Pitfall 6 | If the encoding is subtly wrong, the pre-filled draft would show garbled text or literal `%0A` instead of line breaks — degrades UX but doesn't lose data (copy fallback still works); needs a manual browser test at implementation time |
| A3 | `view=cm&fs=1` (this project's locked D-10 format) still reliably opens a Gmail compose window as of 2026, vs. the newer `tf=cm` param seen in some write-ups | State of the Art, Code Examples | If it's stopped working, the "Email invoice" button would silently fail to open Gmail (or open the inbox instead) — should be caught immediately in first manual test since it's the core "money shot" flow (D-09) |
| A4 | Two-step resolution to Pitfall 1 (single INSERT, then separate `db.batch` for the sessions UPDATE) is an acceptable atomicity tradeoff for this single-user app | Pitfall 1 | If the tutor somehow triggers concurrent generate-invoice actions (not expected — single user, one browser tab at a time in practice) there's a narrow window where an invoice row could exist with its sessions not yet billed; recovery path (delete-and-retry, D-16) already exists if this is ever hit |

**If this table is empty:** N/A — see entries above; all core stack/version and atomicity claims were independently verified via official docs (Drizzle, Neon) and are not in this table.

## Open Questions

1. **Exact Gmail URL param set behavior in 2026 (`view=cm&fs=1` vs `tf=cm`)**
   - What we know: D-10 locks `view=cm&fs=1&to=…&su=…&body=…` as the format to build; multiple community sources (2020-2025) confirm this works; at least one more recent source suggests Gmail's UI has also started accepting/preferring `tf=cm`.
   - What's unclear: whether `view=cm&fs=1` might stop working entirely at some point, or whether both continue to work simultaneously (most likely, since Google rarely breaks long-standing deep-link behavior without notice).
   - Recommendation: Ship the D-10-locked format as specified; add a first-manual-test checkpoint (already implied by `human_verify_mode: end-of-phase` in config.json) that explicitly confirms the Gmail draft opens correctly with real recipient/subject/body before considering this phase done.

2. **Precise safe length threshold for the Gmail compose URL before recommending the copy-fallback path over opening the link**
   - What we know: ~2,000 characters is the practical ceiling cited across multiple (dated, informal) sources for URL-based mailto-style links generally; no official Gmail-specific number exists.
   - What's unclear: the exact number, and whether it varies by browser (Chrome vs Safari vs Firefox address-bar/anchor-tag length limits differ).
   - Recommendation: Pick a conservative threshold (~1,800 chars of the fully-encoded URL) as a first pass; since D-11 already guarantees the copy button is always visible regardless of length, getting this exactly right is a UX-polish concern, not a correctness/data-loss risk.

## Environment Availability

No external tool/service dependencies beyond what Phases 1-2 already require (Neon Postgres, Vercel). Skipping this section per the "code/config-only + no new external dependencies" condition — this phase adds only new tables/columns to the existing Neon database and zero new services.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (new) | Already covered site-wide by Phase 1's `iron-session` gate + `middleware.ts` matcher (`/((?!login|_next/static|_next/image|favicon.ico).*)`), which automatically covers new `/settings` and `/history` routes with zero changes needed |
| V3 Session Management | No (new) | Same as above — no new session concept introduced |
| V4 Access Control | Yes | Single-user app, no per-resource authorization needed beyond the existing global gate; verify `generateInvoiceAction`/`deleteInvoiceAction`/`saveSettingsAction` are Server Actions (server-boundary enforced, not client-callable API routes with weaker guarding) |
| V5 Input Validation | Yes | `zod` `safeParse` at every new Server Action boundary (settings form fields, invoice/generate id params) — mirror `sessionFormSchema`/`studentFormSchema` exactly |
| V6 Cryptography | No (new) | No new secrets/crypto introduced this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stored XSS via session notes or Settings template rendered on the invoice/History view | Tampering / Information Disclosure | Render all user-authored text (notes, template body) as plain React text nodes (auto-escaped) — never `dangerouslySetInnerHTML`; this matters more now than in Phase 2 because D-02 makes notes parent-facing and the template is fully free-text (D-12) |
| Broken/malformed Gmail URL from unescaped user input (Zelle handle, student name, notes) reaching the `body`/`su` query params | Tampering | Always build the Gmail URL via `URLSearchParams`/`encodeURIComponent`, never manual string concatenation (see Pitfall 6) — a stray `&` or `#` in a session note could otherwise inject extra query params or truncate the URL |
| Trusting client-submitted invoice totals/session IDs at generate time | Tampering | Re-`SELECT` unbilled sessions server-side inside `generateInvoiceAction` (never accept a session-ID list or total from the preview step's form payload) — same precedent as `addSessionAction`/`editSessionAction`'s server-side `rateCents` re-fetch |
| Un-authenticated access to `/settings` or `/history` (exposing Zelle handle / parent emails / invoice contents) | Information Disclosure | Already fully mitigated by the existing global middleware matcher — confirm during planning that no new route is accidentally added to a matcher-exclusion list, but no code change should be needed |

## Sources

### Primary (HIGH confidence)
- [Drizzle ORM — Connect to Neon](https://orm.drizzle.team/docs/connect-neon) — `neon-http` vs `neon-serverless` driver choice, transaction support statement
- [Drizzle ORM — Batch API](https://orm.drizzle.team/docs/batch-api) — `db.batch()` signature and supported statement builders
- [Drizzle ORM — Transactions](https://orm.drizzle.team/docs/transactions) — general `db.transaction()` API shape (confirmed it does not itself document the neon-http exception — cross-verified via Neon's own docs and a live GitHub issue)
- [Neon Docs — Serverless driver](https://neon.com/docs/serverless/serverless-driver) — HTTP vs WebSocket driver tradeoffs, `transaction()` primitive description
- [Neon `serverless` GitHub repo](https://github.com/neondatabase/serverless) — source of truth for the underlying `neon()` sql client `transaction()` function that `db.batch` builds on
- npm registry (`npm view drizzle-orm/@neondatabase/serverless/zod version`, checked 2026-07-05) — confirms installed versions match CLAUDE.md's recommendations exactly
- [MDN — Clipboard.writeText()](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText) — secure-context + user-gesture requirement for the copy fallback

### Secondary (MEDIUM confidence)
- [better-auth/better-auth GitHub issue #4747](https://github.com/better-auth/better-auth/issues/4747) — exact runtime error text `"No transactions support in neon-http driver"`, cross-verified against Drizzle/Neon's own docs stating the same limitation
- [DeepWiki — neondatabase/serverless Transactions API](https://deepwiki.com/neondatabase/serverless/2.4-transactions-api) — detailed explanation that `transaction()` concatenates queries with `BEGIN`/`COMMIT` in one HTTP request and auto-rolls-back on failure (community-maintained doc-explainer, not Neon's own page, but consistent with Neon's official docs' wording)
- [Simon Willison's TIL — Generating URLs to a Gmail compose window](https://til.simonwillison.net/google/gmail-compose-url) — Gmail compose URL param reference, including the `tf=cm` note
- [neondatabase/serverless GitHub Issue #31 — Support transactions using HTTP via batched queries](https://github.com/neondatabase/serverless/issues/31) — origin/history of the batch-transaction feature

### Tertiary (LOW confidence)
- Assorted Gmail-compose-URL blog posts/gists (w3tutorials.net, GoodMeasuresLLC gmail_compose_encoder, various SEO-style write-ups) on exact character limits and encoding — no single authoritative source found; treated as corroborating-but-unverified per the Assumptions Log

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new packages, all versions independently confirmed against npm registry and matching an already-locked CLAUDE.md
- Architecture (atomicity/schema): HIGH — `db.batch()` atomicity and `db.transaction()`'s neon-http limitation both cross-verified across Drizzle's own docs, Neon's own docs, and a live reproduced runtime error report
- Pitfalls: HIGH for the DB/transaction pitfalls (directly sourced); MEDIUM for the Gmail-URL-specific pitfalls (unofficial URL scheme, no authoritative spec exists to fully verify against)

**Research date:** 2026-07-05
**Valid until:** 30 days for the Drizzle/Neon transaction findings (stable, versioned library behavior); reduce to ~14 days confidence window for the Gmail compose URL specifics since that's an unofficial, undocumented scheme Google could alter without a changelog entry
