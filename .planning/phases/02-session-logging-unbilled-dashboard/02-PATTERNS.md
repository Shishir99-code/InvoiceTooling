# Phase 2: Session Logging & Unbilled Dashboard - Pattern Map

**Mapped:** 2026-07-03
**Files analyzed:** 15
**Analogs found:** 15 / 15

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|---------------|
| `lib/db/schema.ts` (add `sessions` table) | model | CRUD | `lib/db/schema.ts` (`students` table, same file) | exact |
| `lib/validation/session.ts` | utility (validation) | request-response | `lib/validation/student.ts` | exact |
| `lib/actions/sessions.ts` | service (Server Action) | CRUD | `lib/actions/students.ts` | exact |
| `components/session-form-dialog.tsx` | component | request-response | `components/student-form-dialog.tsx` | exact |
| `components/session-delete-confirm-dialog.tsx` | component | request-response | `components/archive-confirm-dialog.tsx` | exact |
| `components/student-combobox.tsx` | component | request-response | `components/student-form-dialog.tsx` (Input field wiring) — no combobox analog exists; net-new shadcn primitive | role-match |
| `components/date-picker-field.tsx` | component | request-response | `components/student-form-dialog.tsx` (Input field wiring pattern) — no date-picker analog exists | role-match |
| `components/session-table.tsx` (grouped by student) | component | CRUD | `components/student-table.tsx` | exact |
| `components/dashboard-table.tsx` | component | CRUD (aggregate read) | `components/student-table.tsx` | role-match |
| `components/top-nav.tsx` | component | request-response | `app/page.tsx` (inlined Students/Archived tab strip) | role-match |
| `lib/format.ts` (extract `formatCents`/`formatRate`) | utility | transform | `components/student-table.tsx` (`formatRate` function, lines 31-33) | exact |
| `app/(app)/layout.tsx` | provider/layout | request-response | `app/layout.tsx` | role-match |
| `app/(app)/page.tsx` (moved) | route (page) | CRUD | `app/page.tsx` | exact |
| `app/(app)/archived/page.tsx` (moved) | route (page) | CRUD | `app/archived/page.tsx` | exact |
| `app/(app)/dashboard/page.tsx` | route (page) | CRUD (aggregate) | `app/page.tsx` (Server Component `db.select()` pattern) | role-match |
| `app/(app)/sessions/page.tsx` | route (page) | CRUD | `app/page.tsx` | role-match |

## Pattern Assignments

### `lib/db/schema.ts` (model, CRUD) — add `sessions` table

**Analog:** `lib/db/schema.ts` (same file, `students` table, lines 1-10)

**Full existing file for reference:**
```typescript
import { pgTable, serial, varchar, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const students = pgTable("students", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  rateCents: integer("rate_cents").notNull(), // D-07: integer cents, never float
  parentEmail: varchar("parent_email", { length: 255 }).notNull(), // D-13: required
  archived: boolean("archived").notNull().default(false), // D-10/D-11: soft delete
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

**Style to copy:** inline `//` comments annotating each column with the decision ID it enforces (`D-07`, `D-13`, etc.). New `sessions` table must follow the same annotation convention, e.g.:
```typescript
import { pgTable, serial, integer, boolean, timestamp, date, text } from "drizzle-orm/pg-core";

export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "restrict" }), // never cascade — archived students keep history
  date: date("date", { mode: "string" }).notNull(), // mode "string": avoids TZ-shift
  durationMinutes: integer("duration_minutes").notNull(), // hours+minutes combine into this
  amountCents: integer("amount_cents").notNull(), // D-14: frozen snapshot, computed server-side once at write time
  notes: text("notes"), // SESS-02: optional
  billed: boolean("billed").notNull().default(false), // Phase 3 sets true; Phase 2 only reads for DASH-02
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```
Add the import for `date` and `text` column types to the existing `drizzle-orm/pg-core` import line rather than a second import statement.

---

### `lib/validation/session.ts` (utility/validation, request-response)

**Analog:** `lib/validation/student.ts`

**Full existing file (copy structure exactly):**
```typescript
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { students } from "@/lib/db/schema";

const baseStudentSchema = createInsertSchema(students, {
  name: z.string().trim().min(1, "Enter a name."),
});

export const studentFormSchema = baseStudentSchema.pick({ name: true }).extend({
  rateDollars: z.coerce
    .number({ error: "Rate must be a positive number." })
    .positive("Rate must be a positive number."),
  parentEmail: z.email("Enter a valid email."),
});

export type StudentFormValues = z.infer<typeof studentFormSchema>;
```

**Pattern to replicate for `sessionFormSchema`:**
- Use `createInsertSchema(sessions, {...overrides})` as the base, then `.pick()` the DB-native fields and `.extend()` client-facing fields that need conversion (dollars→cents becomes hours/minutes→durationMinutes here).
- `studentId`: `z.coerce.number("Invalid student.").int().positive("Invalid student.")` — copy the exact pattern used in `lib/actions/students.ts`'s local `editStudentSchema.extend({ id: ... })` (see next section) since the base table's `studentId` is a raw FK int, same shape as `id` there.
- `date`: `z.iso.date()` per RESEARCH.md Pattern 5/Standard Stack (zod v4 API) — validates exact `YYYY-MM-DD`.
- `hours` / `minutes` (or a single `durationMinutes` if combined client-side before submit): `z.coerce.number().int().nonnegative()`, with a `.refine` or combined-field check that total > 0 (Pattern 4 of RESEARCH.md).
- `notes`: `z.string().trim().max(...).optional()` — optional per D-07/SESS-02.
- Export `type SessionFormValues = z.infer<typeof sessionFormSchema>;` exactly like `StudentFormValues`.

---

### `lib/actions/sessions.ts` (service/Server Action, CRUD)

**Analog:** `lib/actions/students.ts` (full file, 119 lines — read completely, no re-read needed)

**Imports pattern (lines 1-9):**
```typescript
"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { students } from "@/lib/db/schema";
import { studentFormSchema } from "@/lib/validation/student";
```
For sessions, import both `sessions` and `students` from `@/lib/db/schema` (need `students.rateCents` for the authoritative re-fetch — Pitfall 1), and `sessionFormSchema` from `@/lib/validation/session`.

**Action state + edit-schema extension pattern (lines 11-22):**
```typescript
export interface StudentActionState {
  fieldErrors: Record<string, string[]> | null;
}

const initialStudentActionState: StudentActionState = { fieldErrors: null };

// editStudentAction needs the row id in addition to the shared form fields —
// extended locally here rather than exported from lib/validation/student.ts,
// which stays scoped to the add/edit form fields only.
const editStudentSchema = studentFormSchema.extend({
  id: z.coerce.number("Invalid student.").int().positive("Invalid student."),
});
```
Mirror exactly: `SessionActionState`, `initialSessionActionState`, and a locally-extended `editSessionSchema = sessionFormSchema.extend({ id: z.coerce.number(...).int().positive(...) })`.

**Form parsing helper pattern (lines 24-39):**
```typescript
function parseAddForm(formData: FormData) {
  return studentFormSchema.safeParse({
    name: formData.get("name"),
    rateDollars: formData.get("rateDollars"),
    parentEmail: formData.get("parentEmail"),
  });
}

function parseEditForm(formData: FormData) {
  return editStudentSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    rateDollars: formData.get("rateDollars"),
    parentEmail: formData.get("parentEmail"),
  });
}
```
Copy shape 1:1 for `parseAddSessionForm`/`parseEditSessionForm`, reading `studentId`, `date`, `hours`/`minutes` (or `durationMinutes`), `notes` from `formData.get(...)`.

**Core mutation pattern — add (lines 41-62), showing the "re-fetch authoritative value, never trust client" principle already established for money:**
```typescript
export async function addStudentAction(
  _prevState: StudentActionState,
  formData: FormData,
): Promise<StudentActionState> {
  const parsed = parseAddForm(formData);

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  await db.insert(students).values({
    name: parsed.data.name,
    // Math.round avoids float drift (19.99 * 100 === 1998.999...999998 in JS).
    rateCents: Math.round(parsed.data.rateDollars * 100),
    parentEmail: parsed.data.parentEmail,
    archived: false,
  });

  revalidatePath("/");
  return initialStudentActionState;
}
```
**For `addSessionAction`, extend this pattern with an authoritative re-fetch (Pitfall 1 in RESEARCH.md — the money-rounding comment style should be copied verbatim for the `amountCents` computation):**
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
  // rateCents from the DB at write time (Pitfall 1).
  const [student] = await db.select().from(students)
    .where(eq(students.id, parsed.data.studentId));
  if (!student) {
    return { fieldErrors: { studentId: ["Invalid student."] } };
  }

  const amountCents = Math.round(
    (parsed.data.durationMinutes * student.rateCents) / 60,
  );

  await db.insert(sessions).values({
    studentId: parsed.data.studentId,
    date: parsed.data.date,
    durationMinutes: parsed.data.durationMinutes,
    amountCents,
    notes: parsed.data.notes ?? null,
    billed: false,
  });

  revalidatePath("/dashboard");
  revalidatePath("/sessions");
  return initialSessionActionState;
}
```

**Edit pattern (lines 64-85)** mirrors add but with `db.update(...).set({...}).where(eq(sessions.id, parsed.data.id))`, re-fetching rate the same way, and revalidating the same two paths.

**Delete pattern — NEW shape, not a clone of archive.** D-10 says hard delete (unlike students' soft-archive). Use the *shape* of `archiveStudentAction` (lines 90-103) but with `db.delete(...)` instead of `db.update(...).set({archived:true})`:
```typescript
// D-10: sessions are hard-deleted (unlike students, which only ever soft-archive).
export async function deleteSessionAction(id: number): Promise<void> {
  const sessionId = Number(id);
  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    throw new Error("Invalid session id.");
  }

  await db.delete(sessions).where(eq(sessions.id, sessionId));

  revalidatePath("/dashboard");
  revalidatePath("/sessions");
}
```
Keep the `Number(id)` validation guard and the arg-bound Server Action signature (`(id: number): Promise<void>`) identical to `archiveStudentAction`/`restoreStudentAction` so `.bind(null, sessionId)` works the same way in the confirm dialog.

---

### `components/session-form-dialog.tsx` (component, request-response)

**Analog:** `components/student-form-dialog.tsx` (full file, 172 lines)

**Structural pattern to clone exactly:**
- `"use client"` + `useActionState` wired to `addSessionAction`/`editSessionAction` based on a `mode: "add" | "edit"` discriminated union prop (lines 36-45).
- The "close dialog only on real successful submit" state-tracking pattern (lines 48-60) — copy verbatim, it is a subtle React pattern (adjusting state during render, not an Effect) worth preserving exactly:
```typescript
const [prevState, setPrevState] = useState(state);
if (state !== prevState) {
  setPrevState(state);
  if (state.fieldErrors === null) {
    setOpen(false);
  }
}
```
- `Dialog`/`DialogTrigger` with `render={<Button .../>}` composition (Base UI idiom, lines 68-79) — every new trigger (`StudentCombobox` popover trigger, `DatePickerField` popover trigger) must use this same `render` prop style, NOT `asChild`.
- `<form action={formAction} noValidate className="flex flex-col gap-4">` (line 90-94) — `noValidate` is required per the comment: server-side zod is the sole validation source. Copy this exact comment/rationale into the new form.
- Hidden `id` input for edit mode (line 95-97): `{isEdit && <input type="hidden" name="id" value={props.student.id} />}` — session edit form needs the same for `sessions.id`, plus a hidden input synced to the Combobox-selected `studentId` (per RESEARCH.md Pattern 2: `<input type="hidden" name="studentId" value={value?.id ?? ""} />`).
- Field + inline error pattern repeated per field (lines 99-154): `Label` + `Input`/custom-field + `{state.fieldErrors?.X && <p className="text-sm text-red-600">{state.fieldErrors.X[0]}</p>}`. Repeat this block shape for `studentId` (Combobox), `date` (DatePickerField), `hours`/`minutes` (Select pair), `notes` (Input or textarea).
- `DialogFooter` with `DialogClose` "Discard" + submit button showing `isPending`-driven label (lines 156-167) — copy verbatim, adjusting labels to "Log Session"/"Save Changes"/"Logging…"/"Saving…".

---

### `components/session-delete-confirm-dialog.tsx` (component, request-response)

**Analog:** `components/archive-confirm-dialog.tsx` (full file, 73 lines)

**Pattern to clone, with hard-delete language substituted for archive language:**
```typescript
"use client";

import { useState, type ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { deleteSessionAction } from "@/lib/actions/sessions";

interface SessionDeleteConfirmDialogProps {
  sessionId: number;
  sessionLabel: string; // e.g. "Jan 5 session with Alex"
  triggerVariant?: ComponentProps<typeof Button>["variant"];
  triggerSize?: ComponentProps<typeof Button>["size"];
}

// D-10: delete always shows a confirm dialog first, then hard-deletes.
export function SessionDeleteConfirmDialog({
  sessionId, sessionLabel, triggerVariant = "outline", triggerSize = "sm",
}: SessionDeleteConfirmDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={triggerVariant} size={triggerSize} />}>
        Delete
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this session?</DialogTitle>
        </DialogHeader>
        <p className="text-base text-zinc-600">
          {sessionLabel} will be permanently removed. This cannot be undone.
        </p>
        <form action={deleteSessionAction.bind(null, sessionId)} onSubmit={() => setOpen(false)}>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button type="submit" className="bg-red-600 text-white hover:bg-red-700">
              Delete Session
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```
Key difference from the analog: copy says "permanently removed... cannot be undone" (hard delete) instead of "removed from roster... can restore" (soft archive) — this is intentional per D-10, not an oversight.

---

### `components/student-combobox.tsx` and `components/date-picker-field.tsx` (component, request-response)

**No direct analog exists in the codebase** — these wrap net-new shadcn `combobox`/`popover`+`calendar` components. Closest structural precedent is the `Dialog`/`DialogTrigger` `render`-prop composition in `components/ui/dialog.tsx` (lines 14-16, 42-49) which establishes this project's Base UI trigger idiom — every new trigger composition (Combobox input, Popover trigger for the date picker) must follow this `render` prop style, not `asChild`. Use RESEARCH.md's Pattern 2 and Pattern 3 code verbatim as the implementation starting point (already adapted to this repo's idiom in that document) — do not pull generic shadcn tutorial code that uses Radix `asChild`.

**Field-wiring convention to match `student-form-dialog.tsx`:** wrap each in the same `<div className="flex flex-col gap-2"><Label>...</Label>{FIELD}{state.fieldErrors?.X && <p className="text-sm text-red-600">...}</div>` shape used for every other field in that file (lines 99-112 pattern).

---

### `components/session-table.tsx` (component, CRUD) — grouped by student (D-08)

**Analog:** `components/student-table.tsx` (full file, 112 lines)

**Reuse directly:**
- The responsive table (md+) / stacked-card (mobile) split (lines 56-108) — same `hidden ... md:block` / `flex ... md:hidden` breakpoint pattern.
- The empty-state block (lines 42-52) — `heading`/`body`/optional `action` props, same shape.
- `renderActions: (row) => ReactNode` callback prop convention (lines 24-29) so the table component stays agnostic of which actions (edit/delete) the caller wires up.
- Extract `formatRate` (lines 31-33) into `lib/format.ts` as `formatCents(cents: number)` (see dedicated section below), then import it here for both rate/hr display and per-session amount display.

**New structural wrapper needed (not in the analog):** group session rows under a per-student header/accordion section (D-08). Since no accordion component exists yet, use collapsible `<details>`/`<summary>` or a simple `useState`-driven client toggle per student group, applying the *same* table/card body markup as `StudentTable` inside each group.

---

### `components/dashboard-table.tsx` (component, CRUD aggregate read)

**Analog:** `components/student-table.tsx` (same reuse points as above: responsive table/card split, empty-state shape, `formatRate`/`formatCents` reuse) plus an expand/collapse affordance per row (D-11) similar to the grouping needed in `session-table.tsx`.

**Data shape difference:** rows here are the aggregate query result (`{ id, name, unbilledMinutes, unbilledAmountCents }`) from RESEARCH.md Pattern 6, not raw `students` rows — column list differs (Unbilled Hours / Amount Owed instead of Rate / Parent Email), but the same `TableHeader`/`TableRow`/`TableCell` `components/ui/table.tsx` primitives and md+/mobile split apply.

---

### `components/top-nav.tsx` (component, request-response)

**Analog:** the inlined Students/Archived tab strip in `app/page.tsx` (lines 39-52) and mirrored in `app/archived/page.tsx` (lines 29-42):
```tsx
<div className="mb-6 flex gap-6 border-b border-zinc-200">
  <Link
    href="/"
    className="-mb-px border-b-2 border-blue-600 pb-2 text-base font-medium text-blue-600"
  >
    Students
  </Link>
  <Link
    href="/archived"
    className="-mb-px border-b-2 border-transparent pb-2 text-base font-medium text-zinc-600 hover:text-zinc-900"
  >
    Archived
  </Link>
</div>
```
**Pattern to extend:** promote this exact `Link` + active/inactive `border-b-2` styling convention into a standalone `TopNav` client-or-server component with three destinations (Students / Dashboard / Sessions per D-02), computing "active" via `usePathname()` (needs `"use client"`) or by passing the current path from the layout. The nested Students/Archived tab pair stays exactly as currently inlined in `app/(app)/page.tsx` and `app/(app)/archived/page.tsx` — do NOT flatten Archived into the top-level nav (explicit in D-02).

---

### `lib/format.ts` (utility, transform) — NEW shared helper

**Analog:** `components/student-table.tsx` lines 31-33:
```typescript
function formatRate(rateCents: number) {
  return `$${(rateCents / 100).toFixed(2)}`;
}
```
**Extraction target:**
```typescript
// lib/format.ts
export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
```
Update `components/student-table.tsx` to import `formatCents` from `@/lib/format` in place of its local `formatRate` (rename call sites, or keep a thin `formatRate = formatCents` alias if minimizing diff is preferred) — this is the exact refactor CONTEXT.md's "Claude's Discretion" section calls for.

---

### `app/(app)/layout.tsx` (provider/layout, request-response)

**Analog:** `app/layout.tsx` (root layout, full file, 34 lines) — but this is a NEW nested layout, not a modification of the root. Root `app/layout.tsx` stays untouched (fonts/html/body only — Pitfall 6 explicitly warns against adding nav there).

**Pattern:**
```tsx
import { TopNav } from "@/components/top-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNav />
      <main>{children}</main>
    </>
  );
}
```
Matches RESEARCH.md Pattern 1 verbatim. Do not duplicate the `<html>`/`<body>` wrapper here — that stays solely in the root `app/layout.tsx`; this nested layout only adds chrome inside `{children}` of the root.

---

### `app/(app)/page.tsx`, `app/(app)/archived/page.tsx` (route, CRUD) — MOVED files

**Analog:** `app/page.tsx` (87 lines) and `app/archived/page.tsx` (69 lines), respectively — moved verbatim into the new route group, same `db.select().from(students).where(eq(students.archived, ...)).orderBy(students.name)` Server Component read pattern, same `StudentTable`/`StudentFormDialog`/`ArchiveConfirmDialog` composition. Only the file path changes (`app/page.tsx` → `app/(app)/page.tsx`); the URL (`/`) and all component logic stay identical.

**Note:** once `app/(app)/layout.tsx` renders `<TopNav />`, the inlined Students/Archived tab strip (lines 39-52 of `app/page.tsx`) can either stay (nested sub-nav per D-02) or be left as-is — CONTEXT.md D-02 explicitly says keep this pair nested under Students, so do NOT remove it when moving the file.

---

### `app/(app)/dashboard/page.tsx` (route, CRUD aggregate)

**Analog:** `app/page.tsx`'s Server Component `db.select()...orderBy(...)` shape (lines 13-17), extended with the LEFT JOIN/GROUP BY aggregate from RESEARCH.md Pattern 6:
```typescript
import { eq, sql, desc, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { students, sessions } from "@/lib/db/schema";

const unbilledMinutesExpr = sql<number>`coalesce(sum(${sessions.durationMinutes}) filter (where ${sessions.billed} = false), 0)`;
const unbilledAmountExpr = sql<number>`coalesce(sum(${sessions.amountCents}) filter (where ${sessions.billed} = false), 0)`;

const dashboardRows = await db
  .select({
    id: students.id,
    name: students.name,
    unbilledMinutes: unbilledMinutesExpr.mapWith(Number),
    unbilledAmountCents: unbilledAmountExpr.mapWith(Number),
  })
  .from(students)
  .leftJoin(sessions, eq(sessions.studentId, students.id))
  .where(eq(students.archived, false)) // D-12: archived students excluded
  .groupBy(students.id, students.name)
  .orderBy(desc(unbilledAmountExpr), asc(students.name)); // most-owed first, tiebreak alpha
```
Page-level markup wraps this in the same `<div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">` container and `<h1 className="text-[28px] leading-tight font-semibold text-zinc-900">` heading convention as `app/page.tsx` lines 20-24.

---

### `app/(app)/sessions/page.tsx` (route, CRUD)

**Analog:** `app/page.tsx`'s Server Component data-fetch + page-shell convention, feeding into the new grouped `SessionTable`/`session-form-dialog`/`session-delete-confirm-dialog` components described above. Fetch pattern: `db.select().from(sessions).innerJoin/leftJoin(students, ...)`.orderBy(students.name, desc(sessions.date))`, grouped client-side by `studentId` for the D-08 accordion layout, then rendered via `SessionTable`.

## Shared Patterns

### Server Action shape (`"use server"` + zod + revalidatePath)
**Source:** `lib/actions/students.ts` (whole file)
**Apply to:** `lib/actions/sessions.ts` — every mutation (add/edit/delete)
```typescript
"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
// ...
export interface XActionState { fieldErrors: Record<string, string[]> | null; }
// safeParse -> z.flattenError(...).fieldErrors on failure -> db write -> revalidatePath(...) -> return initial state
```
Session actions must call `revalidatePath("/dashboard")` AND `revalidatePath("/sessions")` (Pitfall 5) — not just one route.

### Modal dialog + useActionState + "close only on real success" (D-03, D-09)
**Source:** `components/student-form-dialog.tsx` lines 42-60
**Apply to:** `session-form-dialog.tsx`
```typescript
const [state, formAction, isPending] = useActionState(action, initialState);
const [open, setOpen] = useState(false);
const [prevState, setPrevState] = useState(state);
if (state !== prevState) {
  setPrevState(state);
  if (state.fieldErrors === null) setOpen(false);
}
```

### Confirm-then-mutate dialog with arg-bound Server Action (D-10)
**Source:** `components/archive-confirm-dialog.tsx` lines 53-56
**Apply to:** `session-delete-confirm-dialog.tsx`
```typescript
<form action={deleteSessionAction.bind(null, sessionId)} onSubmit={() => setOpen(false)}>
```

### Base UI `render`-prop trigger composition (NOT Radix `asChild`)
**Source:** `components/ui/dialog.tsx` lines 14-16, `student-form-dialog.tsx` lines 69-79
**Apply to:** Every new shadcn component this phase adds (`combobox`, `select`, `popover`, `calendar`) — all use `render={<Button .../>}`, matching this repo's pinned `style: "base-nova"`.

### Money as integer cents, single rounding point
**Source:** `lib/actions/students.ts` line 54-55 comment: `// Math.round avoids float drift (19.99 * 100 === 1998.999...999998 in JS).`
**Apply to:** `addSessionAction`/`editSessionAction`'s `amountCents = Math.round((durationMinutes * student.rateCents) / 60)` — copy the same explanatory comment style, and always re-fetch `rateCents` server-side (Pitfall 1) rather than trusting a client value.

### Responsive table (md+) / stacked-card (mobile) split + empty state + `renderActions` callback
**Source:** `components/student-table.tsx` (whole file)
**Apply to:** `session-table.tsx`, `dashboard-table.tsx`

### `formatRate`/`formatCents` money formatting
**Source:** `components/student-table.tsx` lines 31-33
**Apply to:** Extract into `lib/format.ts` as `formatCents`; reuse in session/dashboard tables and the session form.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `components/student-combobox.tsx` | component | request-response | No filterable-picker/autocomplete component exists yet in the codebase; use RESEARCH.md Pattern 2 (shadcn Base UI Combobox) as the implementation source instead of a codebase analog. |
| `components/date-picker-field.tsx` | component | request-response | No date-picker component exists yet; use RESEARCH.md Pattern 3 (shadcn Popover + Calendar, Base UI `render`-prop idiom) as the implementation source. |
| Hours/minutes `Select` pair (inline in `session-form-dialog.tsx`) | component | request-response | No `Select` dropdown exists yet in the codebase; use RESEARCH.md Pattern 4 as the implementation source. |

## Metadata

**Analog search scope:** `app/`, `components/`, `components/ui/`, `lib/actions/`, `lib/validation/`, `lib/db/`, `middleware.ts` (entire non-node_modules source tree)
**Files scanned:** 15 (all existing source files in the repo outside `.planning/`, `node_modules/`, `.next/`)
**Pattern extraction date:** 2026-07-03
