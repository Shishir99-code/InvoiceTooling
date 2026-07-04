# Phase 2: Session Logging & Unbilled Dashboard - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-03
**Phase:** 2-session-logging-unbilled-dashboard
**Areas discussed:** Landing & navigation, Logging a session, Finding & editing sessions, Dashboard content

---

## Landing & Navigation

### Product-direction detour (scheduling + Zoom)
When asked what to land on, the user initially answered "a list of all students
with their upcoming classes" and expanded to wanting a **scheduling system** and
**Zoom link generation for the week for all students**, plus a mention of "new
students," and asked for a recommendation.

Assessment given: both are real and valuable but out of scope for Phase 2 and the
v1 billing milestone; scheduling is a whole product pillar that changes the data
model, and Zoom generation needs the Zoom API (external integration v1 avoided).
Recommended deferring to a v2 milestone.

| Option | Description | Selected |
|--------|-------------|----------|
| Defer to v2, keep Phase 2 billing | Note scheduling + Zoom as v2; Phase 2 stays log→who-owes | ✓ |
| Pivot now to scheduling | Stop and reshape the roadmap around scheduling | |
| Talk it through more | Explore tradeoffs / lighter middle-ground first | |

**User's choice:** Defer to v2, keep Phase 2 billing.

### Home screen

| Option | Description | Selected |
|--------|-------------|----------|
| Dashboard = student list | Home is per-student who-owes-what list | |
| Sessions log as home | Home is chronological sessions log | |
| Keep plain roster as home | Phase 1 roster stays at `/` | ✓ |

**User's choice:** Keep plain roster as home.

### Nav structure

| Option | Description | Selected |
|--------|-------------|----------|
| Students / Dashboard / Sessions | 3-item top nav, Archived nested under Students | ✓ |
| Students / Dashboard only | Sessions reached via student drill-down only | |
| Students / Dashboard / Sessions / Archived | All four flat, incl. Archived | |

**User's choice:** Top nav — Students / Dashboard / Sessions (Archived as sub-view).

---

## Logging a Session

### Entry experience

| Option | Description | Selected |
|--------|-------------|----------|
| Modal dialog (like adding a student) | Pop-up form, consistent with Phase 1 | ✓ |
| Dedicated 'Log Sessions' page | Full page for rapid multi-entry | |
| Quick inline row | Always-visible one-line entry | |

**User's choice:** Modal dialog.

### Autocomplete disambiguation

| Option | Description | Selected |
|--------|-------------|----------|
| Name + parent email | Unique + always present, reliable disambiguator | ✓ |
| Name + hourly rate | Can still be ambiguous for same-rate students | |
| Name + rate + parent email | Most disambiguating, busier on mobile | |

**User's choice:** Name + parent email.

### Length input

| Option | Description | Selected |
|--------|-------------|----------|
| Decimal hours (1.5) | Type hours as a decimal | |
| Hours + minutes dropdown | Pick hours and minutes separately | ✓ |
| Quick preset buttons | One-tap common lengths + custom | |

**User's choice:** Hours + minutes dropdown (converts to decimal for money math).

### Date default

| Option | Description | Selected |
|--------|-------------|----------|
| Today, editable | Pre-fill today, changeable | ✓ |
| Empty, you always pick | No default | |
| Remember last-used date | Default to previous entry's date | |

**User's choice:** Today, editable.

---

## Finding & Editing Sessions

### Sessions organization

| Option | Description | Selected |
|--------|-------------|----------|
| Flat list, newest first | Chronological across all students | |
| Grouped by student | Sessions under each student | ✓ |
| Grouped by week/date | Bucketed by week/day | |

**User's choice:** Grouped by student.

### Delete behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Quick confirm, then hard delete | Small confirm, then gone; totals recompute | ✓ |
| Delete with undo toast | Immediate delete + undo toast | |
| Soft-archive like students | Hide but keep row | |

**User's choice:** Quick confirm, then hard delete.

---

## Dashboard Content

### Detail level

| Option | Description | Selected |
|--------|-------------|----------|
| Totals, expandable to sessions | Per-student totals, expand for line items | ✓ |
| Totals only | No breakdown | |
| Always-expanded line items | All sessions inline | |

**User's choice:** Totals, expandable to sessions.

### Who shows / ordering

| Option | Description | Selected |
|--------|-------------|----------|
| Only students who owe, most-owed first | Debtors only, by amount | |
| All students, most-owed first | Full active roster, $0 at bottom | ✓ |
| Only students who owe, alphabetical | Debtors only, A–Z | |

**User's choice:** All active students, most-owed first ($0 at bottom).

---

## Claude's Discretion

- Minutes granularity in the length dropdown (15-min steps suggested).
- Reuse/extraction of the `$X.XX` money formatter for amounts owed.
- Expand/collapse affordance on the Dashboard and grouped-by-student layout on
  the Sessions tab (accordion vs. section headers).
- Whether session editing is reachable from the Dashboard expansion as well as
  the Sessions tab.
- Empty-state copy, following the Phase 1 friendly-empty-state pattern.

## Deferred Ideas

- **Scheduling system** (upcoming/recurring classes, calendar) → v2 milestone,
  including the "completed scheduled class → billable session" synergy and the
  session data-model shift it implies.
- **Zoom link generation** per week/student → v2 (Zoom API); evaluate reusable
  Personal Meeting ID as a zero-integration alternative first.
- **New-student onboarding into scheduling** → v2 (meaning to be clarified).
