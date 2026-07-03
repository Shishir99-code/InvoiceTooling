# Architecture Research

**Domain:** Single-user tutoring time-tracking + invoicing web app (small CRUD app with a billing lifecycle)
**Researched:** 2026-07-03
**Confidence:** HIGH (component/data-model design is standard small-business-app pattern; verified against invoice-snapshot conventions and Next.js-style shared-password-gate patterns)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Client (Browser)                            │
│  Dashboard │ Students │ Sessions │ Invoice History │ Settings         │
└───────────────────────────────┬───────────────────────────────────────┘
                                 │ (HTTP, session cookie)
┌────────────────────────────────▼──────────────────────────────────────┐
│                            Auth Gate                                  │
│   Single shared password → signed session cookie. Wraps every route   │
│   except /login. No user table, no per-account authorization.         │
├─────────────────────────────────────────────────────────────────────┤
│                        Application / Service Layer                    │
│  ┌────────────┐ ┌────────────┐ ┌────────────────┐ ┌────────────────┐ │
│  │ Students    │ │ Sessions   │ │ Invoice         │ │ Settings       │ │
│  │ CRUD        │ │ CRUD +     │ │ Generation      │ │ CRUD           │ │
│  │             │ │ unbilled   │ │ (snapshot +     │ │ (singleton     │ │
│  │             │ │ totals     │ │  transition)    │ │  row)          │ │
│  └─────┬───────┘ └─────┬──────┘ └────────┬────────┘ └───────┬────────┘ │
│        │               │                 │                  │         │
│        └───────────────┴──────┬──────────┴──────────────────┘         │
│                                │                                       │
│                    ┌───────────▼────────────┐                         │
│                    │ Email Draft Builder     │                        │
│                    │ (pure fn: invoice +     │                        │
│                    │  settings → mailto:)    │                        │
│                    └─────────────────────────┘                        │
├─────────────────────────────────────────────────────────────────────┤
│                             Data Layer                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ students │  │ sessions │  │ invoices │  │ settings │              │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘              │
│                    Relational DB (single deployment)                  │
└─────────────────────────────────────────────────────────────────────┘
```

This is a small monolith. There is no reason to split this into services — one deployable app, one database, server-rendered pages (or a thin API + SPA, either works). The interesting design problem isn't scale, it's the **billed/unbilled lifecycle and snapshot integrity**, so that's where this document spends most of its weight.

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Auth Gate | Verify shared password once, issue a signed/encrypted session cookie, reject all requests without it | Server middleware comparing a submitted password against an env-var secret (hashed), setting an httpOnly signed cookie (e.g. iron-session-style sealed cookie). No user table. |
| Data Layer | Own the schema, migrations, and typed query/write functions for all four entities | ORM (Prisma/Drizzle) or lightweight query builder over a relational DB (Postgres or SQLite) |
| Students CRUD | Create/edit/archive students; supply autocomplete list to Sessions | Simple form + list page; server action or REST/RPC endpoint per operation |
| Sessions CRUD | Create/edit/delete sessions; compute per-session and per-student live amounts (hours × current rate) | Form with student autocomplete, date, hours, notes; list view recomputes on every read (no stored amount) |
| Dashboard | Aggregate unbilled hours/amount per student | Query: `SUM(hours * student.hourlyRate)` grouped by student, filtered to `invoiceId IS NULL` |
| Invoice Generation | Atomically snapshot a student's unbilled sessions into an Invoice and flip those sessions to billed | Single DB transaction: read unbilled sessions → build line-item snapshot + render text summary from current Settings → insert Invoice → update Session rows' `invoiceId` |
| Invoice History | List and display past invoices exactly as generated (read-only) | Simple list/detail page reading the frozen `invoices` table; no recomputation |
| Email Draft Builder | Turn an invoice's frozen text summary + parent email into a client-side compose action | Pure function producing a `mailto:` URI (or Gmail compose URL) opened via `window.location` / `<a href>` — no server email involved |
| Settings | Store the single Zelle handle + editable message template used at invoice-generation time | Singleton row (`id = 1` or `id = 'singleton'`) with simple form |

## Recommended Project Structure

This structure is framework-agnostic in spirit but shown in the shape most small full-stack apps like this take today (server-rendered pages + server actions/route handlers, one deployable). Confirm exact framework choice in STACK.md — this is the layout to adapt to whatever is chosen.

```
src/
├── app/ (or pages/, routes/)     # Routed UI
│   ├── login/                    # Password entry, sets session cookie
│   ├── dashboard/                # Unbilled totals per student
│   ├── students/                 # List, create, edit, archive
│   ├── sessions/                 # Log + edit sessions (student autocomplete)
│   ├── invoices/                 # History list + read-only detail/snapshot view
│   ├── invoices/new/             # Generate invoice flow (select student → preview → confirm)
│   └── settings/                 # Zelle handle + message template
├── lib/
│   ├── auth/                     # Password check, session cookie sign/verify, middleware
│   ├── db/                       # Schema, migrations, client init
│   ├── students/                 # Queries + mutations for Student
│   ├── sessions/                 # Queries + mutations for Session, unbilled-total query
│   ├── invoices/                 # generateInvoice() transaction, line-item snapshot builder
│   ├── settings/                 # get/update singleton Settings row
│   └── email/                    # buildMailtoLink(invoice, settings) — pure function
└── components/                   # Shared UI (forms, tables, autocomplete input)
```

### Structure Rationale

- **`lib/invoices/` is the load-bearing module.** It's the only place that performs the unbilled→billed transition and the only place that constructs a snapshot. Keeping it isolated (rather than letting Sessions or Dashboard code mutate `invoiceId` directly) means there is exactly one code path that can ever create billing history — easy to reason about and to test.
- **`lib/email/` has no network/IO dependency.** It only formats a string and a URI. Keeping it a pure function (input: invoice + settings, output: `mailto:` string) makes it trivially testable and keeps "sending" entirely client-side, matching the constraint that this app never talks to an email service.
- **Route/page folders mirror the entities** (students, sessions, invoices, settings) plus one cross-cutting `dashboard/` — this matches the tutor's existing mental model (the same nouns she used in her spreadsheet), which reduces translation cost between "what she asks for" and "what the code has."

## Architectural Patterns

### Pattern 1: Derive "billed" from a foreign key, not a redundant boolean

**What:** A session is billed if and only if `sessions.invoiceId` is non-null. Do not maintain a separate `billed` boolean column that must be kept in sync.
**When to use:** Any time a "status" is fully determined by the presence/absence of a relationship. Here, billed status *is* "was this session captured on an invoice."
**Trade-offs:** Slightly less obvious to a SQL newcomer reading the schema (no literal `billed` column), but eliminates an entire class of bugs where the boolean and the FK disagree (e.g., invoice deleted but flag not reset). If a literal `billed` field is wanted for readability/API shape, expose it as a computed/virtual field in the query layer (`invoiceId !== null`), never as a second stored column.

**Example:**
```typescript
// Unbilled dashboard query
const unbilled = await db.session.findMany({
  where: { invoiceId: null },
  include: { student: true },
});
// billed is a derived view-model field, never persisted:
const withBilledFlag = sessions.map(s => ({ ...s, billed: s.invoiceId !== null }));
```

### Pattern 2: Freeze the entire invoice payload at generation time, including rendered text

**What:** When generating an invoice, snapshot not just the line items (session date/hours/rate/amount) but also the fully-rendered text summary — substituting the *current* Settings (Zelle handle, message template) into the template *at that moment* and storing the resulting string on the Invoice row.
**When to use:** Whenever "what was sent" must never change even if the source data (student's rate, settings' Zelle handle, message template wording) changes later. This directly satisfies the stated requirement that invoices are point-in-time snapshots.
**Trade-offs:** Slight storage duplication (the rendered text lives both as raw line items and as a formatted string) — irrelevant at this scale. The alternative (re-render text from current Settings every time the invoice is viewed) is simpler to implement but **breaks the point-in-time guarantee**: if she updates her Zelle handle next month, every historical invoice would silently start showing the new handle, which is wrong for an audit/history log. Freeze at generation; never re-render.

**Example:**
```typescript
async function generateInvoice(studentId: string) {
  return db.$transaction(async (tx) => {
    const unbilledSessions = await tx.session.findMany({
      where: { studentId, invoiceId: null },
    });
    const student = await tx.student.findUniqueOrThrow({ where: { id: studentId } });
    const settings = await tx.settings.findFirstOrThrow();

    const lineItems = unbilledSessions.map(s => ({
      sessionId: s.id,
      date: s.date,
      hours: s.hours,
      rate: student.hourlyRate,       // rate captured NOW, frozen forever
      amount: s.hours * student.hourlyRate,
      notes: s.notes,
    }));
    const total = lineItems.reduce((sum, li) => sum + li.amount, 0);
    const textSummary = renderTemplate(settings.messageTemplate, {
      student, lineItems, total, zelleHandle: settings.zelleHandle,
    });

    const invoice = await tx.invoice.create({
      data: { studentId, generatedAt: new Date(), lineItems, total, textSummary },
    });

    await tx.session.updateMany({
      where: { id: { in: unbilledSessions.map(s => s.id) } },
      data: { invoiceId: invoice.id },
    });

    return invoice;
  });
}
```

### Pattern 3: Never store a computed amount on Session — always derive it live

**What:** `Session` has no `amount` column. Any UI showing a dollar figure for a session (unbilled dashboard, session list, "all sessions ever" total) computes `hours × student.hourlyRate` at read time using the student's *current* rate.
**When to use:** For any value that is "always editable" (per the requirement that sessions and their totals recompute after edits, even for billed sessions). This is exactly why the PROJECT.md requirement "editing a session recomputes totals, billed sessions included" is trivially true with this pattern — there is nothing to reconcile, because nothing was cached.
**Trade-offs:** One extra join to `students` on every session read to get the current rate — negligible at this data volume (a single tutor's students/sessions, likely low hundreds to low thousands of rows ever). The only place a rate is ever "frozen" is inside an `Invoice.lineItems` snapshot (Pattern 2) — that's the one legitimate cache, precisely because it must *not* track live edits.

## Data Model

```
Student
├── id            (pk)
├── name           string
├── hourlyRate     decimal  (current rate; used for all live/unbilled calculations)
├── parentEmail    string?  (optional — required only to enable the email-draft flow)
├── archivedAt     timestamp?  (soft delete — see Anti-Patterns)
└── createdAt       timestamp

Session
├── id            (pk)
├── studentId      fk → Student
├── date           date
├── hours          decimal
├── notes          string?
├── invoiceId      fk → Invoice, nullable   ← presence = "billed"
└── createdAt       timestamp
   (no stored amount/billed boolean — both derived, see Patterns 1 & 3)

Invoice
├── id            (pk)
├── studentId      fk → Student
├── generatedAt    timestamp
├── lineItems      JSON  [{ sessionId, date, hours, rate, amount, notes }, ...]  ← frozen
├── total          decimal   ← frozen (= sum of lineItems.amount at generation time)
└── textSummary    string    ← frozen, rendered from Settings template at generation time

Settings (singleton — exactly one row)
├── id (fixed)
├── zelleHandle       string
└── messageTemplate   string  (placeholders like {{studentName}}, {{lineItems}}, {{total}}, {{zelleHandle}})
```

Relationships: `Student 1—N Session`, `Student 1—N Invoice`, `Invoice 1—N Session` (a session belongs to at most one invoice, once billed). `Settings` has no foreign keys — it's read at invoice-generation time only.

**Why JSON `lineItems` instead of a normalized `invoice_line_items` table:** at single-tutor scale (a handful of sessions per invoice, invoices generated maybe weekly/monthly), a normalized child table buys nothing — you'd still never query line items independently of their parent invoice, and you'd add a migration + join for zero behavioral benefit. A JSON snapshot column is simpler, and its immutability is actually a *feature* here (it can't accidentally be joined against live `Session` rows and made to look "live"). If future requirements need to query across all line items (e.g., "total hours billed across all students this year"), that's a `total`/`generatedAt` aggregate query on `Invoice`, not a line-item query — still doesn't need normalization.

## Data Flow

### Key Data Flows

1. **Unbilled dashboard total (read-heavy, live):**
   `Sessions WHERE invoiceId IS NULL` joined to `Student.hourlyRate` (current) → grouped/summed per student → rendered on Dashboard. Recomputes on every page load; nothing cached. Editing or deleting an unbilled session immediately changes this number on next read.

2. **Session edit after billing (live edit, frozen invoice untouched):**
   Editing `hours`/`notes` on a session that already has `invoiceId` set changes only the live `Session` row. Any "all sessions" or "per-student lifetime total" view recomputes using the new value. The `Invoice.lineItems` snapshot that originally captured that session is **not** touched — it still shows whatever hours/rate were true at generation time. This is the entire point of the snapshot: the live session record and the historical invoice record intentionally diverge once an edit happens after billing.

3. **Invoice generation (the pivot transaction):**
   User selects a student on the "New Invoice" screen → system reads that student's unbilled sessions + current rate + current Settings → builds `lineItems` + `total` + rendered `textSummary` → in one DB transaction: inserts the `Invoice` row and sets `invoiceId` on every session just captured. If the transaction fails partway, nothing is billed (all-or-nothing) — never leave sessions half-marked.

4. **Email draft (client-side only, no network):**
   From an Invoice (fresh or historical), read `invoice.textSummary` (already fully rendered, frozen) and `student.parentEmail` → build a `mailto:parentEmail?subject=...&body=encodeURIComponent(textSummary)` link (or equivalent Gmail-compose URL) → open in a new tab / navigate to it. This never touches Settings again at send time — it reuses whatever was frozen into the invoice, which is correct even for re-sending a months-old invoice after the Zelle handle changed.

5. **Settings change (forward-only effect):**
   Editing the Zelle handle or message template in Settings affects only *future* invoice generations (Flow 3). It has zero effect on `Invoice` rows already created — by construction, since `textSummary` and the rate values inside `lineItems` were already frozen.

### State Management

No client-side global state store is needed at this scale. Each page fetches what it needs server-side (or via a simple loader) and mutations happen through direct server calls (server actions / REST endpoints) followed by a refetch/revalidate of the affected page. Avoid a Redux/Zustand-style client store — there's no cross-page shared client state complex enough to justify it; the "shared state" here is the database itself.

```
Page load → Server query (students/sessions/invoices/settings) → Render
User submits form → Server mutation (create/update/delete, or generateInvoice tx) → Revalidate/refetch → Render
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Single tutor, current use | Exactly what's described above. One small relational DB (SQLite or a small managed Postgres), one deployable, no caching layer, no queue. This is the only tier that matters for v1. |
| Multiple tutors / small team (future, out of scope now) | Would require real per-user auth and scoping every query by `ownerId` — a meaningfully different auth model, not a scaling tweak. Not a concern for this milestone; noted only so the schema doesn't accidentally make this harder later (e.g., avoid singleton-Settings assumptions leaking into other tables if that pivot ever happens). |
| High session/invoice volume for one tutor (years of history) | Still trivial for a relational DB — thousands of session rows and hundreds of invoices is nothing. The only realistic future concern is the Dashboard's `GROUP BY student` query as history grows; add an index on `sessions(studentId, invoiceId)` proactively since it's free and directly serves both the dashboard query and the invoice-generation query. |

### Scaling Priorities

1. **First (and only) realistic bottleneck:** the unbilled-dashboard aggregate query as session history grows across years. Mitigation is a single composite index on `sessions(studentId, invoiceId)` — trivial to add up front, no reason to defer.
2. **Second bottleneck:** none anticipated at single-user scale. Do not build for a second bottleneck that won't arrive.

## Anti-Patterns

### Anti-Pattern 1: Hard-deleting a Student that has session/invoice history

**What people do:** Implement "remove student" as a real `DELETE FROM students WHERE id = ?`, cascading to delete or orphan their sessions and invoices.
**Why it's wrong:** Invoices are supposed to be permanent historical records ("invoice history log of all generated invoices"). Hard-deleting the student breaks that log (dangling FK or cascaded deletion of paid invoice history) and destroys the audit trail of money already billed/collected.
**Instead:** Soft-delete/archive students (`archivedAt` timestamp). "Remove" hides them from the active autocomplete/list and dashboard, but their historical sessions and invoices remain intact and viewable. Block hard deletion entirely, or only allow it for a student with zero sessions ever logged.

### Anti-Pattern 2: Re-rendering invoice text from live Settings at view/send time

**What people do:** Store only the raw line items on `Invoice`, and regenerate the display text (and the mailto body) from the *current* Settings message template every time the invoice is opened, reasoning "why duplicate the string, just re-render it."
**Why it's wrong:** Directly violates the stated invariant that invoices are point-in-time snapshots. If she edits her message template or Zelle handle next month, every historical invoice's displayed/sendable text would silently change to reflect the new template — including invoices that were already emailed to parents with different wording weeks ago. That's confusing and undermines trust in the history log.
**Instead:** Render the text once, at generation time, using Settings values as they exist at that instant, and store the result on the `Invoice` row (Pattern 2). Viewing/resending later always uses the frozen string.

### Anti-Pattern 3: A synced `billed` boolean alongside `invoiceId`

**What people do:** Add both a `billed: boolean` column and an `invoiceId` FK to `Session`, updating both together "for clarity."
**Why it's wrong:** Two fields encoding one fact will eventually disagree (a bug in one write path forgets to flip the boolean, or a future admin/debug tool nulls `invoiceId` without touching `billed`). Once they disagree, the dashboard (which presumably reads whichever field is convenient) can silently show wrong totals.
**Instead:** One source of truth — `invoiceId`. Compute "billed" wherever it's displayed (Pattern 1).

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| User's own email client | `mailto:` URI (or a webmail compose deep link like Gmail's `https://mail.google.com/mail/?view=cm&to=...&su=...&body=...`) opened client-side | No API keys, no email-service account, no deliverability concerns — matches the explicit constraint that the app never sends email itself. Body must be URI-encoded; very long invoice text can hit URL-length limits in some mail clients, worth a quick sanity check during implementation but not an architectural blocker. |

No other external services are required for v1 (no payment API, no PDF service, no auth provider).

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Auth Gate ↔ everything else | Session cookie checked on every request before any route handler runs | Single chokepoint; no route should be reachable without it except `/login`. |
| Sessions module ↔ Invoice Generation | Invoice Generation reads unbilled Sessions and writes their `invoiceId`; Sessions module never writes `invoiceId` itself | Keeps the billing transition to exactly one code path (see Structure Rationale). |
| Invoice Generation ↔ Settings | Read-only, at generation time only | Settings changes never reach back into already-created invoices. |
| Invoice (history) ↔ Email Draft Builder | Read-only; builder consumes `invoice.textSummary` + `student.parentEmail` | Pure function, no DB write, no network call — purely client-side URI construction. |
| Dashboard ↔ Sessions/Students | Read-only aggregate query | Dashboard has no mutation path; all edits happen through Sessions/Students/Invoice-Generation screens. |

## Suggested Build Order (Vertical MVP Path)

Granularity here is coarse (per PROJECT.md's Active requirements), so build in dependency order rather than splitting by layer:

1. **Auth Gate** — nothing else is reachable without it; trivial to build first and stop worrying about.
2. **Data Layer** — schema + migrations for all four entities up front (Student, Session, Invoice, Settings), even though Invoice/Settings aren't used until later steps. Getting the schema right early (especially `invoiceId` nullable on Session, JSON `lineItems` on Invoice) avoids painful migrations mid-project.
3. **Students CRUD** — foundational entity; nothing else can be tested without at least one student.
4. **Settings CRUD** — small and independent; needed before Invoice Generation can render a real text summary. Building it early also means the message-template placeholders can be designed before Invoice Generation depends on them.
5. **Sessions CRUD** — depends on Students (autocomplete). This is also where the "live derived amount" pattern (Pattern 3) gets proven out.
6. **Dashboard** — depends on Sessions existing; this is the first payoff moment ("see at a glance who owes what") and a good milestone to demo.
7. **Invoice Generation** — the pivot feature; depends on Sessions, Students, and Settings all being real. Implement as one transaction (Pattern 2) from day one — do not build it as "create invoice" then "mark sessions billed" as two separate steps to be joined later, since that invites a half-billed state bug.
8. **Invoice History + Email Draft Builder** — natural last pair; History is a read-only view of what step 7 produces, and the Email Draft Builder is a small pure function consuming a generated Invoice. Building these last means step 7 already has real data to display/send.

This order means every step after Auth Gate + Data Layer produces something demoable, and the riskiest logic (the billed transition) is tackled only once its two dependencies (Sessions, Settings) already exist and are stable — reducing rework.

## Sources

- General invoice-snapshot/freeze-at-billing-time convention — cross-referenced against common billing-system documentation patterns (e.g., Oracle invoice-lines docs, WHMCS invoice generation docs) confirming that invoice line items are treated as frozen historical records distinct from live source data. MEDIUM confidence (pattern is well-established industry convention, not project-specific documentation): [Invoice Lines — Oracle](https://docs.oracle.com/en/cloud/saas/project-management/25b/oapjb/invoice-lines.html), [WHMCS Invoice Settings](https://docs.whmcs.com/9-0/system/general-settings/general-settings-invoices/)
- Shared-password / single-secret gate patterns for small internal tools (middleware-based, env-var secret, signed session cookie, no user table) — consistent across multiple current community write-ups. MEDIUM confidence (community sources, not official framework docs, but broadly consistent with each other and with `next.js` official auth guidance's general shape): [Simple password protection for a Next.js app](https://blog.ratu.dev/simple-password-protection-for-a-next-js-app-1ff21ada93a3), [Revisiting password protecting routes in Next.js](https://www.alexchantastic.com/revisiting-password-protecting-next), [Next.js: Guides — Authentication](https://nextjs.org/docs/app/guides/authentication)
- Data model, component boundaries, build order, and anti-patterns in this document are derived directly from the project's own stated requirements and constraints in `.planning/PROJECT.md` (billed/unbilled lifecycle, snapshot invariant, single-user scope) — HIGH confidence, first-party source.

---
*Architecture research for: single-user tutoring time-tracking + invoicing web app*
*Researched: 2026-07-03*
