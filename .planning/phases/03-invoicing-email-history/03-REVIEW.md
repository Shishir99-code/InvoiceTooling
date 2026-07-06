---
phase: 03-invoicing-email-history
reviewed: 2026-07-05T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - app/(app)/dashboard/page.tsx
  - app/(app)/history/[id]/page.tsx
  - app/(app)/history/page.tsx
  - app/(app)/settings/page.tsx
  - components/dashboard-table.tsx
  - components/invoice-delete-confirm-dialog.tsx
  - components/invoice-history-table.tsx
  - components/invoice-preview-dialog.tsx
  - components/invoice-view.tsx
  - components/session-form-dialog.tsx
  - components/settings-form.tsx
  - components/top-nav.tsx
  - lib/actions/invoices.ts
  - lib/actions/settings.ts
  - lib/db/schema.ts
  - lib/invoice/defaults.ts
  - lib/invoice/mailto.ts
  - lib/invoice/render.ts
  - lib/validation/invoice.ts
  - lib/validation/settings.ts
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-07-05T00:00:00Z
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

Reviewed the invoicing / email / history surface: two server actions
(`generateInvoiceAction`, `deleteInvoiceAction`, `saveSettingsAction`), the
invoice render/mailto/defaults utilities, validation schemas, the DB schema,
and the client components (dashboard, preview dialog, invoice view, history,
settings, delete confirm).

Overall the code is disciplined about the things the CONTEXT/pitfall notes
flagged: invoice content is re-fetched and frozen server-side, merge fields
go through `URLSearchParams` (no injection into the Gmail URL), body text is
rendered as an auto-escaped text node (no XSS), and the un-bill-on-delete
ordering is correct. No hardcoded secrets, no `eval`/`innerHTML`, no SQL
string interpolation.

The defects that remain are data-integrity and input-boundary gaps rather
than injection bugs: invoice generation is not atomic across its two DB
round-trips, and several user-controlled string fields have no upper length
bound despite landing in fixed-width `varchar` columns, which turns oversized
input into an unhandled Postgres error instead of a validation message.

## Warnings

### WR-01: Invoice generation is non-atomic — a failure between INSERT and UPDATE leaves sessions un-billed under a real invoice (double-billing risk)

**File:** `lib/actions/invoices.ts:122-145`
**Issue:** The invoice row is inserted first (`INSERT ... RETURNING id`), and
only in a *separate* subsequent round-trip are the covered sessions marked
`billed: true` / `invoiceId`. These two writes are not in one transaction (the
code comment explains the neon-http driver constraint). If the process, DB, or
network fails after the invoice INSERT commits but before the `db.batch`
UPDATE commits, the result is: an invoice exists with `totalCents`, but its
sessions still read `billed = false`. Those same sessions then re-appear on the
Dashboard as owed and can be invoiced a *second* time, producing a duplicate
invoice for money that was already billed. The same window also allows two
concurrent generations (two tabs) to each select the same unbilled set and
create two invoices — the empty-set guard at line 58 does not protect against
this. For a financial app this is the highest-impact defect here.
**Fix:** Make the two writes atomic. `db.batch([...])` on neon-http runs its
statements in a single transaction, so restructure so both the insert and the
session update are in one batch. Because the UPDATE needs the new invoice id,
either (a) allocate the id up front (e.g. select `nextval` / use a CTE
`WITH ins AS (INSERT ... RETURNING id) UPDATE sessions ... FROM ins`), or (b)
mark the sessions by the already-known session-id list in the same batch and
reconcile. At minimum, add a guard that refuses to generate if the target
sessions are already billed, and reverse the order isn't sufficient — the
atomicity is the fix:
```ts
// single atomic statement — no partial-commit window
await db.batch([
  db.execute(sql`
    WITH ins AS (
      INSERT INTO invoices (student_id, period_start, period_end, total_cents,
                            line_items, rendered_body, rendered_subject)
      VALUES (${studentId}, ${periodStart}, ${periodEnd}, ${totalCents},
              ${lineItems}, ${renderedBody}, ${renderedSubject})
      RETURNING id
    )
    UPDATE sessions SET billed = true, invoice_id = (SELECT id FROM ins)
    WHERE id = ANY(${unbilledSessions.map((s) => s.id)})
  `),
]);
```

### WR-02: Settings templates have no max-length validation — oversized input throws an unhandled Postgres error instead of a field error

**File:** `lib/validation/settings.ts:8-12` (and `lib/actions/settings.ts:35-50`)
**Issue:** `createInsertSchema(settings, { zelleHandle, subjectTemplate,
bodyTemplate })` overrides each field with a custom Zod schema. Passing a field
override to `drizzle-zod` *replaces* the inferred schema for that field,
including the `varchar` length constraint drizzle-zod would otherwise add. The
overrides here only set `.trim().min(1, ...)` — no `.max()`. But the DB columns
are fixed width: `zelle_handle varchar(255)` and `subject_template
varchar(500)`. A user pasting a Zelle handle > 255 chars or a subject template
> 500 chars passes validation, then `saveSettingsAction` hits
`value too long for type character varying(N)` from Postgres. There is no
`try/catch` in the action, so this surfaces as an uncaught error / error
boundary rather than the intended inline field message.
**Fix:** Add explicit `.max()` matching the column widths so the error is a
clean field-level validation message:
```ts
zelleHandle: z.string().trim().min(1, "Enter your Zelle handle.").max(255),
subjectTemplate: z.string().trim().min(1, "Enter an email subject line.").max(500),
// bodyTemplate maps to `text` — no DB bound, but a sane cap (e.g. .max(5000))
// avoids pathological input.
```

### WR-03: Rendered invoice subject can overflow `rendered_subject varchar(500)` at generation time and crash the action

**File:** `lib/actions/invoices.ts:115,122-133` and `lib/db/schema.ts:26`
**Issue:** `renderedSubject = renderTemplate(subjectTemplate, mergeValues)` is
stored into `rendered_subject varchar(500)`. Even with WR-02 capping the raw
*template* at 500, template expansion can exceed 500: `{student}` expands to a
name up to 255 chars, and `{total}`/`{period}`/`{zelle}` add more. A subject
template near 500 chars containing `{student}` renders to > 500 chars, and the
INSERT throws `value too long for type character varying(500)`. Because the
INSERT is the first write, no sessions are corrupted, but the generate flow
dies with an unhandled error and the tutor cannot invoice that student until
she shortens the template — with no message telling her why.
**Fix:** Either widen the column (`text` for `rendered_subject`, matching
`rendered_body`), or clamp/validate the rendered subject length before insert
and return a `fieldErrors` message. Widening to `text` is the lower-friction
fix given the subject is machine-rendered, not indexed:
```ts
renderedSubject: text("rendered_subject").notNull(),
```

### WR-04: `deleteInvoiceAction` / `generateInvoiceAction` have no error handling around DB writes

**File:** `lib/actions/invoices.ts:135-145,165-171` and `lib/actions/settings.ts:35-50`
**Issue:** All three server actions call `db` writes with no `try/catch`. Any
DB error (connection drop, constraint violation such as WR-02/WR-03, neon cold
-start timeout) propagates as an uncaught server error. For the delete flow the
user has already confirmed a destructive action and the dialog was optimistically
closed (`invoice-delete-confirm-dialog.tsx:63` `onSubmit={() => setOpen(false)}`),
so a failed delete leaves the user on a broken error page with no feedback that
the invoice still exists. This is a robustness gap consistent across the phase,
not a one-off.
**Fix:** Wrap the DB writes and return a structured error state (add a
top-level `formError` to `InvoiceActionState` / `SettingsActionState`) so the
UI can show "Couldn't generate/delete — try again." The delete dialog should
also not close optimistically before the action resolves, or should re-open on
error.

## Info

### IN-01: `generatedAt` timestamp is formatted with no timezone anchor — server/client can disagree by a day

**File:** `components/invoice-view.tsx:80`, `components/invoice-history-table.tsx:80,125`
**Issue:** `generated_at` is `timestamp` (no timezone). `format(generatedAt,
"PPP")` formats it in the runtime's local timezone. Rendered in a client
component, a session logged near midnight UTC can display a different calendar
date than the server would show, and differently across the tutor's devices.
The stored `date` columns deliberately use `mode: "string"` to avoid exactly
this; the `generatedAt` display does not get the same protection.
**Fix:** Store/read as `timestamp` with an explicit UTC or fixed display zone,
or format via a helper that pins the zone, consistent with the date-string
convention used elsewhere.

### IN-02: `isGmailUrlTooLong` measures UTF-16 code units, not the byte length that actually governs the URL limit

**File:** `lib/invoice/mailto.ts:36-38`
**Issue:** The ~1800/2000 practical ceiling is about the encoded URL length in
bytes. `url.length` counts JS string code units; a body with multi-byte
characters (emoji, accented names, non-Latin notes) percent-encodes to far more
bytes than `.length` reports, so the guard can under-count and still let a
too-long URL through, silently truncating the Gmail draft (the exact Pitfall 5
this guard exists to prevent).
**Fix:** Measure the encoded length, e.g. compare against
`new TextEncoder().encode(url).length` or the length after the `URLSearchParams`
serialization is already percent-encoded (it is) — but still account for
multi-byte via a byte count.

### IN-03: `parentEmail` / `sessionCount` null-fallbacks are effectively dead given the `restrict` FK

**File:** `app/(app)/history/[id]/page.tsx:31,45-46`
**Issue:** The `leftJoin` to `students` plus `row.studentName ?? ""` /
`row.parentEmail ?? ""` implies a student may be missing, but both
`invoices.studentId` and `sessions.studentId` use `onDelete: "restrict"`, so an
invoice can never reference a deleted student — the join always matches. The
defensive fallbacks are harmless but mask intent (they read as "student can be
gone" when it cannot). An `innerJoin` would document the invariant and let the
types drop the `| null`.
**Fix:** Use `innerJoin` (or keep the fallbacks but add a comment that they are
belt-and-suspenders for the `restrict` FK, not a reachable state).

---

_Reviewed: 2026-07-05T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
