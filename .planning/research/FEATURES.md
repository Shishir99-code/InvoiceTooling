# Feature Research

**Domain:** Single-user time-tracking + invoicing tool for a solo tutor (Excel-replacement, not a multi-tenant SaaS product)
**Researched:** 2026-07-03
**Confidence:** HIGH (table stakes / anti-features — directly specified in PROJECT.md) / MEDIUM (differentiator framing — informed by market scan of freelancer/tutor invoicing tools)

## Framing

This is not a generic "invoicing SaaS" feature audit. The lens is tight: **one person, one password, replacing a spreadsheet.** Market research on tools like FreshBooks, Zoho Invoice, TutorBird, TutorCruncher, and Harvest surfaces a broad feature set (payment processing, automated reminders, client portals, multi-currency, branding) that is standard for a *multi-client SaaS product* but is actively the wrong scope here — those tools are built to serve many businesses/users at once, with their complexity (accounts, billing infra, deliverability, PCI-adjacent payment handling) justified by that scale. A single tutor with one shared password does not carry that justification. This document filters the broader market's table stakes down to what a one-person Excel-replacement actually needs, and explicitly calls out where the market's "obvious" features become this project's anti-features.

## Feature Landscape

### Table Stakes (Required to Replace the Spreadsheet)

These map directly to the "Active" requirements in PROJECT.md. Missing any of these means the app cannot fully replace the existing Excel workflow, so it fails its core value proposition.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Shared-password gate | Some access control is needed since the app is on a public URL; a spreadsheet has none, but a hosted app can't be open to the internet | LOW | Single password (env var or hashed constant) + session cookie; no user table, no per-user roles, no password reset flow |
| Student management (add/edit/remove; name, hourly rate, optional parent email) | Every session and invoice is scoped to a student — this is the root entity of the whole data model, same as a "student" tab/row-group in her spreadsheet | LOW | Simple CRUD form + list view; rate is per-student (not per-session) unless she needs rate overrides later |
| Session logging (student, date, hours, optional notes) | This is the row-by-row entry she already does in Excel — the core data-capture loop | LOW–MEDIUM | Student picker needs autocomplete against existing students (depends on Student Management existing first) |
| Edit/delete sessions at any time, with totals recomputing | Excel lets her fix a typo'd hour count trivially; a rigid record would feel like a downgrade | LOW | Totals are always *derived* (sum unbilled sessions), never stored — so "recompute" is really just "don't cache stale totals," not a special feature |
| Unbilled-hours dashboard (per-student unbilled hours + amount owed) | This answers "who owes me what" — the single most valuable view she currently has to build manually with SUMIFs in Excel | LOW–MEDIUM | Aggregation query: group sessions by student, filter `billed = false`, multiply hours × rate. Depends on Session Logging + Student Management |
| Invoice generation (totals unbilled sessions into a copyable text summary) | This is the payoff moment — "sessions become an invoice" — same mental leap she makes manually today | MEDIUM | Needs to: pull all unbilled sessions for a student, sum them, render against the message template, and persist a snapshot. The "mark billed" step must be atomic with snapshot creation or totals can drift |
| Invoice generation auto-marks sessions billed; invoice stored as point-in-time snapshot | Prevents double-billing and matches the "once invoiced, it's locked" mental model from her spreadsheet (she doesn't un-bill things) | MEDIUM | Snapshot must copy session data at generation time (not just reference session IDs), since sessions remain editable afterward and shouldn't retroactively change a sent invoice |
| Email handoff — opens her own email client with a pre-filled draft (recipient, body = invoice + Zelle instructions) | This is literally how she sends invoices today (manually copy-paste into an email); automating just the copy-paste step is the whole point | LOW–MEDIUM | `mailto:` URL construction; **known gotcha**: many mail clients truncate or mishandle long `mailto:` bodies (practical safe limit is roughly 1500–2000 characters after URL-encoding) — keep the generated invoice text concise or provide a "copy to clipboard" fallback |
| Settings (Zelle handle + editable message/invoice template) | Without a place to store this, every invoice requires manual typing of boilerplate — defeats the purpose | LOW | Single-row settings table (not multi-user preferences); template needs placeholder substitution (student name, total, session list, Zelle handle) |
| Invoice history (log of all generated invoices) | Her spreadsheet already has an implicit history (past rows); losing this on migration would be a regression, and she needs it to answer "did I already bill this?" | LOW | Simple list/detail view over stored snapshots; no editing (snapshots are immutable by design) |

### Differentiators (Deferred, Not Required for v1)

These are common in the broader tutoring/freelancer invoicing market and are genuinely useful, but PROJECT.md explicitly defers them. They become natural "v1.x" additions once the core loop is validated — not because they're low-value, but because none of them are needed to replace the spreadsheet on day one.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| PDF invoices | Looks more "official" if a parent ever wants a formal receipt; some tutoring platforms (TutorBird, TutorCruncher) treat this as standard | MEDIUM–HIGH | Requires a PDF generation library, a layout/template design pass, and probably a "download" or "attach" flow. Deferred per PROJECT.md — revisit only if parents actually request it |
| Recurring sessions (auto-log a weekly student slot) | Reduces repetitive data entry for standing weekly students — most tutoring tools (FreshBooks, Zoho Invoice, Teachworks) treat recurring billing as core | MEDIUM | Needs a recurrence rule (day-of-week, time, duration), a way to generate/confirm sessions ahead of time, and handling for skipped/rescheduled weeks. Enhances Session Logging rather than replacing it |
| App-sent email (invoice sent directly from the app, not via mailto draft) | Removes the manual "hit send" step entirely; is the default in FreshBooks/Zoho-class tools | MEDIUM–HIGH | Requires an email-service account (SendGrid/Postmark/etc.), API keys, sender-domain verification, and deliverability tuning — the exact overhead PROJECT.md explicitly avoids for v1. **Architecturally conflicts** with the mailto-draft decision; adopting this later is a redesign, not an add-on |
| Reporting / income-over-time (charts, totals by month/year) | Useful for her own business visibility (how much did I earn this quarter) | MEDIUM | Aggregation over Invoice History + Session data by date range; mostly a read-only view layer once history data exists |
| Tax summaries (annual totals, possibly per-student breakdowns) | Useful once a year at tax time; several tutoring-specific tools (TutorCruncher, Teachworks) offer this for agency use cases | MEDIUM | Requires accurate historical invoice data (depends on Invoice History) and some domain knowledge of what a summary needs to contain (this is not tax advice — just a totals report) |

### Anti-Features (Deliberately Not Building)

These look like obvious "of course an invoicing app has this" features if you compare against the broader market (FreshBooks, Zoho Invoice, TutorCruncher, etc.), but they are wrong for a single-user, one-password, spreadsheet-replacement tool.

| Feature | Why It Seems Appealing | Why Problematic Here | Alternative |
|---------|------------------------|-----------------------|-------------|
| Multi-user accounts / per-user auth | "What if I add another tutor later?" — standard in every commercial tutoring platform (TutorCruncher's split invoicing, Teachworks' contractor roles) | Adds an entire auth subsystem (registration, roles, password reset, data isolation) for a user population of exactly one; pure wasted complexity per PROJECT.md's explicit decision | Single shared password gates the whole app; revisit only if a second person genuinely needs separate access |
| Payment processing / Zelle API integration | "Close the loop — let parents pay from the invoice" is the single highest-value feature in general freelancer invoicing tools (one-click pay links) | Zelle has no public merchant API for individuals; any "integration" would really mean a different payment rail (Stripe/PayPal) requiring PCI-adjacent handling, webhooks, and reconciliation — a different product entirely | App states Zelle instructions in the invoice text; money movement and payment confirmation happen entirely outside the app (she marks paid/knows paid manually today, and that doesn't need to change) |
| PDF invoices (for v1) | "Professional" invoices are the default expectation in commercial tools | Adds a rendering pipeline and design work for zero validated demand — she's replacing a spreadsheet, not launching a branded business | Copyable text summary, good enough to paste into an email body; graduate to PDF only if parents ask for a formal document |
| In-app transactional email sending | Removing the manual "hit send" step is standard in FreshBooks/Zoho-class tools and feels more "automated" | Requires an email-service account, API keys, sender verification, deliverability babysitting — real ongoing operational surface for a single user who is fine clicking "send" herself | `mailto:`-based draft handoff into her own email client; she keeps full control of the actual send |
| Live start/stop time tracking (timer-based, à la Harvest/Toggl) | Common in general time-tracking tools; feels more "real-time" and precise | Wrong mental model for tutoring — sessions are fixed-duration scheduled appointments logged after the fact (e.g., "1.5 hours on Tuesday"), not open-ended work blocks that need a running clock | Manual hours entry per session, exactly matching her spreadsheet's data entry pattern |
| Automated payment reminders | High-ROI in general freelancer tools (FreshBooks reports ~2x faster payment with reminders) | The app has no signal of whether an invoice was actually paid (no payment integration — see above), so it can't know when a reminder is warranted without her manually marking paid status, which isn't in scope | If paid-tracking is added later, reminders could follow; for now, she already knows her students/parents well enough to follow up personally |
| Client-facing portal (parents log in to view balance/invoices) | Reduces "can you resend that invoice" requests; standard in TutorCruncher/Teachworks agency tools | Introduces a second authentication surface, directly conflicting with the single shared-password design decision, and requires per-parent identity — a mini multi-user system in disguise | Parents receive the invoice via email; if they need history, she can resend from Invoice History |
| Business branding / logo on invoices | "Looks professional," standard on templated invoice tools | Zero functional value for getting paid by parents who already know her personally; pure polish for a v1 that's about function over form | Deferred per PROJECT.md — plain text with her Zelle handle is sufficient |
| Multi-currency support | Standard checkbox feature in general invoicing tools serving international freelancers | She has one currency, one country, one set of local students — this solves a problem she doesn't have | N/A — hardcode currency formatting |

## Feature Dependencies

```
Shared-Password Gate
    └──protects──> [everything else — foundational, not a data dependency]

Student Management
    └──required by──> Session Logging (autocomplete needs existing students)
    └──required by──> Unbilled-Hours Dashboard (grouping needs student identity + rate)

Session Logging
    └──required by──> Unbilled-Hours Dashboard (aggregates unbilled sessions)
    └──required by──> Invoice Generation (invoice totals come from unbilled sessions)

Settings (Zelle handle + message template)
    └──required by──> Invoice Generation (template fills invoice text)
    └──required by──> Email Handoff (Zelle handle + template text populate the draft body)

Invoice Generation
    └──required by──> Invoice History (each generation creates a history entry)
    └──required by──> Email Handoff (draft body = generated invoice content)
    └──marks billed──> Session Logging (sessions flip unbilled → billed; dashboard reflects this)

Recurring Sessions (differentiator) ──enhances──> Session Logging
Reporting / Income-Over-Time (differentiator) ──requires──> Invoice History + Session Logging
Tax Summaries (differentiator) ──requires──> Invoice History
PDF Invoices (differentiator) ──requires──> Invoice Generation (alternate output format)

App-Sent Email (differentiator) ──conflicts──> Email Handoff (mailto draft)
Payment Processing / Zelle API (anti-feature) ──conflicts──> "money moves outside the app" design decision
Client Portal (anti-feature) ──conflicts──> Shared-Password Gate (single-auth-surface decision)
```

### Dependency Notes

- **Session Logging requires Student Management:** the session form's student picker needs an existing student list to autocomplete against — students must exist before a session referencing them can be logged. This forces phase ordering: student CRUD ships before/with session logging.
- **Unbilled-Hours Dashboard requires Student Management + Session Logging:** it's a pure read/aggregation layer over the two — no new entity, just a query (`sessions WHERE billed = false GROUP BY student`).
- **Invoice Generation requires Session Logging + Settings:** it needs both the unbilled session data to total *and* the message template/Zelle handle to render the actual text — building invoice generation before settings exist means hardcoding placeholder text that has to be ripped out later.
- **Invoice Generation marks Session Logging data billed:** this is a write-back dependency, not just a read — generating an invoice must atomically flip the relevant sessions' `billed` flag and snapshot their data, or the unbilled dashboard and invoice history can drift out of sync (double-billing risk if this isn't atomic).
- **Email Handoff requires Invoice Generation:** the mailto draft body is literally the generated invoice text plus the message template — it cannot be built before invoice generation exists.
- **Invoice History requires Invoice Generation:** history is a list of snapshots; there's nothing to list until generation produces the first one.
- **App-Sent Email conflicts with Email Handoff:** these represent two different architectural decisions (mailto draft vs. server-side email service). PROJECT.md has already chosen mailto draft; adopting app-sent email later is a replacement, not an addition — flag this if it ever resurfaces as a request.
- **Payment Processing conflicts with the core design:** PROJECT.md's decision is "the app only tells parents to Zelle her; money moves outside the app." Any payment integration would require walking back that decision, not extending it.
- **Client Portal conflicts with Shared-Password Gate:** a second login surface for parents reintroduces the multi-user complexity the single-password decision was explicitly meant to avoid.

## MVP Definition

### Launch With (v1)

Everything in this list is required to fully replace the Excel workflow — this is not a "pick the most valuable subset," it's the full table-stakes list, because a partial replacement means she keeps using the spreadsheet anyway.

- [ ] Shared-password gate — the app is on a public URL and needs *some* barrier
- [ ] Student management (CRUD) — root entity for everything else
- [ ] Session logging (CRUD, autocomplete) — the daily data-entry replacement for her Excel rows
- [ ] Unbilled-hours dashboard — the "who owes me what" view that's currently manual SUMIFs
- [ ] Invoice generation (text summary) — the payoff: sessions → invoice
- [ ] Auto-mark-billed + snapshot on invoice generation — prevents double-billing, matches her mental model
- [ ] Email handoff (mailto draft) — the actual send mechanism, minus the manual copy-paste
- [ ] Settings (Zelle handle + template) — required input for both invoice text and email body
- [ ] Invoice history — replaces the implicit history she has in old spreadsheet rows

### Add After Validation (v1.x)

Natural next steps once the core loop (log → dashboard → invoice → send) is proven to actually replace her workflow day-to-day.

- [ ] Recurring sessions — add once she's logged enough real sessions to feel the repetition pain for standing weekly students
- [ ] Reporting / income-over-time — add once enough invoice history accumulates to make a chart meaningful (needs several months of data to be useful, not a v1-day-one feature)

### Future Consideration (v2+)

Deferred because each requires either new infrastructure (email service, PDF pipeline) or a walk-back of an explicit v1 design decision — not because they lack value.

- [ ] PDF invoices — only if parents actually request a formal document; adds a rendering pipeline for currently-unvalidated demand
- [ ] App-sent email — only if the manual "hit send" step becomes a genuine friction point; requires standing up an email service, which v1 deliberately avoids
- [ ] Tax summaries — only relevant once a full tax year of invoice history exists to summarize

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Shared-password gate | HIGH | LOW | P1 |
| Student management | HIGH | LOW | P1 |
| Session logging | HIGH | LOW | P1 |
| Unbilled-hours dashboard | HIGH | LOW-MEDIUM | P1 |
| Invoice generation (text) | HIGH | MEDIUM | P1 |
| Auto-mark-billed / snapshot | HIGH | MEDIUM | P1 |
| Email handoff (mailto) | HIGH | LOW-MEDIUM | P1 |
| Settings (Zelle + template) | HIGH | LOW | P1 |
| Invoice history | MEDIUM | LOW | P1 |
| Recurring sessions | MEDIUM | MEDIUM | P2 |
| Reporting / income-over-time | LOW-MEDIUM | MEDIUM | P2 |
| PDF invoices | LOW | MEDIUM-HIGH | P3 |
| App-sent email | LOW | MEDIUM-HIGH | P3 |
| Tax summaries | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have — required to fully replace the spreadsheet (this milestone)
- P2: Should have — add once the core loop is validated in real use
- P3: Nice to have — defer until explicitly requested or a design decision is revisited

## Competitor Feature Analysis

Note: "competitors" here are broader-market tools (multi-client SaaS), included only to show what this project is deliberately *not* building toward, and why that's the right call for a single-user tool.

| Feature | FreshBooks / Zoho Invoice (general freelancer) | TutorBird / TutorCruncher (tutoring-specific) | Our Approach |
|---------|--------------------------------------------------|------------------------------------------------|--------------|
| Time/session tracking | Timer-based or manual, tied to projects/clients | Scheduling-integrated (sessions auto-logged from calendar bookings) | Manual entry per session (student, date, hours, notes) — matches her existing spreadsheet habit, no calendar integration needed |
| Invoice generation | Templated, branded, often auto-generated from recurring rules | Auto-generated from completed/attended sessions | Manual trigger, text-only summary from unbilled sessions, no branding |
| Invoice delivery | In-app email send, client portal link, sometimes PDF attachment | In-app email + parent portal | `mailto:` draft opens in her own email client — she reviews and sends |
| Payment | Integrated online payment (Stripe/PayPal), auto reminders | Online payment + contractor payout tracking | Zelle instructions in text only; no payment integration, no reminders |
| Multi-user / roles | Full account system, team seats | Tutor/admin roles, agency-level split invoicing | Single shared password, no roles |
| History/reporting | Dashboards, income reports, tax exports | Agency-level reporting across tutors | Simple invoice history list only for v1; reporting deferred to v1.x |

## Sources

- [Best Invoicing & Billing Software for Tutoring & Education Businesses in 2026 | Deelo](https://www.deelo.ai/best/invoicing-for-tutoring)
- [Best Invoice Software for Tutors in 2026 (Compared) | Waffle](https://www.waffleinvoice.com/blog/best-invoice-software-for-tutors)
- [Top 5 Best Invoicing Platforms for Tutors | Evallo](https://evallo.ai/resources/blogs/top-5-best-invoicing-platforms-for-tutors)
- [TutorBird - Tutor Management Software](https://www.tutorbird.com/)
- [TutorCruncher - Tutor Management Software](https://tutorcruncher.com/)
- [Teachworks - Tutoring Center Scheduling & Management Software](https://www.teachworks.com/)
- [The Best Tutor Management Software: Invoicing Made Easy | TimeNavi](https://www.timenavi.com/blog/best-tutor-management-software)
- [7 Best Invoicing Software for Freelancers (2026) | OneSuite](https://onesuite.io/blog/invoicing-software-for-freelancers/)
- [Best Invoicing Software for Freelancers 2026 | Jobbers](https://www.jobbers.io/best-invoicing-software-for-freelancers-2026-12-tools-tested-and-ranked/)
- `.planning/PROJECT.md` — primary source for table stakes and anti-features scope (Active / Out of Scope requirements)
- General knowledge (MEDIUM confidence, not independently verified): `mailto:` URL practical body-length limits vary by client (~1500–2000 characters is a commonly cited safe threshold); flagged as a phase-specific implementation risk to verify against target browsers/email clients during implementation, not asserted as a hard spec

---
*Feature research for: Single-user tutoring time-tracking + invoicing web app*
*Researched: 2026-07-03*
