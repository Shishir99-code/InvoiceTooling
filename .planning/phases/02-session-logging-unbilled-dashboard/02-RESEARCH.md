# Phase 2: Session Logging & Unbilled Dashboard - Research

**Researched:** 2026-07-03
**Domain:** Next.js 16 App Router CRUD (Drizzle/Postgres) + Base UI-flavored shadcn/ui form components (Combobox, Calendar, Select) + server-side money/date-safe aggregation
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Landing & Navigation**
- **D-01:** Roster stays the home page (`/`). Phase 1's student roster remains the landing screen — the Dashboard does NOT replace it.
- **D-02:** Top nav with three destinations: Students / Dashboard / Sessions. Students is home with Archived as a sub-view (keep the existing Students/Archived tab pair nested under Students — do NOT promote Archived to a flat top-level nav item). Dashboard = who-owes-what. Sessions = the log of everything entered. This replaces the current bare Students/Archived tab strip with a proper app-level nav.

**Logging a Session**
- **D-03:** Modal dialog entry, consistent with the Phase 1 add/edit student dialog. A "Log Session" button opens a pop-up form over the current page (stay-on-page). Reuse the existing `StudentFormDialog`/shadcn `Dialog` pattern.
- **D-04:** Student picker = name autocomplete showing `Name — parent email`. Duplicate names are allowed (D-09 from Phase 1), and parent email is unique and always present (Phase 1 D-13), so it's the disambiguator. The form must resolve the selection to a specific `students.id`, not a name string — two students can share a name.
- **D-05:** Length entered via separate hours + minutes dropdowns (e.g. 1 hr, 30 min), NOT a raw decimal field. Convert to decimal hours internally for the money computation. Amount = `hours × students.rateCents`, computed in integer cents, never floats (SESS-05, Phase 1 D-07). Minutes options should be a sensible granularity (e.g. 0/15/30/45).
- **D-06:** Date defaults to today, editable via a date picker. Most sessions are logged same-day or shortly after.
- **D-07:** Notes are optional (SESS-02) — a plain optional text field on the same form.

**Managing Sessions (view / edit / delete)**
- **D-08:** Sessions tab is grouped by student — sessions collapsed/organized under each student (expand a student to see their sessions), mirroring the roster mental model.
- **D-09:** Edit reuses the same modal form, pre-filled with the session's current values. Editing student/date/hours/notes is allowed at any time (SESS-03) and totals recompute immediately.
- **D-10:** Delete = quick confirmation dialog, then hard delete. A small "Delete this session?" confirm (like the Phase 1 Archive confirm), then the row is removed and totals recompute (SESS-04). Sessions are NOT soft-archived — unlike students, individual session rows are low-stakes and don't need a recoverable archive view.

**Dashboard Content**
- **D-11:** Per-student rows: unbilled hours + amount owed, expandable to the underlying unbilled sessions. Collapsed by default (glance-able); expanding a student reveals the individual unbilled sessions that make up the total, with a path to edit one.
- **D-12:** Show ALL active students, sorted most-owed first, with $0 students falling to the bottom (shown as $0). The full active roster always appears on the dashboard, not only those who currently owe. (Archived students are excluded, consistent with Phase 1's archive semantics.)
- **D-13:** Dashboard excludes billed sessions from totals (DASH-02) — the amount-owed and hours figures reflect unbilled sessions only.

**Billed-flag note:** Nothing *sets* a session to billed until Phase 3's invoicing exists. Phase 2 must build the `billed` schema flag and the "exclude billed from unbilled totals" logic (DASH-02), but in practice every Phase 2 session is unbilled. Do not build billed/unbilled UI toggles or billed-session warnings in Phase 2.

### Claude's Discretion
- Exact minutes granularity in the length dropdown (15-min steps suggested).
- Money formatting reuse — the existing `formatRate` (`$X.XX`) pattern in `components/student-table.tsx` should be extracted/reused for amounts owed.
- Precise expand/collapse affordance on the dashboard and the grouped-by-student layout on the Sessions tab (accordion vs. section headers) — implementation/UI choice, following existing shadcn + responsive table→card patterns.
- Whether editing a session is reachable from the Dashboard expansion as well as the Sessions tab — allowed, non-blocking.
- Empty states (no sessions logged yet → dashboard shows all students at $0; a student with no sessions in the grouped Sessions view) — follow the friendly empty-state pattern established in Phase 1 (D-15).

### Deferred Ideas (OUT OF SCOPE)
**→ v2 milestone (new capability, NOT Phase 2 or the current v1 billing milestone).**
- Scheduling system — logging/viewing upcoming and recurring classes (a forward-looking calendar), including the "completed scheduled class → auto-becomes a billable session" synergy. Data-model implication noted: a "session" would shift from "logged-after-the-fact" to "scheduled event with a status" — NOT this phase.
- Zoom link generation — auto-generate weekly/per-student Zoom links (Zoom API or reused Personal Meeting ID) — NOT this phase.
- New-student onboarding into the schedule — meaning left unclarified, revisit with v2 scheduling design.

No pending todos were folded in; nothing else strayed outside Phase 2 scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SESS-01 | User can log a session by selecting a student via name autocomplete, plus date and hours | Pattern 2 (Combobox student picker resolving to `students.id`), Pattern 3 (date picker defaulting to today), Pattern 4 (hours+minutes → `durationMinutes`) |
| SESS-02 | User can add optional notes to a session | Pattern 5 (`notes: text("notes")`, nullable column) |
| SESS-03 | User can edit any session's student, date, hours, and notes at any time (including already-billed sessions) | Pattern 5 (schema supports full-row update); D-09 clone of `editStudentAction`; no billed-status gate on edit permission — `billed` only affects dashboard exclusion (DASH-02), never edit eligibility |
| SESS-04 | User can delete a session | D-10 clone of `archiveStudentAction`'s confirm-dialog pattern, but a hard `DELETE`, not an `UPDATE` |
| SESS-05 | Session amounts are computed from hours × the student's hourly rate (money stored as integer cents) | Pattern 5 (money math: `Math.round(durationMinutes * rateCents / 60)`), Pitfall 1 (server re-fetches authoritative rate, never trusts client input) |
| DASH-01 | User can see each student's total unbilled hours and amount owed at a glance | Pattern 6 (LEFT JOIN + GROUP BY aggregate query) |
| DASH-02 | Billed sessions are excluded from the unbilled totals | Pattern 6 (`FILTER (WHERE billed = false)` inside the aggregate, not a `WHERE` clause on the whole query — see Pitfall 4) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Locked stack, no re-litigating:** Next.js 16.2.x App Router, React 19.2.x, TypeScript, Drizzle ORM 0.45.x + drizzle-kit 0.31.x, PostgreSQL via Neon, Tailwind v4, shadcn/ui — this phase must extend these, not introduce alternatives (e.g. no reaching for a different date-picker or state-management library).
- **Server Actions as the API boundary:** every mutation is a `"use server"` function; zod validates at that boundary (per "Supporting Libraries" table) — this phase's `lib/actions/sessions.ts` must follow the same shape as `lib/actions/students.ts`.
- **Money as integer cents, never floats:** explicitly called out in CLAUDE.md's stack rationale and reinforced by Phase 1 D-07/SESS-05 — `Math.round()` at the single point of conversion, never repeated/accumulated rounding.
- **No PDF generation, no transactional email API, no payment SDK:** out of scope for the whole project (CLAUDE.md "What NOT to Use") — irrelevant to Phase 2's scope but reconfirmed as a boundary the Dashboard/Sessions UI must not creep toward (e.g. no "send reminder" button).
- **GSD Workflow Enforcement (procedural, not stack):** CLAUDE.md requires all file-changing work to go through a GSD entry point (`/gsd-execute-phase` etc.) rather than direct ad-hoc edits — applies to how this phase gets implemented, not to its technical content.
- **shadcn style is `base-nova` (Base UI), not Radix:** `components.json` pins `style: "base-nova"`; every new shadcn component this phase adds (`combobox`, `select`, `popover`, `calendar`) will use the Base UI `render`-prop trigger composition already visible in this repo's `Dialog`/`DialogTrigger`, not the Radix `asChild` pattern shown in most external shadcn tutorials.

## Summary

Phase 2 is a second vertical slice built almost entirely by **cloning Phase 1's established patterns** — there is no new architectural decision to make about Server Actions, validation, or the modal-dialog UX; those are locked by precedent in the live codebase. The genuinely new territory is: (1) a `sessions` table with FK-to-students and integer-cents money computed *once, at write time*, not derived live on every read; (2) a student-picker that resolves duplicate names via a `parentEmail` disambiguator, best served by shadcn's **Base UI Combobox** component (not the Radix-era `Command`+`Popover` composition — this project's `components.json` is pinned to `style: "base-nova"`, backed by `@base-ui/react`, already in `package.json`); (3) a GROUP BY/LEFT JOIN aggregate query so the dashboard shows every active student (including $0 ones) sorted most-owed-first; and (4) restructuring `app/layout.tsx` into a route-group layout so the new top nav (Students/Dashboard/Sessions) doesn't leak onto `/login`.

The highest-risk design point this research surfaces and flags for confirmation: **CONTEXT.md does not explicitly say whether a session's dollar amount is a live-computed value (hours × the student's *current* rate) or a snapshot taken at log/edit time.** This research recommends the snapshot approach — store `amountCents` on the session row, recomputed only when the session itself is edited — because it matches the project's own Phase 3 philosophy (frozen invoice snapshots, INV-03/INV-04) and avoids a student's later rate change silently rewriting historical session amounts. This is flagged in the Assumptions Log for the planner/user to confirm.

**Primary recommendation:** Add a `sessions` table (`durationMinutes` integer + `amountCents` integer, both computed server-side, `date` column in `mode: "string"` to dodge timezone drift, `billed boolean default false`, FK `studentId → students.id` with `onDelete: "restrict"`); build the student picker with shadcn's `combobox` component (Base UI); build the length input as two shadcn `select` dropdowns converted to minutes before submission; build the date picker as shadcn `popover` + `calendar` (react-day-picker, already a safe, well-established transitive dependency); compute the unbilled dashboard with a single `LEFT JOIN` + `GROUP BY` + `FILTER (WHERE billed = false)` aggregate query; and move the existing pages into an `app/(app)/` route group with a shared nav layout so `/login` stays nav-free.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Session create/edit/delete | API/Backend (Server Action) | Browser (modal form + Combobox/Select/Calendar) | Mutation + validation must happen server-side (zod), matching Phase 1's `"use server"` boundary; client only collects input |
| Money computation (hours × rate → cents) | API/Backend | — | Must re-fetch `rateCents` server-side from the DB, never trust a client-submitted rate; computed once, stored |
| Student picker / autocomplete | Browser (Client Component) | Database (provides the active-student list once per page load) | Base UI Combobox is a client-side filtering component; the candidate list is small (one tutor's roster) so it's fetched once server-side and handed to the client component as a prop — no client-side fetch/search API needed |
| Unbilled aggregation (DASH-01/02) | Database (GROUP BY/aggregate SQL) | API/Backend (Server Component executing + formatting) | Aggregation belongs in SQL, not JS — avoids fetching every session row just to sum it in Node |
| Date input & storage | Browser (Calendar/Popover UI) | Database (`date` column) | UI concern is a picker; storage concern is avoiding TZ-shift — both matter, split across tiers |
| App-level nav (D-02) | Frontend Server (SSR layout) | — | A shared `layout.tsx` in a new route group is the correct SSR-tier mechanism; no client JS needed for static nav links |

## Standard Stack

### Core (already installed — no new npm installs required for these)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `drizzle-orm` | 0.45.2 [VERIFIED: npm registry] | `sessions` table schema, FK, aggregate queries | Already the project's ORM; Phase 2 only adds a table + queries, no new library |
| `zod` | 4.4.3 [VERIFIED: npm registry] | Session form validation incl. `z.iso.date()` for the date field | Already the project's validation boundary library; v4 ships `z.iso.date()` for exact `YYYY-MM-DD` string validation [CITED: zod.dev/api], which pairs directly with Drizzle's `date` column in `mode: "string"` |
| `date-fns` | 4.4.0 [VERIFIED: npm registry] | Formatting dates for display (`format(date, "PPP")`) | Already in the stack per CLAUDE.md; used by shadcn's own date-picker example [CITED: ui.shadcn.com/docs/components/date-picker] |
| `@base-ui/react` | 1.6.0 [VERIFIED: npm registry, slopcheck OK] | Underlying primitive for Combobox/Select/Popover/Calendar's trigger composition | Already installed; this project's `components.json` `style: "base-nova"` means every `shadcn add` pulls the Base UI-flavored component, which composes via a `render` prop (as already seen in this repo's `Dialog`/`DialogTrigger`), not Radix's `asChild` |

### Supporting (added via `shadcn add`, not raw `npm install`)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `components/ui/combobox.tsx` (shadcn, Base UI variant) | shadcn CLI 4.13.0 [VERIFIED: npm registry] | Student picker resolving to `students.id`, disambiguated by "Name — parent email" | Install with `npx shadcn@latest add combobox` — bundles input/list/item/empty-state, no separate `Command`+`Popover` composition needed for this use case |
| `components/ui/select.tsx` (shadcn, Base UI variant) | shadcn CLI 4.13.0 | Hours dropdown + minutes dropdown (D-05) | Install with `npx shadcn@latest add select` |
| `components/ui/popover.tsx` + `components/ui/calendar.tsx` (shadcn, Base UI variant) | shadcn CLI 4.13.0 | Date picker (D-06), defaults to today | Install with `npx shadcn@latest add popover calendar` |
| `react-day-picker` | 10.0.1 [VERIFIED: npm registry, slopcheck OK] | Powers shadcn's `Calendar` component | Pulled in automatically by `shadcn add calendar` — do not install directly; verify it lands in `package.json` after the add command runs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| shadcn `combobox` (Base UI Combobox primitive) | Manually composed `Command` + `Popover` | The manually-composed pattern is the *older*, Radix-era shadcn idiom and is what most tutorials show; this project's Base UI style ships a purpose-built `Combobox` component that already returns the selected object (not just a string), which is exactly what "resolve to `students.id`" needs — no reason to hand-roll the older composition |
| Native `<input type="date">` | shadcn Calendar + Popover | Native date input is simpler and zero-dependency, but the phase's UI hint is "yes" (polished UI expected) and CLAUDE.md's stack table explicitly lists `date-fns` for this purpose; shadcn's own official pattern pairs Calendar+Popover+`date-fns format()` — use that for visual consistency with the rest of the shadcn-styled app. Native `<input type="date">` remains an acceptable Claude's-Discretion fallback if development speed matters more than visual polish. |
| Storing `amountCents` on the session row (snapshot) | Deriving `amountCents` live in every query (`durationMinutes * rateCents / 60`) | Live derivation means a rate change on the student retroactively changes the dollar value of *already-logged* sessions, and duplicates the same rounding logic in every read query. Snapshotting at write time computes once, is simpler to aggregate (`SUM(amount_cents)`), and mirrors Phase 3's frozen-invoice philosophy. **[ASSUMED — confirm with user before locking, see Assumptions Log A1]** |

**Installation:**
```bash
npx shadcn@latest add combobox select popover calendar
```
No `npm install` of new runtime dependencies is required beyond what `shadcn add` pulls in automatically (`react-day-picker`).

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `react-day-picker` | npm | ~11 yrs (created 2014-12-29) | high (widely used; exact weekly count not queried) | github.com/gpbl/react-day-picker | OK | Approved |
| `@base-ui/react` | npm | already installed in project | — | (base-ui.com project) | OK | Approved (pre-existing dependency, re-verified) |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

No net-new npm packages are being introduced by this phase — `shadcn add <component>` copies component source into `components/ui/` and only pulls `react-day-picker` as a transitive dependency for the Calendar component, which was independently verified above.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────┐
│  Browser (Client Components) │
│  - StudentCombobox (search)   │
│  - SessionFormDialog (modal)  │
│  - Hours/Minutes Select pair  │
│  - Date Popover + Calendar    │
└──────────────┬───────────────┘
               │ FormData via useActionState
               ▼
┌─────────────────────────────────────────┐
│  Server Action ("use server")            │
│  1. zod safeParse(formData)               │
│  2. re-fetch student.rateCents from DB    │
│     (never trust client-submitted rate)   │
│  3. compute durationMinutes, amountCents  │
│  4. insert/update `sessions` row          │
│  5. revalidatePath("/sessions",           │
│                     "/dashboard")         │
└──────────────┬───────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Postgres (Neon) — `sessions` table       │
│  FK studentId → students.id (RESTRICT)    │
└──────────────┬───────────────────────────┘
               │ read path (separate from write path)
               ▼
┌─────────────────────────────────────────┐
│  Server Component (Dashboard page)        │
│  SELECT students LEFT JOIN sessions       │
│  GROUP BY student, FILTER (billed=false)  │
│  ORDER BY amountCents DESC, name ASC      │
└──────────────┬───────────────────────────┘
               ▼
        Rendered dashboard rows
        (expand → underlying sessions)
```

### Recommended Project Structure
```
app/
├── layout.tsx                # unchanged: html/body/fonts only, NO nav
├── login/page.tsx            # unchanged, outside the nav route group
└── (app)/                    # NEW route group — adds shared nav, no URL segment
    ├── layout.tsx             # NEW: renders <TopNav /> (Students/Dashboard/Sessions), then {children}
    ├── page.tsx               # MOVED from app/page.tsx — url stays "/"
    ├── archived/page.tsx      # MOVED from app/archived/page.tsx — url stays "/archived"
    ├── dashboard/page.tsx     # NEW — DASH-01/02
    └── sessions/page.tsx      # NEW — grouped-by-student session log (D-08)
lib/
├── db/schema.ts               # add `sessions` table
├── actions/sessions.ts        # NEW — mirrors lib/actions/students.ts exactly
└── validation/session.ts      # NEW — mirrors lib/validation/student.ts
components/
├── ui/combobox.tsx            # NEW via shadcn add
├── ui/select.tsx               # NEW via shadcn add
├── ui/popover.tsx / calendar.tsx  # NEW via shadcn add
├── student-combobox.tsx       # NEW — wraps ui/combobox.tsx with "Name — parent email" items
├── session-form-dialog.tsx    # NEW — clones student-form-dialog.tsx
├── session-delete-confirm-dialog.tsx  # NEW — clones archive-confirm-dialog.tsx
├── top-nav.tsx                # NEW — Students/Dashboard/Sessions links
└── session-table.tsx / dashboard-table.tsx  # NEW — reuse StudentTable's table→card responsive pattern + extracted formatRate/formatCents helper
```

### Pattern 1: Route group to scope the new nav (D-02)
**What:** Move every authenticated page into `app/(app)/`, add `app/(app)/layout.tsx` rendering the top nav, leave `app/login/page.tsx` and the root `app/layout.tsx` untouched.
**When to use:** Whenever a subset of routes needs shared chrome (nav) that other routes (login) must NOT have. Next.js route groups (`(name)`) don't affect the URL — `app/(app)/page.tsx` still serves `/`.
**Example:**
```tsx
// app/(app)/layout.tsx
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
`middleware.ts` is untouched — its matcher already excludes only `/login`, so it continues protecting every route regardless of the route-group restructure (route groups are a build-time/file-organization concept, invisible to the request path the middleware matcher operates on).

### Pattern 2: Student Combobox resolving to an id (D-04)
**What:** shadcn's Base UI-flavored `combobox` component, fed the active student list as typed objects, returning the full object on selection.
**When to use:** Any picker where duplicate display labels exist and the caller needs the underlying id, not just a string.
**Example:**
```tsx
// Source: https://ui.shadcn.com/docs/components/base/combobox (Base UI variant)
"use client";
import * as React from "react";
import {
  Combobox, ComboboxContent, ComboboxEmpty,
  ComboboxInput, ComboboxItem, ComboboxList,
} from "@/components/ui/combobox";

type StudentOption = { id: number; name: string; parentEmail: string };

export function StudentCombobox({
  students, value, onValueChange,
}: {
  students: StudentOption[];
  value: StudentOption | null;
  onValueChange: (s: StudentOption | null) => void;
}) {
  return (
    <Combobox
      items={students}
      itemToStringValue={(s) => `${s.name} — ${s.parentEmail}`}
      value={value}
      onValueChange={onValueChange}
    >
      <ComboboxInput placeholder="Search student…" />
      <ComboboxContent>
        <ComboboxEmpty>No students found.</ComboboxEmpty>
        <ComboboxList>
          {(s) => (
            <ComboboxItem key={s.id} value={s}>
              {s.name} — {s.parentEmail}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
```
The Server Action still needs a plain form value: render a hidden input synced to the selected id (`<input type="hidden" name="studentId" value={value?.id ?? ""} />`) so `useActionState`'s `formAction` sees it in `FormData`, exactly like the existing `edit` forms' hidden `id` input.

### Pattern 3: Popover/Calendar date picker (D-06), Base UI idiom
**What:** Composed date picker using this project's actual trigger idiom (`render` prop, matching the existing `Dialog`/`DialogTrigger` usage in `student-form-dialog.tsx`), NOT the generic Radix `asChild` example shown on shadcn's default (non-base) docs page.
**Example:**
```tsx
// Adapted from https://ui.shadcn.com/docs/components/date-picker,
// composed with the Base UI trigger idiom already used in this repo
// (components/ui/dialog.tsx / components/student-form-dialog.tsx use `render`, not `asChild`)
"use client";
import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function DatePickerField({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" type="button" />}>
        {format(value, "PPP")}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(d) => { if (d) { onChange(d); setOpen(false); } }}
        />
      </PopoverContent>
    </Popover>
  );
}
```
Defaults to today: `useState(() => new Date())` in the parent form. Submit as an ISO date string (`format(value, "yyyy-MM-dd")`) into a hidden input for the Server Action, matching the `date` column's `mode: "string"`.

### Pattern 4: Hours + minutes length input (D-05)
**What:** Two shadcn `Select` dropdowns whose values combine into total minutes before submission — never a raw decimal hours field.
**Example:**
```tsx
const HOUR_OPTIONS = Array.from({ length: 9 }, (_, i) => i); // 0-8 hrs, adjust as needed
const MINUTE_OPTIONS = [0, 15, 30, 45];

// Combine on submit / in the hidden input:
const totalMinutes = hours * 60 + minutes;
```
Validate server-side that `totalMinutes > 0` (a 0hr/0min session is meaningless) — zod: `z.number().int().positive()`.

### Pattern 5: Sessions schema — money & date as write-time snapshots
```ts
// lib/db/schema.ts additions
import { pgTable, serial, integer, varchar, boolean, timestamp, date, text } from "drizzle-orm/pg-core";

export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "restrict" }), // never cascade — archived students keep history; a hard delete should error loudly, not silently wipe sessions
  date: date("date", { mode: "string" }).notNull(), // mode "string": avoids TZ-shift entirely (see Pitfall 2)
  durationMinutes: integer("duration_minutes").notNull(), // e.g. 90 for "1hr 30min" — hours+minutes dropdowns combine into this single column
  amountCents: integer("amount_cents").notNull(), // computed server-side ONCE at write time: round(durationMinutes * rateCents / 60)
  notes: text("notes"), // optional (SESS-02)
  billed: boolean("billed").notNull().default(false), // Phase 3 sets this true; Phase 2 only reads it for DASH-02 exclusion
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```
[CITED: orm.drizzle.team/docs/column-types — `date` column `mode: "string"`; onDelete action list including `"restrict"`]

**Money math (SESS-05, no float drift):**
```ts
// In the Server Action, AFTER re-fetching the student's current rateCents from the DB:
const amountCents = Math.round((durationMinutes * student.rateCents) / 60);
```
Computed once with integer inputs and a single rounding step — matches Phase 1's `Math.round(dollars * 100)` precedent in `lib/actions/students.ts` (never accumulate float rounding across multiple operations).

**Migration workflow (mirrors Phase 1 exactly):**
```bash
npx drizzle-kit generate   # writes a new SQL file under ./drizzle
npx drizzle-kit push       # or `migrate`, per how Phase 1 applied schema — check drizzle/ for prior migration files to confirm which command Phase 1 used
```
STATE.md notes Phase 1 ran `drizzle-kit push` directly (no committed migration files were found under `./drizzle` in this repo at research time — confirm this in Wave 0 before assuming `generate`+`migrate` is the established flow; `push` was the one actually used).

### Pattern 6: Unbilled dashboard aggregate query (DASH-01/02, D-12)
```ts
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
  .where(eq(students.archived, false)) // D-12/D-13 in Phase 1: archived students never appear on the roster or dashboard
  .groupBy(students.id, students.name)
  .orderBy(desc(unbilledAmountExpr), asc(students.name)); // most-owed first, $0 students fall to the bottom, alphabetical tiebreak
```
[CITED pattern, MEDIUM confidence: drizzle-team docs/discussions confirm `sum()`/`sql` aggregate + `groupBy`, and reusing the same `sql` expression object in both `select` and `orderBy` is the documented way to order by a computed aggregate — **verify exact TypeScript inference/alias behavior when writing this code; Drizzle's aggregate-ordering ergonomics have had discussion-thread nuance across versions** (github.com/drizzle-team/drizzle-orm/discussions/3984).]

Key details:
- `LEFT JOIN` (not `INNER JOIN`) is what makes $0-owed students still appear (D-12) — an `INNER JOIN` would drop any student with zero sessions.
- `FILTER (WHERE billed = false)` inside the aggregate — not a `WHERE` clause on the whole query — is what lets billed sessions be excluded from the *sum* while still allowing the student row itself to appear (a `WHERE sessions.billed = false` clause would incorrectly filter out students whose only sessions are billed, hiding them from the roster-like dashboard view entirely).
- `coalesce(..., 0)` converts SQL `NULL` (no matching sessions at all) into `0`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Filterable picker resolving to an object/id | Custom `<input>` + manual `.filter()` dropdown | shadcn `combobox` (Base UI) | Keyboard nav, focus trapping, empty state, and object-value semantics are already solved and match this project's existing component idiom |
| Date picker UI | Custom calendar grid | shadcn `calendar` + `popover` (react-day-picker under the hood) | Accessible, keyboard-navigable, well-maintained (11-year-old, slopcheck-clean) — reinventing this is pure risk for zero benefit |
| Per-student unbilled totals | Fetch all sessions client/server-side and `.reduce()` in JS | SQL `GROUP BY` + `FILTER` aggregate | Scales correctly even if session volume grows; avoids shipping every raw session row just to sum a handful of numbers; keeps the money math in one place |
| Money formatting | New formatting helper duplicated per component | Extract `formatRate` from `components/student-table.tsx` into a shared `lib/format.ts` (e.g. `formatCents(cents: number)`) | Phase 1 already established `$X.XX` formatting; duplicating the same one-liner in 3 new components (session table, dashboard, session form) is a maintenance smell CONTEXT.md's "Claude's Discretion" section explicitly calls out |

**Key insight:** Every "don't hand-roll" item here already has a working, verified precedent living in this exact codebase (Phase 1) or is a purpose-built shadcn component matching this project's declared style. There is no unexplored technology risk in this phase — the risk is entirely in getting the money/date/aggregation *semantics* right, not the libraries.

## Common Pitfalls

### Pitfall 1: Trusting a client-submitted rate or amount
**What goes wrong:** A hidden form field carrying `rateCents` or a pre-computed `amountCents` from the client can be tampered with via devtools before submit.
**Why it happens:** It's tempting to pass the rate through the form since the client already has it (e.g., displayed for a live preview).
**How to avoid:** The Server Action must independently `db.select().from(students).where(eq(students.id, studentId))` to read the *authoritative* `rateCents`, then compute `amountCents` server-side. Only `studentId`, `date`, `durationMinutes`, and `notes` should be trusted from client input.
**Warning signs:** Any Server Action that reads `formData.get("amountCents")` or `formData.get("rateCents")` directly.

### Pitfall 2: Timezone shift on session dates
**What goes wrong:** Storing the session date as a `timestamp` (not `date`) column, or constructing a JS `Date` from a date-only string without pinning to UTC/local consistently, causes the stored date to silently shift by a day depending on server/client timezone (a session logged "for July 3" becomes "July 2" in the DB).
**Why it happens:** `new Date("2026-07-03")` parses as UTC midnight, which can render as the *previous* day in a negative-UTC-offset browser timezone; conversely `new Date(2026, 6, 3)` is local-time midnight and shifts the other way when serialized to UTC for storage.
**How to avoid:** Use Drizzle's `date` column type with `mode: "string"` — store and retrieve `"YYYY-MM-DD"` as a plain string, never round-tripping through a JS `Date` object for the *stored* value. Only convert to a `Date` object transiently for the Calendar UI component, and format back to `"yyyy-MM-dd"` (via `date-fns` `format()`) immediately before submission.
**Warning signs:** A session logged as "today" showing as "yesterday" after a page reload, especially for users in negative UTC-offset timezones (e.g., US timezones) — this is the textbook symptom.

### Pitfall 3: Cascade-deleting sessions when a student is archived
**What goes wrong:** If the `sessions.studentId` FK is declared with `onDelete: "cascade"`, and any future code path ever issues a hard `DELETE FROM students` (even accidentally, e.g. during manual DB cleanup or a future admin feature), every session for that student silently vanishes — destroying billing history.
**Why it happens:** `cascade` is the FK action most examples default to; it's easy to copy-paste without considering this app's specific "students are archived, never truly deleted" invariant (Phase 1 D-10).
**How to avoid:** Declare `onDelete: "restrict"` (or `"no action"`) on the FK. Since Phase 1's `archiveStudentAction` only ever `UPDATE`s the `archived` flag and the codebase's Anti-Pattern comment explicitly forbids a hard DELETE on students, `restrict` should never actually fire in normal operation — its only job is to turn an accidental hard-delete attempt into a loud DB error instead of silent data loss.
**Warning signs:** Any migration or ad-hoc script containing `DELETE FROM students`.

### Pitfall 4: `INNER JOIN` (or a `WHERE` on the joined table) silently hiding $0 or billed-only students from the dashboard
**What goes wrong:** Using an `INNER JOIN` between `students` and `sessions`, or adding `WHERE sessions.billed = false` instead of an aggregate `FILTER`, drops students with zero sessions or students whose only sessions are billed — violating D-12 ("show ALL active students").
**Why it happens:** `INNER JOIN` + plain `WHERE` is the more commonly-seen SQL pattern in tutorials; the `LEFT JOIN` + `FILTER`-in-aggregate combination needed here is less commonly demonstrated.
**How to avoid:** Follow Pattern 6 exactly — `LEFT JOIN`, no `WHERE` on `sessions.billed`, `FILTER (WHERE billed = false)` inside each `sum()`.
**Warning signs:** A newly-added student with no sessions yet is missing from the dashboard entirely (should show $0), or a student whose only sessions are already billed (post-Phase-3) disappears instead of showing $0.

### Pitfall 5: Forgetting `revalidatePath` on the new routes
**What goes wrong:** After Phase 1's precedent (`revalidatePath("/")` + `revalidatePath("/archived")` on every student mutation), it's easy to forget that session mutations now need to revalidate `/dashboard` and `/sessions` (and potentially `/` if any dashboard-style summary is ever surfaced there) — stale totals persist until a hard refresh.
**Why it happens:** Copy-pasting `lib/actions/students.ts` verbatim without updating the revalidated paths for the new routes this phase introduces.
**How to avoid:** Every session Server Action (add/edit/delete) must call `revalidatePath("/dashboard")` and `revalidatePath("/sessions")` after the DB write.
**Warning signs:** Logging a session and the Dashboard still shows the old total until manually reloaded.

### Pitfall 6: Adding the top nav to the root `layout.tsx` (leaks onto `/login`)
**What goes wrong:** `app/layout.tsx` wraps every route in the app, including `/login`. Adding `<TopNav />` there directly would show "Students / Dashboard / Sessions" navigation on the unauthenticated login screen — a jarring, semantically wrong UX (and briefly reveals the app's internal structure pre-auth).
**Why it happens:** It's the most obvious place to add "a nav for the whole app" without first checking which routes should be excluded.
**How to avoid:** Use the route-group restructure in Pattern 1 — nav lives in `app/(app)/layout.tsx`, not the root `app/layout.tsx`; `app/login/page.tsx` stays outside that group.
**Warning signs:** Visiting `/login` (e.g. after a session expires) and seeing the top nav rendered above the password box.

## Code Examples

See Architecture Patterns section above (Patterns 2–6) for verified, adapted code covering: the Combobox student picker, the Popover/Calendar date picker, the hours+minutes Select pair, the `sessions` schema, and the dashboard aggregate query.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| shadcn components built on Radix UI (`asChild` composition) | shadcn components built on Base UI (`render` prop composition) | This project's `components.json` was initialized with `style: "base-nova"` (shadcn CLI 4.x's registry-based style system) | Every new shadcn component added in this phase (`combobox`, `select`, `popover`, `calendar`) will use the `render` prop, matching this repo's existing `Dialog`/`DialogTrigger` usage — do NOT copy-paste `asChild`-based examples from generic shadcn tutorials/blog posts, which usually show the older Radix variant |
| Manually composing `Command` + `Popover` for an autocomplete/combobox | Dedicated `combobox` component (Base UI's native Combobox primitive) | Base UI shipped a first-class Combobox component; shadcn's registry now offers it directly | Simpler code, built-in object-value semantics (no need to map string ↔ id manually) |

**Deprecated/outdated:** None specific to this phase beyond the Radix→Base UI style distinction above — this is a fast-evolving corner of the shadcn ecosystem (Base UI itself is young, v1.6.0), so re-verify component APIs against the live `ui.shadcn.com/docs/components/base/*` pages at implementation time rather than trusting older cached knowledge.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Session `amountCents` is a write-time snapshot (computed once at log/edit time using the student's rate *at that moment*), NOT live-derived from the student's *current* rate on every read | Standard Stack (Alternatives Considered), Architecture Pattern 5 | If the user actually expects a student's rate change to retroactively update all their past unbilled session amounts, this schema/query design is wrong and would need `amountCents` derived live instead of stored — a real rework, not a tweak. CONTEXT.md and REQUIREMENTS.md do not explicitly settle this; confirm with the user before planning locks it in. |
| A2 | `sessions.studentId` FK uses `onDelete: "restrict"` (error loudly on an accidental hard delete) rather than `"no action"` (functionally near-identical in Postgres, deferred-check semantics differ slightly) | Architecture Pattern 5, Pitfall 3 | Low risk — both options prevent silent cascade data loss; `restrict` vs `no action` differ only in constraint-check timing, immaterial at this app's scale. Flagged for completeness, not because it's likely to be wrong. |
| A3 | Drizzle migration workflow for this phase should follow whatever Phase 1 actually used (`push` vs `generate`+`migrate`) — this research could not find committed migration SQL files under `./drizzle` at research time to confirm which was used | Architecture Pattern 5 (Migration workflow) | Low risk — easily confirmed in Wave 0 by checking `./drizzle` directory and STATE.md's Phase 1 notes before writing the schema migration task. |

**If this table is empty:** N/A — see above; A1 is the one item genuinely worth a user confirmation pass before/during planning.

## Open Questions

1. **Does the tutor expect a student rate change to retroactively affect already-logged, unbilled session amounts?**
   - What we know: CONTEXT.md D-05 says "Amount = hours × students.rateCents, computed in integer cents" but doesn't specify *when* that computation happens relative to a later rate edit.
   - What's unclear: Whether Phase 2 needs a live-derived amount (query-time `durationMinutes * rateCents / 60`) instead of the snapshot-at-write-time design recommended here.
   - Recommendation: Recommend the snapshot design (Assumptions Log A1) to the user during planning/discuss-phase for an explicit yes/no; it's a one-line schema/query difference either way, so resolving it before Wave 1 avoids a rework.

2. **Should the Sessions tab (D-08, grouped-by-student) also render archived students' historical sessions?**
   - What we know: CONTEXT.md's Integration Points note says archived-student sessions should be "surfaced with an archived marker rather than hiding history," but D-12 explicitly excludes archived students from the *Dashboard*.
   - What's unclear: Whether the Sessions tab's student grouping includes archived students (with a marker) by default, or only on request (e.g. an "include archived" toggle).
   - Recommendation: Default to including archived students' groups on the Sessions tab (with a small "Archived" badge next to their name), consistent with the "history preserved" intent — this is Claude's Discretion per CONTEXT.md, so the planner can decide without a user round-trip, but should note the choice explicitly in the plan.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Local dev/build | ✓ | v25.1.0 (local machine; project requires ≥20.9 per CLAUDE.md) | — |
| Neon Postgres (`.env.local` `DATABASE_URL`) | `sessions` table migration + all queries | ✓ | `.env.local` present (not read for secrets) | — |
| shadcn CLI | Adding `combobox`/`select`/`popover`/`calendar` components | ✓ | 4.13.0 (`npx shadcn@latest`) | — |
| `slopcheck` (package legitimacy tool) | Package Legitimacy Audit | ✓ | installed via pip during this research session | — |

**Missing dependencies with no fallback:** none
**Missing dependencies with fallback:** none

## Validation Architecture

> `.planning/config.json` has `workflow.nyquist_validation: false` — this section is intentionally omitted per the skip condition in the research protocol.

## Security Domain

`security_enforcement` is enabled (`security_asvs_level: 1`) in `.planning/config.json`; assessed below.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No (new to this phase) | Already covered by Phase 1's `iron-session` + `middleware.ts` gate, which continues to protect every new route added here (route-group restructure does not change the middleware matcher) |
| V3 Session Management | No (new to this phase) | Same as above — no new session logic in Phase 2 |
| V4 Access Control | Yes (implicitly) | Single shared-password model means there is no per-record ownership check to add — every session belongs to "the one user." Continue relying on the existing middleware choke point; no new access-control logic needed |
| V5 Input Validation | Yes | zod `safeParse` at every new Server Action boundary (`studentId` coerced positive int + must resolve to an existing, non-archived student; `date` via `z.iso.date()`; `durationMinutes` positive int; `notes` optional string with a sane max length) — mirrors Phase 1's `lib/validation/student.ts` pattern exactly |
| V6 Cryptography | No | No new crypto surface in this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Client-tampered money/rate fields (Pitfall 1) | Tampering | Server Action re-fetches `rateCents` from the DB; never trusts a client-submitted rate or amount |
| Logging a session against another (nonexistent or archived) `studentId` via a crafted hidden-input value | Tampering / Elevation of privilege (data-integrity variant) | Server Action must verify the submitted `studentId` resolves to an existing, `archived = false` (or explicitly allowed archived) student row before insert — return a field error otherwise, mirroring how `editStudentAction` validates `id` |
| SQL injection via raw `sql` template aggregate expressions (Pattern 6) | Tampering | Drizzle's `` sql`...` `` tagged template with `${column}` interpolation is parameterized, not string-concatenated — safe by construction as long as only Drizzle column/schema references (not raw user input) are interpolated into the template, which is the case in the recommended query |

## Sources

### Primary (HIGH confidence)
- Live codebase reads: `lib/db/schema.ts`, `lib/actions/students.ts`, `lib/validation/student.ts`, `components/student-table.tsx`, `components/student-form-dialog.tsx`, `components/archive-confirm-dialog.tsx`, `app/layout.tsx`, `app/page.tsx`, `app/archived/page.tsx`, `middleware.ts`, `lib/session.ts`, `package.json`, `components.json`, `drizzle.config.ts` — all read directly in this research session (HIGH confidence, ground truth for cloning patterns)
- `npm view` on `react-day-picker`, `@base-ui/react`, `drizzle-orm`, `date-fns` — live registry data, checked 2026-07-03
- `slopcheck scan --pkg npm react-day-picker` / `@base-ui/react` — both returned `OK`, no flags

### Secondary (MEDIUM confidence)
- [ui.shadcn.com/docs/components/base/combobox](https://ui.shadcn.com/docs/components/base/combobox) — Combobox API shape, `itemToStringValue`, install command
- [ui.shadcn.com/docs/components/base/select](https://ui.shadcn.com/docs/components/base/select) — Select subcomponent API
- [ui.shadcn.com/docs/components/base/popover](https://ui.shadcn.com/docs/components/base/popover) — confirms `render` prop trigger idiom, matching this repo's existing `Dialog` usage
- [ui.shadcn.com/docs/components/base/calendar](https://ui.shadcn.com/docs/components/base/calendar) — Calendar built on react-day-picker, native `Date` objects
- [ui.shadcn.com/docs/components/date-picker](https://ui.shadcn.com/docs/components/date-picker) — canonical Popover+Calendar+date-fns composition pattern (adapted to this repo's `render`-prop idiom in Pattern 3)
- [ui.shadcn.com/docs/components/base/command](https://ui.shadcn.com/docs/components/base/command) — confirms a standalone Command component also exists (built on `cmdk`), not needed for this phase's use case
- [orm.drizzle.team/docs/column-types](https://orm.drizzle.team/docs/column-types) — `date` column `mode: "string"` vs `"date"`
- Drizzle FK `onDelete` actions (`cascade`/`restrict`/`no action`/`set null`/`set default`) — cross-referenced across drizzle-team docs and community Q&A (answeroverflow.com, github discussions)
- Drizzle `sum()`/aggregate + `groupBy` pattern, and reusing an `sql` expression object across `select`/`orderBy` — cross-referenced across drizzle-team docs and github.com/drizzle-team/drizzle-orm/discussions/3984 (explicitly flagged as having version-to-version nuance; verify at implementation time)
- [zod.dev/api](https://zod.dev/api) — `z.iso.date()` behavior

### Tertiary (LOW confidence)
- None — all findings above were cross-verified against either the live codebase, npm registry, or official docs.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library is already installed and version-pinned in this exact repo; no new dependency decisions
- Architecture: HIGH — patterns directly extend Phase 1's live, working code; route-group nav restructure is standard Next.js App Router mechanics
- Pitfalls: HIGH — money/date/cascade pitfalls are well-documented, general-purpose backend correctness issues, not speculative; the aggregate-query ordering nuance (Pattern 6) is the one MEDIUM-confidence implementation detail, explicitly flagged for verification at write time

**Research date:** 2026-07-03
**Valid until:** ~30 days (stable stack; Base UI/shadcn's Base UI style is the fastest-moving piece and worth re-checking if implementation is delayed)
