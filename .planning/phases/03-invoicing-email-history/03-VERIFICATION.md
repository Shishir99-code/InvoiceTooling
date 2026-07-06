---
phase: 03-invoicing-email-history
verified: 2026-07-05T00:00:00Z
status: gaps_found
score: 4/5 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Generating an invoice atomically marks its sessions as billed and freezes the invoice as an immutable point-in-time snapshot"
    status: partial
    reason: "The freeze/immutability half is real and verified (invoice view and History read only frozen `invoices` columns, never re-join `sessions`; editing a billed session's own row does not touch the invoice snapshot). The 'atomically marks ... billed' half is NOT achieved: generateInvoiceAction performs a lone `INSERT ... RETURNING id` and then, as a separate DB round-trip, a `db.batch([...])` containing only the sessions UPDATE. Wrapping a single UPDATE in db.batch does not tie it to the preceding INSERT — there is no single atomic operation covering both writes. Already documented as WR-01 in 03-REVIEW.md ('the highest-impact defect here' for a financial app): a crash/network failure between the two writes leaves an invoice row whose covered sessions still read billed=false (re-appear on the Dashboard, invoiceable a second time), and two concurrent Generate submissions (two tabs) can both re-SELECT the same unbilled set and each insert a separate invoice for the same sessions."
    artifacts:
      - path: "lib/actions/invoices.ts"
        issue: "Lines 122-133 (INSERT...RETURNING) and 135-145 (separate db.batch UPDATE) are two independent DB round-trips, not one atomic statement — see WR-01 in 03-REVIEW.md for a concrete single-db.batch CTE fix."
    missing:
      - "Combine the invoice INSERT and the sessions UPDATE into a single db.batch statement/CTE (03-REVIEW.md WR-01 shows the exact SQL), OR explicitly accept the current two-round-trip design via a VERIFICATION.md override with sign-off, given the single-user/low-concurrency threat model already discussed in 03-RESEARCH.md's Pitfall 1."
---

# Phase 3: Invoicing, Email & History Verification Report

**Phase Goal:** Tutor can turn unbilled sessions into an invoice, email it to a parent, and look back at everything she's billed.
**Verified:** 2026-07-05T00:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

**Note on MVP mode:** ROADMAP.md declares `Mode: mvp` for this phase, but the phase goal text ("Tutor can turn unbilled sessions into an invoice, email it to a parent, and look back at everything she's billed.") is not phrased as a `As a ..., I want to ..., so that ....` User Story, and the `gsd-tools` CLI referenced by the MVP-mode verification procedure is not installed in this environment. The launching task itself supplied the 5 Success Criteria in standard observable-truth form (not a user-flow table) and asked for standard goal-backward verification, which is what follows below. This is a process note, not a phase-goal blocker — flagging it in case `/gsd mvp-phase 03` should be run to reconcile the ROADMAP mode declaration with the goal wording.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can set and edit her Zelle handle and an editable email/invoice message template that fills into every invoice send. | ✓ VERIFIED | `lib/db/schema.ts` `settings` single-row table; `lib/actions/settings.ts` `saveSettingsAction` validates (zod, trim+min(1)) and upserts via `onConflictDoUpdate({target: settings.id, ...})`; `app/(app)/settings/page.tsx` reads row `id=1` falling back to `DEFAULT_SUBJECT_TEMPLATE`/`DEFAULT_BODY_TEMPLATE`/`""`; `components/settings-form.tsx` renders all 3 fields, per-field errors, "Saved." flash on success. Nav has `/settings` entry (`components/top-nav.tsx`). |
| 2 | User can generate an invoice for a student that totals all their unbilled sessions into a copyable text summary. | ✓ VERIFIED | `lib/actions/invoices.ts` `generateInvoiceAction` re-SELECTs `sessions` where `studentId` matches AND `billed=false` (never trusts client-echoed ids/total), sums `amountCents`, builds `lineItems`/`renderInvoiceText` via `lib/invoice/render.ts`. `components/invoice-view.tsx` has a "Copy Invoice Text" button (`navigator.clipboard.writeText(renderedBody)`) with an auto-selected read-only `<textarea>` fallback on failure. |
| 3 | Generating an invoice atomically marks its sessions as billed and freezes the invoice as an immutable point-in-time snapshot (line items, rendered text, and total frozen at generation) — editing or deleting a billed session afterward never alters that past invoice. | ✗ FAILED (partial) | Immutability half VERIFIED: `/history/[id]/page.tsx` and `InvoiceView` read only frozen `invoices` columns (`renderedBody`, `renderedSubject`, `totalCents`, `lineItems`), never re-join or re-derive from `sessions` — confirmed no `from(sessions)` in the route. Atomicity half FAILED: `lib/actions/invoices.ts:122-145` performs the invoice `INSERT...RETURNING id` and the sessions `UPDATE` (wrapped alone in `db.batch`) as two separate round-trips with no shared transaction — see gap detail above and 03-REVIEW.md WR-01. |
| 4 | User can open a pre-filled email draft in their own email client addressed to the student's parent (invoice summary + Zelle instructions from the template), with a copy-to-clipboard fallback when the email client is unavailable or the body is too long, and a graceful guard when a student has no parent email on file. | ✓ VERIFIED | `lib/invoice/mailto.ts` `buildGmailComposeUrl` builds `https://mail.google.com/mail/?view=cm&fs=1&to=...&su=...&body=...` via `URLSearchParams` (no manual concatenation — confirmed via grep, no literal `?view=cm&fs=1&to=` string present). `components/invoice-view.tsx` renders it as an accent `<a target="_blank" rel="noopener noreferrer">` when `!isGmailUrlTooLong(gmailUrl)` (threshold 1800 chars), else hides the anchor and shows the guard message with Copy still present. No-parent-email guard is satisfied by invariant, not UI: `students.parentEmail` is `varchar(...).notNull()` in `lib/db/schema.ts` and required+email-validated in `lib/validation/student.ts`, so the no-email case cannot occur — documented explicitly in a code comment in `invoice-view.tsx` (MAIL-04 note). |
| 5 | User can view a log of every previously generated invoice and open any one to see its frozen snapshot (student, sessions, total, generated date). | ✓ VERIFIED | `app/(app)/history/page.tsx` selects `invoices` leftJoin `students` `orderBy(desc(invoices.generatedAt))` (flat, newest-first). `components/invoice-history-table.tsx` renders Student/Period/Total/Generated/Actions columns + "View" link to `/history/{id}` + an empty state ("No invoices yet" + "Go to Dashboard" link) when zero rows. `/history/[id]` reuses the same frozen-snapshot `InvoiceView` built in Plan 02, including Email/Copy/Delete affordances (D-15). |

**Score:** 4/5 truths verified (1 partial failure — see Gaps Summary)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/db/schema.ts` | `invoices`, `settings` tables + `sessions.invoiceId` FK | ✓ VERIFIED | All three present; `onDelete: "restrict"` on `invoices.studentId`, `onDelete: "set null"` on `sessions.invoiceId`, exactly as planned. |
| `lib/actions/settings.ts` | `saveSettingsAction`, `SettingsActionState` | ✓ VERIFIED | Exports both; single-row `onConflictDoUpdate` upsert. |
| `components/settings-form.tsx` | Settings page form | ✓ VERIFIED | `useActionState` + `noValidate` + per-field errors + "Saved." flash. |
| `app/(app)/settings/page.tsx` | Server Component reading settings row | ✓ VERIFIED | Reads `id=1`, falls back to defaults. |
| `lib/invoice/defaults.ts` | `DEFAULT_SUBJECT_TEMPLATE`, `DEFAULT_BODY_TEMPLATE` | ✓ VERIFIED | Both exported, exact UI-SPEC wording. |
| `lib/invoice/render.ts` | `buildLineItems`, `formatPeriod`, `renderInvoiceText`, `renderTemplate`, `InvoiceLineItem` | ✓ VERIFIED | All exported, pure, reuses `formatCents`/`formatDuration` from `lib/format.ts`; `renderTemplate` leaves unknown tokens verbatim. |
| `lib/actions/invoices.ts` | `generateInvoiceAction`, `deleteInvoiceAction`, `InvoiceActionState` | ⚠️ WIRED but with a correctness gap | Both actions exist, are exported, and are called from the UI. `generateInvoiceAction`'s internal atomicity is the gap in Truth 3 above. `deleteInvoiceAction` correctly uses one `db.batch([update, delete])` covering both writes — that half IS atomic. |
| `components/invoice-preview-dialog.tsx` | Preview-then-confirm modal | ✓ VERIFIED | Client-side non-authoritative preview via the same `render.ts` functions; navigates to `/history/{invoiceId}` on real success. |
| `components/invoice-view.tsx` | Shared frozen-snapshot view + Copy/Email/Delete | ✓ VERIFIED | Renders `renderedBody` as a plain text node (`whitespace-pre-wrap`), no `dangerouslySetInnerHTML`; Copy + Gmail anchor + `InvoiceDeleteConfirmDialog` all present. |
| `app/(app)/history/[id]/page.tsx` | Invoice detail route | ✓ VERIFIED | Selects only from `invoices` (leftJoin `students`), `notFound()` on invalid/missing id, never queries `sessions`. |
| `lib/invoice/mailto.ts` | `buildGmailComposeUrl`, `isGmailUrlTooLong`, `GMAIL_URL_MAX_LEN` | ✓ VERIFIED | All exported; `URLSearchParams`-based; `GMAIL_URL_MAX_LEN = 1800`. |
| `components/invoice-delete-confirm-dialog.tsx` | Delete-invoice confirm dialog | ✓ VERIFIED | Bound Server Action (`deleteInvoiceAction.bind(null, invoiceId)`), neutral/red trigger convention. |
| `components/invoice-history-table.tsx` | Responsive invoice list + empty state | ✓ VERIFIED | table(md+)/cards(mobile) split, "No invoices yet" empty state with "Go to Dashboard" link. |
| `app/(app)/history/page.tsx` | `/history` list route | ✓ VERIFIED | `orderBy(desc(invoices.generatedAt))`, leftJoin students. |
| `components/session-form-dialog.tsx` | Notes-are-parent-facing hint (modified) | ✓ VERIFIED | Exact string "Notes appear on invoices sent to parents." present (grep confirmed at line 220). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `components/settings-form.tsx` | `saveSettingsAction` | `useActionState` | ✓ WIRED | Confirmed. |
| `app/(app)/settings/page.tsx` | `settings` table | `db.select().from(settings)` | ✓ WIRED | Confirmed. |
| `components/top-nav.tsx` | `/settings`, `/history` | `NAV_ITEMS` entries | ✓ WIRED | Both present, correct order (Students · Dashboard · Sessions · History · Settings). |
| `components/dashboard-table.tsx` | `InvoicePreviewDialog` | per-row "Generate Invoice" trigger | ✓ WIRED | Rendered only when `unbilledAmountCents !== 0` (D-08). |
| `generateInvoiceAction` | atomic freeze + bill | `db.batch` | ⚠️ PARTIAL | `db.batch` is used but wraps only the UPDATE — the INSERT is a separate prior statement, so the link is present but does not deliver the atomicity the plan's own must-have claims. See Truth 3 gap. |
| `components/invoice-preview-dialog.tsx` | `/history/` | `router.push` on success | ✓ WIRED | Confirmed. |
| `app/(app)/history/[id]/page.tsx` | `invoices` table | `db.select` frozen row | ✓ WIRED | Confirmed, `notFound()` guard present. |
| `components/invoice-view.tsx` | `buildGmailComposeUrl` | Email Invoice anchor href | ✓ WIRED | Confirmed. |
| `deleteInvoiceAction` | `db.batch` | un-bill + delete atomically | ✓ WIRED | This one IS a single `db.batch([update, delete])` covering both writes — genuinely atomic. |
| `components/invoice-delete-confirm-dialog.tsx` | `deleteInvoiceAction` | bound Server Action on submit | ✓ WIRED | Confirmed (`deleteInvoiceAction.bind(null, invoiceId)`). |
| `app/(app)/history/page.tsx` | `invoices` table | `db.select orderBy desc(generatedAt)` | ✓ WIRED | Confirmed. |
| `components/invoice-history-table.tsx` | `/history/[id]` | View link per row | ✓ WIRED | Confirmed. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `components/dashboard-table.tsx` (Generate Invoice trigger + preview) | `sessionsByStudentId[row.id]`, `settings` | Passed from `app/(app)/dashboard/page.tsx` server read | Yes — real `db.select` results, not static/empty | ✓ FLOWING |
| `components/invoice-view.tsx` | `renderedBody`/`renderedSubject`/`totalCents`/etc. | `app/(app)/history/[id]/page.tsx` `db.select().from(invoices)` | Yes — frozen columns from a real row, `notFound()` if absent | ✓ FLOWING |
| `components/invoice-history-table.tsx` | `rows` | `app/(app)/history/page.tsx` `db.select().from(invoices).leftJoin(students)` | Yes — real query, empty array only when genuinely zero invoices exist | ✓ FLOWING |
| `components/settings-form.tsx` | `zelleHandle`/`subjectTemplate`/`bodyTemplate` | `app/(app)/settings/page.tsx` `db.select().from(settings)` with default fallback | Yes — real row or documented first-visit defaults | ✓ FLOWING |

### Behavioral Spot-Checks

`npx tsc --noEmit` run clean (no output/errors) across the whole project, confirming all Phase 3 files compile against the rest of the codebase. No local dev server was started (per spot-check constraints — do not start servers); Gmail draft opening and clipboard behavior require a real browser and are correctly routed to Human Verification below.

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Whole-project type check (includes all Phase 3 files) | `npx tsc --noEmit` | Exit 0, no diagnostics | ✓ PASS |
| No `db.transaction` reference anywhere in `lib/` (Pitfall 2 constraint) | `grep -rn "db.transaction" lib/` | No matches | ✓ PASS |
| `deleteInvoiceAction` uses one `db.batch` covering both writes | `grep -A5 "await db.batch" lib/actions/invoices.ts` (2nd occurrence) | update + delete inside the same array | ✓ PASS |
| `generateInvoiceAction`'s INSERT and UPDATE are NOT in the same `db.batch` | Source read of `lib/actions/invoices.ts:122-145` | INSERT at line 122 executes standalone; `db.batch` at line 135 contains only the UPDATE | ✗ FAIL (confirms Truth 3 gap) |

### Probe Execution

No probes found under `scripts/*/tests/probe-*.sh`, and no probe paths are referenced in any Phase 3 PLAN/SUMMARY file. Step 7c: SKIPPED (no probes declared or discovered for this phase).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| SET-01 | 03-01 | Set/edit Zelle handle | ✓ SATISFIED | `settingsFormSchema` + `saveSettingsAction` + `settings-form.tsx` |
| SET-02 | 03-01 | Set/edit email subject + body templates | ✓ SATISFIED | Same as above, 3-field form + defaults |
| INV-01 | 03-02 | Invoice totals ALL unbilled sessions | ✓ SATISFIED | `generateInvoiceAction` re-SELECTs all `billed=false` rows for the student |
| INV-02 | 03-02 | Copyable text summary | ✓ SATISFIED | `renderInvoiceText` + Copy Invoice Text button |
| INV-03 | 03-02 | Atomically bills sessions + immutable snapshot | ✗ BLOCKED | See Truth 3 gap — bill+freeze is not atomic (WR-01) |
| INV-04 | 03-02 | Later edits/deletes never alter a generated invoice | ✓ SATISFIED | Invoice view/route reads only frozen `invoices` columns, confirmed no `from(sessions)` |
| MAIL-01 | 03-03 | Pre-filled Gmail draft opens addressed to parent | ✓ SATISFIED (pending human visual confirm) | `buildGmailComposeUrl` + accent anchor, `target="_blank"` |
| MAIL-02 | 03-03 | Draft body = frozen invoice + Zelle instructions from template | ✓ SATISFIED | `renderedBody`/`renderedSubject` frozen at generation, passed into `buildGmailComposeUrl` |
| MAIL-03 | 03-02 | Copy fallback when email client unavailable/body too long | ✓ SATISFIED | Copy button + textarea fallback on clipboard failure; over-length guard hides Email, keeps Copy |
| MAIL-04 | 03-03 | Guard when student has no parent email | ✓ SATISFIED (by invariant) | `students.parentEmail` is `notNull` + required+validated at creation — documented as a satisfied invariant, no dead guard UI built |
| HIST-01 | 03-04 | Log of all previously generated invoices | ✓ SATISFIED | `/history` newest-first list |
| HIST-02 | 03-04 | Open a past invoice to see frozen snapshot | ✓ SATISFIED | View link → `/history/[id]` (same shared `InvoiceView`) |

No orphaned requirements: all 12 IDs declared across the 4 plans' frontmatter (`SET-01,02` / `INV-01..04,MAIL-03` / `MAIL-01,02,04` / `HIST-01,02`) exactly match REQUIREMENTS.md's Phase 3 mapping — 12 declared, 12 mapped, 0 orphaned.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `lib/actions/invoices.ts` | 122-145 | Non-atomic INSERT + separate db.batch UPDATE | 🛑 Blocker (for Truth 3 / INV-03) | Double-billing / re-invoicing window on crash or concurrent double-submit — carried over from 03-REVIEW.md WR-01, unresolved |
| `lib/validation/settings.ts` | 8-12 | No `.max()` on `zelleHandle`/`subjectTemplate`/`bodyTemplate` overrides despite fixed-width `varchar` columns | ⚠️ Warning | Oversized input throws an unhandled Postgres error instead of a field error — carried over from 03-REVIEW.md WR-02 |
| `lib/actions/invoices.ts` | 115, schema.ts:26 | `renderedSubject` can exceed `varchar(500)` after template merge | ⚠️ Warning | Generate flow can crash with an opaque DB error for long templates/names — carried over from 03-REVIEW.md WR-03 |
| `lib/actions/invoices.ts`, `lib/actions/settings.ts` | multiple | No `try/catch` around DB writes in `generateInvoiceAction`/`deleteInvoiceAction`/`saveSettingsAction` | ⚠️ Warning | Any DB error surfaces as an uncaught server error with no user feedback — carried over from 03-REVIEW.md WR-04 |
| `components/invoice-view.tsx`, `components/invoice-history-table.tsx` | 80, 80/125 | `generatedAt` formatted with no timezone anchor | ℹ️ Info | Carried over from 03-REVIEW.md IN-01 |
| `lib/invoice/mailto.ts` | 36-38 | `isGmailUrlTooLong` measures UTF-16 code units, not encoded byte length | ℹ️ Info | Multi-byte notes/names could under-count length and slip past the guard — carried over from 03-REVIEW.md IN-02 |
| `app/(app)/history/[id]/page.tsx` | 31, 45-46 | `?? ""` null-fallbacks for a join that can never be null given the `restrict` FK | ℹ️ Info | Harmless but masks intent — carried over from 03-REVIEW.md IN-03 |

No `TBD`/`FIXME`/`XXX`/`HACK`/`PLACEHOLDER` debt markers found in any Phase 3 file (checked all created/modified files listed across the 4 SUMMARYs).

### Human Verification Required

The following were explicitly deferred by the executor to end-of-phase human verification per `human_verify_mode: "end-of-phase"` in `.planning/config.json`. These require a live browser and cannot be verified by static analysis.

### 1. Settings round-trip

**Test:** Log in, visit `/settings` via the nav item. Confirm the three fields show sensible defaults on first load. Edit each field, click Save Settings, see the "Saved." flash. Reload the page and confirm the edited values persisted.
**Expected:** Defaults on first visit; edits persist across reload; nav shows History + Settings in the correct order (Students · Dashboard · Sessions · History · Settings).
**Why human:** Requires visual confirmation of the flash message and a real page reload.

### 2. Generate → freeze → land → copy, and INV-04 immutability

**Test:** Generate an invoice for a student with several unbilled sessions (one with a note, one without). Confirm you land on `/history/[id]` with the correct header, period, itemized lines (noted session shows its indented note; un-noted omits it), and Total. Click Copy Invoice Text and confirm "Copied!" appears and the clipboard contains the body. Then edit that billed session's hours on the Sessions page and reload the invoice — confirm the frozen total/lines are UNCHANGED.
**Expected:** Frozen text renders correctly; Copy works; a post-generation edit to the billed session does not alter the already-generated invoice.
**Why human:** Visual confirmation of rendered text formatting and real clipboard read-back.

### 3. Gmail compose handoff + delete/un-bill recovery

**Test:** Open a generated invoice. Click Email Invoice and confirm a Gmail compose tab opens in a new tab, pre-filled with the parent's email as To, the frozen subject, and the frozen body (line breaks intact). Then delete that invoice from the view, confirm, and verify you land on `/history` with the student's sessions restored to unbilled on the Dashboard. If a very long invoice is available, confirm the Email button is replaced by the over-length guard message while Copy still works.
**Expected:** Gmail opens correctly addressed and pre-filled; delete un-bills sessions and lands on `/history`; over-length guard behaves as designed.
**Why human:** Depends on Google's unofficial, undocumented Gmail compose URL behavior in a real browser session — cannot be verified by static analysis.

### 4. Invoice History list + notes hint

**Test:** Generate two invoices for different students. Visit History from the nav — confirm both appear newest-first with Student/Period/Total/Generated columns. Click View on one and confirm it opens the frozen snapshot with Email/Copy/Delete affordances intact. Delete all invoices and confirm the empty state ("No invoices yet" + "Go to Dashboard") renders. Confirm the "Notes appear on invoices sent to parents." hint is visible in both the Log Session and Edit Session dialogs.
**Expected:** All of the above render and behave as described.
**Why human:** Visual/layout confirmation across multiple pages and dialog states.

### Gaps Summary

Of the phase's 5 Success Criteria, 4 are fully and directly backed by code: the tutor can maintain Settings (Zelle handle + templates), generate a copyable invoice from unbilled sessions, send it via a pre-filled Gmail draft with copy/over-length/no-email fallbacks, and browse History to reopen any past frozen invoice.

The one real gap is in Success Criterion 3's atomicity clause. `generateInvoiceAction` (`lib/actions/invoices.ts:122-145`) inserts the frozen invoice row first, then performs the sessions-billing UPDATE as a *separate* DB round-trip (wrapped alone in `db.batch`, which does not connect it to the preceding INSERT). This was already caught and documented by the phase's own code review as **WR-01**, rated the highest-impact defect in the phase for a financial app: a crash/network failure between the two writes, or two near-simultaneous Generate submissions from two tabs, can leave an invoice on record whose sessions still show as unbilled — meaning they can be invoiced again, producing a duplicate charge for money already billed. The immutability half of the same criterion (a billed session's later edit/delete never altering a *previously completed* invoice) is solidly verified — that part of the design is correct and unaffected by this gap.

This is not a hidden regression; it is the exact, already-known WR-01 finding from `03-REVIEW.md`, still present unresolved in the code as reviewed. Two paths forward: (1) apply the fix already sketched in `03-REVIEW.md` (a single `db.batch` wrapping one atomic INSERT...WITH...UPDATE CTE, or an equivalent single-statement approach), or (2) if the single-user/low-concurrency risk is judged acceptable for v1 (the plan's own RESEARCH.md Pitfall 1 discussion suggests this tradeoff was made deliberately), add an explicit override to this VERIFICATION.md's frontmatter with a sign-off, since the current code is a deliberate design choice rather than an oversight.

**This looks intentional but is not a safe default for a financial app's core invariant.** If the two-round-trip design is accepted as-is, add to VERIFICATION.md frontmatter:

```yaml
overrides:
  - must_have: "Generating an invoice atomically marks its sessions as billed"
    reason: "Single-user, low-concurrency app; INSERT-then-batch-UPDATE window is only exploitable via a mid-request crash or a deliberate double-tab race, judged acceptable for v1 (see 03-RESEARCH.md Pitfall 1)"
    accepted_by: "{your name}"
    accepted_at: "{current ISO timestamp}"
```

Otherwise, apply the WR-01 fix and re-run verification.

---

_Verified: 2026-07-05T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
