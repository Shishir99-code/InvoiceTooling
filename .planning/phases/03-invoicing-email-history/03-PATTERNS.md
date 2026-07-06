# Phase 3: Invoicing, Email & History - Pattern Map

**Mapped:** 2026-07-05
**Files analyzed:** 20
**Analogs found:** 20 / 20

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `lib/db/schema.ts` (add `invoices`, `settings`, `sessions.invoiceId`) | model | CRUD | `lib/db/schema.ts` (existing) | exact (same file, additive) |
| `lib/validation/invoice.ts` | utility (zod schema) | request-response | `lib/validation/session.ts` | role-match |
| `lib/validation/settings.ts` | utility (zod schema) | request-response | `lib/validation/student.ts` | exact |
| `lib/invoice/render.ts` (buildLineItems, renderTemplate, formatPeriod) | utility (pure fn) | transform | `lib/format.ts` | role-match |
| `lib/invoice/mailto.ts` (buildGmailComposeUrl) | utility (pure fn) | transform | `lib/format.ts` | role-match |
| `lib/actions/invoices.ts` (generateInvoiceAction, deleteInvoiceAction) | service/controller (Server Action) | CRUD + event-driven (atomic batch) | `lib/actions/sessions.ts` (add/delete) | exact |
| `lib/actions/settings.ts` (saveSettingsAction) | service/controller (Server Action) | CRUD | `lib/actions/students.ts` (edit) | exact |
| `components/settings-form.tsx` | component (page form, not modal) | request-response | `components/session-form-dialog.tsx` (form/useActionState internals) + `app/(app)/settings` layout is new | role-match |
| `components/invoice-preview-dialog.tsx` | component (modal) | request-response | `components/session-form-dialog.tsx` | exact |
| `components/invoice-delete-confirm-dialog.tsx` | component (confirm modal) | event-driven | `components/session-delete-confirm-dialog.tsx` | exact |
| `components/invoice-view.tsx` | component (shared detail view) | request-response | `components/dashboard-table.tsx` (row detail rendering) + no direct analog for the frozen text block | role-match |
| `components/invoice-history-table.tsx` | component (list table) | CRUD (read) | `components/student-table.tsx` | exact |
| `components/dashboard-table.tsx` (MODIFY: add Generate Invoice trigger, DOM restructure) | component | CRUD (read) + event-driven (trigger) | itself (existing) | exact (same file) |
| `components/session-form-dialog.tsx` (MODIFY: add notes-are-parent-facing hint) | component | request-response | itself (existing) | exact (same file) |
| `components/top-nav.tsx` (MODIFY: add History + Settings nav items) | component | request-response | itself (existing) | exact (same file) |
| `app/(app)/settings/page.tsx` | route (Server Component page) | CRUD (read) | `app/(app)/sessions/page.tsx` (single-entity read + form) | role-match |
| `app/(app)/history/page.tsx` | route (Server Component page) | CRUD (read) | `app/(app)/dashboard/page.tsx` (list query + table) | role-match |
| `app/(app)/history/[id]/page.tsx` (invoice view route) | route (Server Component page) | CRUD (read) | `app/(app)/sessions/page.tsx` | partial-match (no existing detail/[id] route) |

## Pattern Assignments

### `lib/db/schema.ts` (model, CRUD)

**Analog:** itself (existing file, additive change)

**Existing style** (lines 1-29, full file):
```typescript
import { pgTable, serial, varchar, integer, boolean, timestamp, date, text } from "drizzle-orm/pg-core";

export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "restrict" }), // never cascade — archived students keep history
  date: date("date", { mode: "string" }).notNull(), // mode "string": avoids TZ-shift
  durationMinutes: integer("duration_minutes").notNull(),
  amountCents: integer("amount_cents").notNull(), // D-14: frozen snapshot, computed server-side once at write time
  notes: text("notes"),
  billed: boolean("billed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

**Pattern to copy:** integer-cents columns, `date` with `mode: "string"`, inline comment citing the decision ID that justifies each column, explicit `onDelete` on every FK (never rely on default). Add `invoices` table + `settings` table + `sessions.invoiceId` nullable FK exactly per 03-RESEARCH.md's schema sketch (jsonb `lineItems`, frozen `renderedBody`/`renderedSubject`, `onDelete: "restrict"` on `invoices.studentId`, `onDelete: "set null"` on `sessions.invoiceId`). Need to add `jsonb` to the pg-core import list.

---

### `lib/validation/invoice.ts` and `lib/validation/settings.ts` (utility, request-response)

**Analog:** `lib/validation/session.ts` (full file, lines 1-32) and `lib/validation/student.ts`

**Core pattern** (session.ts lines 12-30):
```typescript
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

const baseSessionSchema = createInsertSchema(sessions, {
  studentId: z.coerce.number("Select a student.").int().positive("Select a student."),
  date: z.iso.date("Enter a valid date."),
  durationMinutes: z.coerce.number().int().positive("Session length must be more than 0 minutes."),
  notes: z.string().trim().max(1000).optional(),
});

export const sessionFormSchema = baseSessionSchema.pick({
  studentId: true,
  date: true,
  durationMinutes: true,
  notes: true,
});

export type SessionFormValues = z.infer<typeof sessionFormSchema>;
```

**Apply to `lib/validation/settings.ts`:** derive via `createInsertSchema(settings, {...})`, override `zelleHandle`/`subjectTemplate`/`bodyTemplate` with `z.string().trim().min(1, "Enter your Zelle handle.")` etc. (loose validation per D-01 Claude's Discretion — non-empty only, no format enforcement).

**Apply to `lib/validation/invoice.ts`:** mostly an id-only schema (`z.coerce.number().int().positive()`), mirroring the `editSessionSchema` id-extension idiom (session.ts is `createInsertSchema` + `.extend`), since invoice content is never user-typed — only `studentId` (generate) and `id` (delete) cross the Server Action boundary.

---

### `lib/invoice/render.ts` (utility, transform)

**Analog:** `lib/format.ts` (full file, lines 1-22) for the "single source of truth, pure function, doc-comment explaining reuse" convention.

```typescript
export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const hourPart = hours > 0 ? `${hours} ${hours === 1 ? "hr" : "hrs"}` : "";
  const minPart = mins > 0 ? `${mins} min` : "";
  return [hourPart, minPart].filter(Boolean).join(" ");
}
```

**Pattern to copy:** no React/DB import, pure functions, MUST call `formatCents`/`formatDuration` from `lib/format.ts` rather than reimplementing (per RESEARCH.md "Don't Hand-Roll"). `renderTemplate()` follows 03-RESEARCH.md Pattern 3 exactly (sequential `replaceAll` over the 5 fixed merge fields, unknown tokens left verbatim). `buildLineItems()`/`formatPeriod()` should use `date-fns format(date, "PPP")` exactly as `dashboard-table.tsx`'s local `formatSessionDate` helper does (see below).

**Date formatting precedent** (`dashboard-table.tsx` lines 39-43):
```typescript
function formatSessionDate(date: string) {
  // Pitfall 2: never round-trip the *stored* date through a JS Date for
  // storage — this transient conversion is display-only.
  return format(new Date(`${date}T00:00:00`), "PPP");
}
```

---

### `lib/invoice/mailto.ts` (utility, transform)

**Analog:** none in-repo (net-new capability) — use 03-RESEARCH.md's Code Examples verbatim (`URLSearchParams` + `encodeURIComponent`, never manual string concatenation per Pitfall 6). Follows the same "pure function, no side effects" shape as `lib/format.ts`.

---

### `lib/actions/invoices.ts` (service/controller, CRUD + event-driven)

**Analog:** `lib/actions/sessions.ts` (full file, lines 1-136)

**Imports pattern** (lines 1-9):
```typescript
"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { sessions, students } from "@/lib/db/schema";
import { sessionFormSchema } from "@/lib/validation/session";
```

**State shape convention** (lines 11-13):
```typescript
export interface SessionActionState {
  fieldErrors: Record<string, string[]> | null;
}
```

**Core re-fetch-server-side pattern** (lines 41-56, `addSessionAction`):
```typescript
export async function addSessionAction(
  _prevState: SessionActionState,
  formData: FormData,
): Promise<SessionActionState> {
  const parsed = parseAddSessionForm(formData);
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  // Never trust a client-submitted rate/amount — re-fetch the authoritative
  // rateCents from the DB at write time.
  const [student] = await db.select().from(students).where(eq(students.id, parsed.data.studentId));
  if (!student) {
    return { fieldErrors: { studentId: ["Select a student."] } };
  }
  ...
  revalidatePath("/sessions");
  revalidatePath("/dashboard");
  return { fieldErrors: null };
}
```
Apply directly to `generateInvoiceAction`: never trust client-submitted session IDs/total — re-`SELECT` unbilled sessions server-side (03-RESEARCH.md Anti-Patterns). `revalidatePath("/dashboard")` and `revalidatePath("/history")` after generate; same pair after delete.

**Bound-arg delete pattern** (lines 125-135, `deleteSessionAction`):
```typescript
export async function deleteSessionAction(id: number): Promise<void> {
  const sessionId = Number(id);
  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    throw new Error("Invalid session id.");
  }
  await db.delete(sessions).where(eq(sessions.id, sessionId));
  revalidatePath("/sessions");
  revalidatePath("/dashboard");
}
```
Apply to `deleteInvoiceAction(id: number)` — same id-guard idiom, but body must use `db.batch([...])` (NOT `db.transaction()`, per 03-RESEARCH.md Pitfall 2) to atomically un-bill sessions + delete the invoice row, per the Architecture Diagram:
```typescript
await db.batch([
  db.update(sessions).set({ billed: false, invoiceId: null }).where(eq(sessions.invoiceId, invoiceId)),
  db.delete(invoices).where(eq(invoices.id, invoiceId)),
]);
```
`generateInvoiceAction` resolves Pitfall 1 via the two-step approach: single `INSERT ... RETURNING id`, then a `db.batch([ update sessions billed=true/invoiceId=newId ])` immediately after (see 03-RESEARCH.md Pitfall 1, resolution 1).

---

### `lib/actions/settings.ts` (service/controller, CRUD)

**Analog:** `lib/actions/students.ts` `editStudentAction` (lines 62-83):
```typescript
export async function editStudentAction(
  _prevState: StudentActionState,
  formData: FormData,
): Promise<StudentActionState> {
  const parsed = parseEditForm(formData);
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  await db.update(students).set({...}).where(eq(students.id, parsed.data.id));
  revalidatePath("/");
  return { fieldErrors: null };
}
```
**Pattern to copy:** `saveSettingsAction` is a single-row upsert (`id = 1` always) — use `db.insert(settings).values({id:1,...}).onConflictDoUpdate({target: settings.id, set: {...}})` or a plain update-if-exists/insert-if-not idiom; same `"use server"` + zod `safeParse` + `fieldErrors` state shape; `revalidatePath("/settings")` (and note the template is only consumed at generate-time, no other page needs revalidation).

---

### `components/settings-form.tsx` (component, request-response)

**Analog:** `components/session-form-dialog.tsx`'s internal `useActionState` + field-error rendering (lines 62-67, 131-232) — but NOT the Dialog shell, since Settings is a standalone page form (UI-SPEC Surface 6), not a modal.

**Core field-block pattern to copy** (lines 217-231):
```typescript
<div className="flex flex-col gap-2">
  <Label htmlFor={`notes-${fieldSuffix}`}>Notes (optional)</Label>
  <Textarea
    id={`notes-${fieldSuffix}`}
    name="notes"
    rows={3}
    defaultValue={isEdit ? (props.session.notes ?? "") : ""}
  />
  {state.fieldErrors?.notes && (
    <p className="text-sm text-red-600">{state.fieldErrors.notes[0]}</p>
  )}
</div>
```
**Pattern to copy:** `useActionState(saveSettingsAction, initialState)`, `noValidate` on `<form>`, per-field `state.fieldErrors?.X` rendering exactly as above, but rendered inline on a page (`<h1>` + form + single "Save Settings" button footer) rather than inside `Dialog`/`DialogFooter`. "Saved." transient success message (UI-SPEC) needs local `useState` + `useEffect`/timeout — no existing analog for a transient success flash in this codebase; implement as a simple local timer following the same "adjust during render" `useState` idiom seen in `session-form-dialog.tsx` lines 93-99.

---

### `components/invoice-preview-dialog.tsx` (component, request-response)

**Analog:** `components/session-form-dialog.tsx` (full file) — Dialog shell + `useActionState` + close-only-on-success pattern.

**Dialog shell + trigger pattern** (lines 114-130):
```typescript
<Dialog open={open} onOpenChange={setOpen}>
  <DialogTrigger render={<Button variant={props.triggerVariant} size={props.triggerSize} className={props.triggerClassName} />}>
    {props.triggerLabel}
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>{title}</DialogTitle>
    </DialogHeader>
    <form action={formAction} noValidate className="flex flex-col gap-4">
      ...
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>Discard</DialogClose>
        <Button type="submit" disabled={isPending} className="bg-blue-600 text-white hover:bg-blue-700">
          {isPending ? pendingLabel : primaryLabel}
        </Button>
      </DialogFooter>
    </form>
  </DialogContent>
</Dialog>
```

**Close-only-on-real-success pattern** (lines 92-99):
```typescript
const [prevState, setPrevState] = useState(state);
if (state !== prevState) {
  setPrevState(state);
  if (state.fieldErrors === null) {
    setOpen(false);
  }
}
```
For the preview dialog, on success the app must *navigate* to the finished invoice (D-09) rather than merely closing — so this pattern needs an added `router.push(`/history/${newInvoiceId}`)` inside the success branch; `generateInvoiceAction` must return the new invoice id in its state (extend `SessionActionState`-style interface to include `invoiceId: number | null`).

**Client-side non-authoritative preview precedent** (lines 106-112):
```typescript
const totalMinutes = hours * 60 + minutes;
// Non-authoritative client-side estimate only — never submitted as form data.
const previewAmountCents = selectedStudent
  ? Math.round((totalMinutes * selectedStudent.rateCents) / 60)
  : null;
```
Mirrors UI-SPEC Surface 3's requirement that the modal's rendered text is a client-computed preview from already-passed-down props, while the Server Action independently re-fetches and is the source of truth.

---

### `components/invoice-delete-confirm-dialog.tsx` (component, event-driven)

**Analog:** `components/session-delete-confirm-dialog.tsx` (full file, lines 1-72) — copy near-verbatim.

```typescript
"use client";
import { useState, type ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { deleteSessionAction } from "@/lib/actions/sessions";

export function SessionDeleteConfirmDialog({ sessionId, sessionLabel, triggerVariant = "outline", triggerSize = "sm" }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={triggerVariant} size={triggerSize} />}>Delete</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Delete this session?</DialogTitle></DialogHeader>
        <p className="text-base text-zinc-600">This will permanently remove the {sessionLabel}. This cannot be undone.</p>
        <form action={deleteSessionAction.bind(null, sessionId)} onSubmit={() => setOpen(false)}>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Keep Session</DialogClose>
            <Button type="submit" className="bg-red-600 text-white hover:bg-red-700">Delete Session</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```
**Pattern to copy exactly:** the bound-Server-Action-via-`.bind(null, id)` idiom (no client-side fetch plumbing), the "trigger neutral / confirm red" color rule, `onSubmit={() => setOpen(false)}`. Swap copy for `deleteInvoiceAction`, "Delete this invoice?" / "Keep Invoice" / "Delete Invoice" per UI-SPEC Copywriting Contract. Note: `deleteInvoiceAction` on success must navigate to `/history` (UI-SPEC Surface 4) — this dialog will need a client-side `router.push` after the bound action resolves, or the action itself can `redirect("/history")` server-side (Next.js Server Action `redirect()` throws-to-navigate, simpler — prefer this, mirroring how `deleteSessionAction` returns void and only revalidates since it doesn't need to navigate away from a shared page).

---

### `components/invoice-view.tsx` (component, request-response)

**No direct analog for the frozen-mono-text-block rendering** — this is a genuinely new UI element (UI-SPEC Surface 4). Reuse only the page-heading/metadata-line convention from `app/(app)/dashboard/page.tsx` (lines 56-59) and the action-button-row grouping from `student-table.tsx`'s `renderActions` slot pattern (lines 72-76, 95):
```typescript
<TableCell className="text-right">
  <div className="flex justify-end gap-2">{renderActions(student)}</div>
</TableCell>
```
Apply the same `flex gap-2` action-row grouping for Email Invoice / Copy Invoice Text / Delete Invoice. The mono/zinc-50/bordered text block styling is fully specified in UI-SPEC Surface 3/4 (`rounded-lg border border-zinc-200 bg-zinc-50 p-4 font-mono text-sm whitespace-pre-wrap leading-relaxed text-zinc-900`) — implement per spec, no codebase precedent to copy for the block itself. Clipboard copy button uses `lib/invoice/mailto.ts`'s sibling `navigator.clipboard.writeText()` wrapper per 03-RESEARCH.md Code Examples (MDN-cited).

---

### `components/invoice-history-table.tsx` (component, CRUD read)

**Analog:** `components/student-table.tsx` (full file, lines 1-108) — copy the responsive table(md+)/cards(mobile) shell verbatim.

**Empty state pattern** (lines 39-49):
```typescript
if (students.length === 0) {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <h2 className="text-xl leading-tight font-semibold text-zinc-900">{emptyState.heading}</h2>
      <p className="text-base text-zinc-600">{emptyState.body}</p>
      {emptyState.action}
    </div>
  );
}
```

**Table + mobile card structure** (lines 51-107) — same `hidden md:block` / `flex flex-col gap-3 md:hidden` breakpoint split, same `TableCell className="text-right"` action column, same card `flex items-center justify-between gap-2` header row. Columns per UI-SPEC Surface 5: Student | Period | Total | Generated | Actions (single outline "View" Link, not renderActions-injected buttons plural — simpler than StudentTable's Edit+Archive pair).

---

### `components/dashboard-table.tsx` (MODIFY — component, event-driven trigger add)

**Analog:** itself, current row-header structure (lines 96-123) — DOM restructure required per UI-SPEC Surface 2 (button-in-button is illegal; must split into sibling toggle button + plain span + new Generate Invoice button). Current single-button structure:
```typescript
<button
  type="button"
  onClick={() => setOpen((o) => !o)}
  className="flex min-h-11 w-full items-center justify-between gap-2 px-4 py-2 text-left"
>
  <span className="flex items-center gap-2">...chevron + name...</span>
  <span className="flex items-center gap-4">...duration + amount...</span>
</button>
```
New structure (per UI-SPEC Surface 2): outer `<div className="flex min-h-11 w-full items-center gap-2 px-4 py-2">` wrapping an inner toggle `<button className="flex flex-1 items-center gap-2 text-left">` (chevron+name only) + a plain `<span>` (duration+amount) + a sibling "Generate Invoice" `Button` (`variant="outline" size="sm"`, omitted when `row.unbilledAmountCents === 0`). New button opens `InvoicePreviewDialog` for that student — mirrors how `SessionFormDialog mode="edit"` is already invoked inline per-row (lines 158-165) without a separate confirm step first.

---

### `components/top-nav.tsx` (MODIFY — component, request-response)

**Analog:** itself (full file, lines 1-46).

```typescript
const NAV_ITEMS = [
  { href: "/", label: "Students" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/sessions", label: "Sessions" },
] as const;
```
**Change:** append `{ href: "/history", label: "History" }` and `{ href: "/settings", label: "Settings" }` (UI-SPEC Surface 1 order: Students · Dashboard · Sessions · History · Settings). Active-state logic (lines 24-27, 33-37) is otherwise unchanged — no special-casing needed for the two new flat routes (only "/" has the special archived-subtab exception).

---

### `app/(app)/settings/page.tsx` and `app/(app)/history/page.tsx` (route, CRUD read)

**Analog:** `app/(app)/dashboard/page.tsx` (full file, lines 1-77) for the Server Component data-fetch + pass-to-client-table pattern; `app/(app)/sessions/page.tsx` for the page-heading + primary-action-in-header layout (lines 63-79).

**Page shell pattern** (dashboard/page.tsx lines 55-59, 68-74):
```typescript
return (
  <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
    <h1 className="text-[28px] leading-tight font-semibold text-zinc-900">Dashboard</h1>
    <div className="mt-6">
      <DashboardTable rows={dashboardRows} sessionsByStudentId={sessionsByStudentId} students={activeStudents} />
    </div>
  </div>
);
```
`history/page.tsx`: `db.select().from(invoices).orderBy(desc(invoices.generatedAt))` joined to `students` for the name column (mirrors the `sessions.ts` page's `leftJoin` idiom, lines 17-26), passed into `InvoiceHistoryTable`.
`settings/page.tsx`: single-row read (`db.select().from(settings).where(eq(settings.id, 1))`, or fall back to shipped defaults if no row exists yet), passed as `defaultValue`s into `SettingsForm`.

---

## Shared Patterns

### Server Action boilerplate (`"use server"` + zod safeParse + fieldErrors + revalidatePath)
**Source:** `lib/actions/sessions.ts` lines 1-13, 41-49, 77-79
**Apply to:** `lib/actions/invoices.ts`, `lib/actions/settings.ts`
```typescript
"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export interface XActionState {
  fieldErrors: Record<string, string[]> | null;
}

export async function xAction(_prevState: XActionState, formData: FormData): Promise<XActionState> {
  const parsed = xFormSchema.safeParse({ ... });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  // ... db write ...
  revalidatePath("/relevant-path");
  return { fieldErrors: null };
}
```

### Bound-argument delete Server Action (no client fetch plumbing)
**Source:** `lib/actions/sessions.ts` lines 125-135, `components/session-delete-confirm-dialog.tsx` line 54
**Apply to:** `deleteInvoiceAction`, invoked via `deleteInvoiceAction.bind(null, invoiceId)` in a plain `<form action={...}>`.

### Money/duration formatting — single source of truth
**Source:** `lib/format.ts` (full file)
**Apply to:** every invoice line item, total, and preview computation — never reimplement `formatCents`/`formatDuration`.

### Date display (never round-trip stored date strings through JS Date for storage)
**Source:** `components/dashboard-table.tsx` lines 39-43
**Apply to:** `lib/invoice/render.ts`'s period/line-item date formatting — `format(new Date(`${date}T00:00:00`), "PPP")`, display-only conversion.

### Dialog shell (`Dialog`/`DialogTrigger`/`DialogContent`/`DialogHeader`/`DialogFooter`/`DialogClose`)
**Source:** `components/session-form-dialog.tsx` lines 114-247, `components/session-delete-confirm-dialog.tsx` lines 35-71
**Apply to:** `invoice-preview-dialog.tsx`, `invoice-delete-confirm-dialog.tsx` — same `render={<Button .../>}` composition (Base UI, not Radix `asChild`), same "Cancel/Discard" outline + accent/red confirm color rule.

### Responsive table(md+)/cards(mobile) list
**Source:** `components/student-table.tsx` full file
**Apply to:** `invoice-history-table.tsx` — identical `hidden md:block` / `flex flex-col gap-3 md:hidden` breakpoint split, identical empty-state block.

### `noValidate` + server-side-only zod validation
**Source:** `components/session-form-dialog.tsx` line 133 comment + pattern
**Apply to:** `settings-form.tsx`, `invoice-preview-dialog.tsx` forms — no client-side HTML5 validation attributes; zod `safeParse` in the Server Action is the sole gate.

### Atomic multi-write via `db.batch()` (NEVER `db.transaction()`)
**Source:** 03-RESEARCH.md Pattern 1/2 (no in-repo precedent — net-new for this phase, `lib/db/index.ts`'s `neon-http` driver confirmed in place)
**Apply to:** `generateInvoiceAction` (insert invoice, then batch-update sessions billed=true) and `deleteInvoiceAction` (batch: update sessions billed=false/invoiceId=null + delete invoice row).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `lib/invoice/mailto.ts` | utility | transform | No existing client-side email/URL-building code in the repo; net-new capability per D-10/D-11 — use 03-RESEARCH.md's Code Examples directly |
| Frozen mono invoice text block in `invoice-view.tsx` | component (display) | transform | First use of Geist Mono / `whitespace-pre-wrap` document-style rendering in the app — fully specified in UI-SPEC Surfaces 3/4, no codebase precedent |
| "Saved." transient success flash in `settings-form.tsx` | component (display) | event-driven | No existing pattern for a timed inline success message; implement with local `useState` + timeout, following the general "local state reacts to action state change" idiom from `session-form-dialog.tsx` |

## Metadata

**Analog search scope:** `lib/actions/`, `lib/validation/`, `lib/db/`, `components/`, `app/(app)/`
**Files scanned:** 20 existing source files (all non-generated `.ts`/`.tsx` in the repo)
**Pattern extraction date:** 2026-07-05
