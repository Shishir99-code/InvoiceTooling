---
phase: 5
slug: recurring-class-schedules-auto-logged-sessions
status: approved
shadcn_initialized: true
preset: none
created: 2026-07-06
---

# Phase 5 — UI Design Contract

> Visual and interaction contract for the recurring-schedule + auto-logged-session surfaces.
> This phase adds a **per-student Weekly Schedule** manager and an **auto-logged marker** on
> sessions. Both surfaces reuse the design system established in Phases 1–4 verbatim — no new
> tokens, colors, fonts, or third-party registries are introduced.

**Scope of this contract (3 new/changed surfaces):**
1. **Weekly Schedule dialog** (per student) — list slots, add, edit, remove (D-01).
2. **Slot form dialog** (add/edit a slot) — weekday + start time + hrs/min duration (D-02).
3. **Auto-logged marker** on session rows/cards in the Sessions tab and Dashboard expansion (D-03).

Out of scope: any forward calendar/agenda grid (deferred), the cron job itself (backend), and
changes to how manual sessions/dashboard/invoicing render (reused unchanged).

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn/ui (components copied into `components/ui/`, already initialized) |
| Preset | none (project uses the shadcn default neutral base with a blue-600 CTA accent) |
| Component library | base-ui (shadcn's base-ui build — `DialogTrigger`/`DialogClose` use the `render` prop, `Select` uses render-prop `SelectValue`) |
| Icon library | `lucide-react` (already a dependency; `ChevronDown` in use) |
| Font | `--font-sans` (Geist Sans via `app/layout.tsx`), mono `--font-geist-mono` |

**Reused components (do NOT rebuild):** `Dialog`, `Button`, `Label`, `Select`, `Input`,
`Table`. New surfaces clone the **exact** structure of `components/session-form-dialog.tsx`
(useActionState + "close only on a real success" render-time reconciliation, `noValidate`).

---

## Spacing Scale

Declared values (Tailwind default 4px scale — the only scale used in this codebase):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px (`gap-1`) | Icon-to-text gaps on the marker |
| sm | 8px (`gap-2`) | Compact element spacing, inline action-button groups |
| md | 12px (`gap-3`) | Stacked card gaps, slot-list row gaps |
| md+ | 16px (`gap-4`, `p-4`) | Default form field spacing, dialog/card padding |
| lg | 24px (`mb-6`) | Section header → content spacing |
| xl | 32px (`py-8`) | Page vertical padding |
| 2xl | 48px+ (`py-12`, `py-16`) | Page padding (sm+), empty-state vertical block |

Exceptions:
- **`min-h-11` (44px)** minimum tap target on interactive rows (accordion trigger, slot rows) —
  the established mobile-accessibility exception already used in `session-table.tsx`.
- Marker icon sizing `size-4` (16px) / `size-3.5` (14px on mobile) — icon dimension, not a gap.

---

## Typography

Matches the values already shipped (no new roles):

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Page title | 28px (`text-[28px]`) | 600 (`font-semibold`) | tight (`leading-tight`) |
| Dialog title | 18px (`text-lg`, from `DialogTitle`) | 600 (`font-semibold`) | default |
| Empty-state heading | 20px (`text-xl`) | 600 (`font-semibold`) | tight |
| Body / value | 16px (`text-base`) | 400 (`font-normal`) | default |
| Row primary (name/date) | 16px (`text-base`) | 500 (`font-medium`) | default |
| Label / helper / error | 14px (`text-sm`) | 400 | default |

Helper text color `text-zinc-600`; error text `text-red-600` — both already conventions.

---

## Color

Neutral grayscale (oklch, defined in `app/globals.css`) + a single blue CTA accent + red for
errors/destructive. **No new color is introduced by this phase.**

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `--background` white / zinc-950 dark; surfaces `bg-white` | Page + card/dialog backgrounds |
| Secondary (30%) | `zinc-200` borders, `zinc-600` secondary text, `zinc-900` primary text | Borders, meta text, headings |
| Accent (10%) | `blue-600` (`hover:blue-700`) | Primary CTA buttons only ("Add slot", "Save", "Log Session") + active tab underline |
| Destructive | `red-600` | Field-error text and the "Remove"/delete confirmation action only |
| Marker (muted) | `text-zinc-400` (icon), `text-zinc-500` on hover | Auto-logged icon glyph — deliberately low-emphasis, NOT accent |

Accent reserved for: **primary submit CTAs and the active nav/tab indicator only.** The
auto-logged marker MUST NOT use blue or any saturated color — it is a muted zinc glyph so it
reads as metadata, not a status the user must act on (D-03: "compact and unobtrusive").

---

## Surfaces (Interaction Contracts)

### Surface 1 — Weekly Schedule dialog (D-01)

**Entry point:** a new per-student **"Schedule"** action button on the Students roster, placed
in the existing `renderActions` group alongside Edit / Zoom / Archive (`variant="outline"`,
`size="sm"`, same button as Edit). Rationale: the app has no per-student detail page — the roster
is a flat table — so a per-student dialog is the consistent home for "attached to each student"
(D-01) without inventing a new route or cramming into the add/edit-student modal.

**Layout (inside `DialogContent`):**
- `DialogTitle`: `{Student name} — Weekly schedule`
- A vertical list (`flex flex-col gap-3`) of the student's slots, each row showing:
  `{Weekday}, {start time}–{end time} · {duration}` (e.g. `Mondays, 3:30–4:30 PM · 1 hr`).
  End time is **derived** for display (start + durationMinutes), never entered (D-02).
  Each row is `min-h-11`, has an **Edit** (`outline`/`sm`) and **Remove** (`outline`/`sm`,
  destructive-on-confirm) control on the right, mirroring the session-table row action group.
- Below the list: a full-width or left-aligned **"Add slot"** primary CTA
  (`bg-blue-600 text-white hover:bg-blue-700`).
- **Empty state** (no slots yet): centered short block —
  heading `No weekly classes yet`, body `Add a recurring slot and sessions log themselves each week.`,
  and the "Add slot" CTA. Uses the same `py-8`/centered treatment as other empty states (scaled
  down for a dialog, not the full `py-16`).

**States:** loading is not applicable (server-rendered slot list passed in); after add/edit/remove,
the list reflects the change via `revalidatePath` on the student view. Remove requires a confirm
(see Copywriting) so a mis-tap doesn't silently drop a recurring class.

### Surface 2 — Slot form dialog (add / edit) (D-02)

Clones `components/session-form-dialog.tsx` structurally (a new `schedule-slot-form-dialog.tsx`):
`useActionState`, `noValidate`, close-only-on-real-success, `variant="add" | "edit"`.

**Fields (top to bottom, `flex flex-col gap-4`):**
1. **Weekday** — `Label` "Day" + a `Select` of `Monday … Sunday` (single value). Stored as an
   integer weekday internally (planner's discretion 0–6 or 1–7 — UI shows full weekday names).
2. **Start time** — `Label` "Start time" + a native `<input type="time" step="900">` styled with
   the `Input` component classes (15-min steps; native picker is accessible + mobile-friendly and
   avoids a heavy triple-select). Displays/stores local wall-clock time (e.g. `15:30`); the tutor's
   `settings.timezone` resolves it to a real instant server-side — the input is TZ-naive by design.
3. **Length** — `Label` "Length" + the **exact** two-`Select` hrs (0–8) + minutes (0/15/30/45)
   control lifted from the session form, combined into a hidden `durationMinutes` (D-02, reuses the
   Phase-2 pattern verbatim — do NOT introduce a decimal-hours field).

**Footer:** `Discard` (`variant="outline"`, `DialogClose`) + primary CTA `Add slot` / `Save changes`
(`bg-blue-600`), with pending labels `Adding…` / `Saving…`. Field errors render as `text-sm
text-red-600` under each field, driven by the server action's zod `fieldErrors` (server-side zod is
the sole source of truth — same as every other form).

**No "start date" field in the UI:** D-08 sets a slot's effective start = its creation date
automatically; an optional explicit start/end date is deferred and NOT surfaced in v1.

### Surface 3 — Auto-logged marker (D-03)

A small muted glyph marking sessions the cron created, shown **everywhere a session appears**:
the Sessions tab (`session-table.tsx`, both the md+ table and the mobile card) and the Dashboard
per-student expansion (`dashboard-table.tsx`).

- **Glyph:** lucide **`Repeat`** icon, `size-4` (md+) / `size-3.5` (mobile), `text-zinc-400`.
- **Placement:** immediately left of the session **Date** value, in a `flex items-center gap-1`
  wrapper, so it reads as a property of that row. It occupies the leading edge without shifting the
  existing columns' meaning.
- **Only auto-logged rows** render it; manual sessions render nothing (no placeholder box) — the
  presence/absence IS the distinction (no text badge, D-03).
- **Accessibility:** the icon carries `aria-label="Auto-logged from weekly schedule"` and a native
  `title` attribute of the same text (no shadcn Tooltip component is installed — the native
  `title` tooltip is the zero-dependency accessible choice and matches the app's current tooltip
  strategy). Decorative-only usage is NOT acceptable here since the marker conveys meaning.
- Auto-logged sessions remain **fully editable/deletable** through the identical
  `SessionFormDialog` / `SessionDeleteConfirmDialog` controls — the marker changes nothing about
  the row's affordances (SCHED-04).

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Roster action button (per student) | `Schedule` |
| Schedule dialog title | `{Name} — Weekly schedule` |
| Schedule empty-state heading | `No weekly classes yet` |
| Schedule empty-state body | `Add a recurring slot and sessions log themselves each week.` |
| Add-slot CTA | `Add slot` |
| Slot dialog title (add) | `Add weekly slot` |
| Slot dialog title (edit) | `Edit weekly slot` |
| Slot field labels | `Day` · `Start time` · `Length` |
| Slot primary CTA (add / edit) | `Add slot` / `Save changes` (pending: `Adding…` / `Saving…`) |
| Slot row display format | `Mondays, 3:30–4:30 PM · 1 hr` (weekday pluralized, en-dash time range, derived end) |
| Remove-slot control | `Remove` |
| Remove-slot confirmation | `Remove this weekly slot?`: `Sessions already logged from it stay. Only future auto-logging stops.` — confirm button `Remove` (red-600), cancel `Keep slot` |
| Slot field error (start time) | `Enter a start time.` |
| Slot field error (length) | `Length must be at least 15 minutes.` |
| Auto-logged marker tooltip / aria-label | `Auto-logged from weekly schedule` |

**Tone:** matches existing terse, reassuring microcopy (cf. `Notes appear on invoices sent to
parents.`). The remove confirmation explicitly reassures that history is preserved (D-06) — this is
the emotional core of the feature (a cancelled class must stay gone; a removed slot must not erase
billing history).

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | `dialog`, `button`, `label`, `select`, `input`, `table` (all already in `components/ui/`) | not required |
| third-party | none | n/a — this phase adds **no** new registry components |
| lucide-react | `Repeat` icon (new usage of an existing dependency) | not required |

No `npx shadcn add` of any third-party/registry block is needed. Native HTML `<input type="time">`
is used for the start-time control (no new component).

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-07-06
