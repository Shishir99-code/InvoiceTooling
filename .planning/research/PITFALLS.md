# Pitfalls Research

**Domain:** Single-user tutoring time-tracking + invoicing web app (shared-password gate, mailto-based email, hosted DB)
**Researched:** 2026-07-03
**Confidence:** MEDIUM-HIGH (money/rounding, mailto limits, auth rate-limiting are well-documented and verified against multiple sources; hosted-DB backup specifics are provider-dependent and should be re-verified once a provider is chosen)

## Critical Pitfalls

### Pitfall 1: Floating-point money math corrupts totals

**What goes wrong:**
`rate × hours` computed with JS/Python native floats produces values like `1.7000000000000002` instead of `1.70`. Summing many session amounts into an invoice total compounds the error, so the invoice total doesn't equal the sum of its displayed line items, or is off by a cent in a way that looks like a bug to the tutor (and erodes trust in the tool she's replacing Excel with).

**Why it happens:**
IEEE 754 doubles can't represent most decimal fractions exactly (0.1 + 0.2 !== 0.3). Developers reach for `Math.round(x * 100) / 100` as a fix, which still operates in float space and doesn't compose safely across multiple operations (rate × hours, then summed, then possibly discounted).

**How to avoid:**
- Store hourly **rate in integer cents** (e.g., `4500` for $45.00), not dollars-as-float.
- Store **hours as a decimal with a fixed, small precision** (e.g., quarter-hour increments: 0.25, 0.5, 1.75) — validate input to a fixed number of decimal places (2) at the form boundary so you never have to reconcile arbitrary float precision later.
- Compute each session's amount as `round(rate_cents * hours)` **once**, store that integer result, and sum integers for invoice totals — never re-derive the total by re-multiplying floats at render time.
- If the stack has a decimal type (Postgres `NUMERIC`/`DECIMAL`), use it for hours and derive cents in application code with a single rounding step, or use a small money-safe library (`currency.js`, `dinero.js`) rather than hand-rolled float math.
- Pick ONE rounding rule (round-half-up to the cent) and apply it in exactly one place in the codebase.

**Warning signs:**
- Invoice total doesn't match "sum the line items on the page with a calculator."
- Same session amount displays differently in two places (dashboard vs. invoice).
- Amounts stored as `REAL`/`FLOAT` columns in the schema.

**Phase to address:**
Data model / schema phase (session and invoice amount fields), before any billing logic is built. Retrofitting integer-cents storage after invoices already exist is a painful migration.

---

### Pitfall 2: Editing a billed session silently corrupts a past invoice

**What goes wrong:**
The spec explicitly allows editing sessions after they're billed ("totals recomputing (billed sessions included)"). If the invoice is only a *query* (e.g., "sum of sessions where invoice_id = X") rather than a true point-in-time **snapshot**, then editing a billed session's hours/rate/date after the fact silently changes what a previously-sent invoice shows when reopened — the parent already saw $135 in their inbox, but the app now displays $150 for "the same invoice." This is a real accounting integrity break, not just a display bug.

**Why it happens:**
It's simpler to build invoices as a live join over sessions than to snapshot data, and the two look identical during initial development/testing (nobody has edited a billed session yet). The bug only appears once a real edit-after-bill happens — easy to miss in testing, painful in production.

**How to avoid:**
- When an invoice is generated, **copy** the relevant session data (student name, date, hours, rate, computed amount) into the invoice record itself (or an `invoice_line_items` table) — do not have the invoice re-read live session rows for its displayed totals.
- Keep the `session.billed`/`invoice_id` link for traceability (so "show me the invoice this session was billed on" still works), but the invoice's **displayed numbers** come from the snapshot, not the live session.
- When a billed session is edited, the *session* record and the *dashboard/unbilled totals* update normally, but the **existing invoice snapshot is untouched**. Optionally surface a subtle UI signal ("this session was billed on Invoice #12 for $45 — you're now editing the live record to $50; the invoice will still show $45") so the tutor isn't confused by the divergence.
- Decide explicitly what happens to `billed`/`invoice_id` status when a billed session's hours become 0 or it's deleted — do not let deleting a billed session silently break the invoice's line-item history (soft-delete or block deletion of billed sessions and require "unbilling" first, if that's ever needed).

**Warning signs:**
- Invoice detail view computes totals via a live JOIN/SUM query against `sessions` instead of reading stored `invoice.total` / `invoice_line_items`.
- No `invoice_line_items` table or embedded snapshot JSON — only a foreign key from session to invoice.
- Editing a billed session's hours changes a previously generated invoice's displayed total when reopened.

**Phase to address:**
Invoice generation phase — this is the single highest-risk design decision in the whole app and should be nailed down before "edit session" and "generate invoice" are both built, since it determines the schema shape for both.

---

### Pitfall 3: mailto: draft silently fails or truncates for real invoices

**What goes wrong:**
`mailto:` links have no standardized length limit — behavior is client/browser-dependent. Documented failure modes: Internet Explorer breaks past ~512 characters in the URL; browsers generally cap total URL length around ~2000 characters; several email clients (notably Outlook) simply do nothing or open a blank compose when the link is too long, with **no error shown to the user**. For this app, invoice bodies are template text + a per-student line-item list + Zelle instructions — for a student with many unbilled sessions (e.g., billed monthly with 8-12 sessions listed individually), the body can realistically approach or exceed these limits.

**Why it happens:**
mailto: was designed for short "email this link" use cases, not multi-line invoice bodies. It's easy to test with 2-3 sample sessions during development and never hit the wall, then have it silently break in real usage once a student accumulates a full month of sessions.

**How to avoid:**
- Keep the invoice body as **compact as possible** — summarize sessions (e.g., "6 sessions, 9 hours total" with dates on one line each) rather than a verbose per-session paragraph.
- **Always URL-encode** subject and body with `encodeURIComponent` (not `escape`, which mishandles many characters) — line breaks must become `%0D%0A`, and any special characters in the template (apostrophes in names, `&`, `#`) must be encoded or they corrupt the mailto URL or terminate it early.
- Test with a realistic worst case (a student with the maximum plausible sessions for a billing period) and measure the actual encoded URL length, not the raw text length — encoding roughly triples length for line breaks and expands further for punctuation.
- Provide a **fallback**: a "Copy invoice text" button next to "Email invoice" so if the mailto draft fails silently (blank compose, or nothing happens), she can still paste the text into a manually-opened email. Given mailto failures are silent, this fallback is not optional polish — it's the safety net for a core workflow step.
- If measured bodies are consistently near the limit, consider truncating the itemized list in the mailto body and pointing to "full breakdown in invoice history" rather than growing the draft indefinitely.

**Warning signs:**
- Manual testing only used 1-2 sample sessions.
- No fallback path when "Email invoice" is clicked and nothing visibly happens.
- Template text uses raw string concatenation into the mailto URL instead of an encoding function.

**Phase to address:**
Email draft generation phase — write the encoding + fallback together, and load-test with realistic session volume before considering the feature done.

---

### Pitfall 4: mailto: opens with no recipient (or wrong content) when parent email is missing/malformed

**What goes wrong:**
Parent/guardian email is optional on the student record. If a tutor generates an invoice for a student without an email on file, `mailto:` with an empty `to` address either opens a blank compose (easy to send to nobody by mistake) or — if the code doesn't guard against it — throws or silently no-ops. Similarly, an email address with a typo or missing `@` isn't validated by mailto itself; the client may accept it as literal text into the "To" field, and the tutor may not notice before hitting send.

**Why it happens:**
"Parent email is optional" (per the requirements) is a reasonable data-entry allowance for new students, but the invoice-send flow assumes it's present. Optional fields at data-entry time need explicit handling at the point they're consumed downstream.

**How to avoid:**
- Validate email format (basic regex, not RFC-perfect) at student data-entry time, and flag records missing an email in the student list/dashboard (e.g., a small "no email on file" badge).
- On the invoice generation/send screen, if the student has no email, **disable or hide the "Email invoice" button** and show "Add parent email to send" with a shortcut to edit the student — don't let the click silently open a broken draft.
- The invoice should still be generatable and marked billed even without an email (the tutor may print/copy it manually) — don't couple "can generate invoice" to "has email on file."

**Warning signs:**
- "Email invoice" button is always enabled regardless of student data.
- No visual indicator on student list for missing email.

**Phase to address:**
Same phase as Pitfall 3 (email draft generation), plus the student CRUD phase for validation/indicators.

---

### Pitfall 5: Shared password done insecurely (plaintext, no rate limiting, weak session handling)

**What goes wrong:**
Because there's only one user, it's tempting to treat auth as an afterthought: password stored in plaintext in an env var and compared with `===`, no lockout on repeated failed attempts (trivially brute-forceable, especially over the internet since this is a hosted/URL-accessible app, not local-only), and a session mechanism that's either missing (re-prompts every request, tempting the dev to weaken it) or insecure (long-lived unsigned cookie, no `Secure`/`HttpOnly`/`SameSite` flags, no expiry). Since this app holds real names, emails, and financial data (rates, session logs, invoice history) for a real business, a compromised gate is a real privacy/security incident, not a toy risk.

**Why it happens:**
"Single shared password, no accounts" reads as "auth is simple" and gets under-invested — but simple auth still needs the same fundamentals as any auth: don't store secrets in plaintext, don't allow unlimited guesses, don't leak the session.

**How to avoid:**
- Hash the password even though there's only one (bcrypt/argon2, or simply store it hashed in the env/config rather than comparing plaintext) — this matters less for brute-force (env var isn't guessable by an attacker without server access) but protects against accidental logging/exposure of the raw password in error messages, request logs, etc.
- **Rate-limit the login endpoint**: a simple in-memory or DB-backed counter is enough at this scale — e.g., lock out after 5 failed attempts for 15 minutes, escalating on repeat offenses. This is the single highest-value security control here, since a single shared password over the public internet with unlimited guesses is brute-forceable in a realistic timeframe for short/memorable passwords.
- Enforce HTTPS (most hosting platforms do this by default — verify, don't assume).
- Use a signed, `HttpOnly`, `Secure`, `SameSite=Lax` (or `Strict`) session cookie with a reasonable expiry (e.g., 30 days for a personal single-user tool is a fine tradeoff between convenience and risk) rather than re-sending the password on every request or storing it client-side.
- Have a way to **rotate the password** without a code deploy (env var + restart is fine) in case it's ever suspected of being exposed.

**Warning signs:**
- Password comparison is a plaintext `if (input === process.env.PASSWORD)`.
- No failed-attempt counter or lockout anywhere in the login flow.
- Cookie/session inspection in devtools shows a readable password or no `HttpOnly`/`Secure` flags.

**Phase to address:**
Auth gate phase — should be built with rate limiting and secure cookies from the start; retrofitting rate limiting after the app is live and already indexed/discoverable is higher-risk.

---

### Pitfall 6: Cheap hosted DB with no backup strategy = real data loss risk

**What goes wrong:**
Free/cheap tiers of hosted Postgres providers frequently do **not** include automated backups or point-in-time recovery as standard — that's often a paid-tier feature — and some free tiers actively pause or reclaim inactive projects (e.g., Supabase free-tier projects pause after 7 days of inactivity, which for a tool used in bursts around billing cycles is a plausible usage pattern). For a single-user app with no ops team, "the database had an issue" with no backup means **irrecoverable loss of session history, invoice history, and student records** — this is real financial/business record data for the tutor, not disposable app state.

**Why it happens:**
Cheap/free hosted DB tiers optimize for "get started in dev fast," not "production data durability." Developers assume "managed database" implies backups are included, which is not a safe assumption at the free/hobby tier.

**How to avoid:**
- Explicitly check the chosen provider's backup policy at the tier you'll actually run on (not just "managed Postgres" marketing) before committing — confirm whether backups exist, retention window, and whether restore is self-service or requires a support ticket.
- If the chosen tier has no built-in backups, implement a simple scheduled export yourself: e.g., a small cron/scheduled function that runs `pg_dump` (or the DB's export equivalent) on a schedule (daily is plenty at this scale) and stores the dump somewhere durable (cheap object storage, or even emailing/uploading to a personal cloud drive) — this is a few hours of work for an app where the alternative is losing a business's entire invoice history.
- Periodically **test a restore**, not just confirm backups exist — an untested backup is not a verified backup.
- Given the data volume here is tiny (one tutor, a handful of students, a few sessions/week), don't over-engineer this: a daily automated dump to cheap storage is more than sufficient; there's no need for real-time replication or multi-region durability.

**Warning signs:**
- No documented answer to "if the DB provider has an incident tomorrow, what do we lose?"
- Provider's free-tier docs don't mention backups, or mention them only on paid plans.
- No scheduled export job exists anywhere in the deployment.

**Phase to address:**
Deployment/hosting phase — decide the DB provider and backup strategy together, before real student/session data accumulates. Retrofitting backups after months of unrecoverable data would already be too late if an incident happens first.

---

### Pitfall 7: Autocomplete and duplicate/similar student names cause mis-billing

**What goes wrong:**
Tutoring businesses commonly have siblings or students with the same or similar first names (two "Michael"s, "Emma S." and "Emma T."). If session logging autocomplete matches/stores by **name string** rather than a stable student ID, or if the dropdown doesn't show disambiguating info, the tutor can log a session against the wrong student — silently billing the wrong parent, or worse, merging two students' unbilled totals in her head because the dashboard shows an ambiguous name twice with no distinction.

**Why it happens:**
Name-based autocomplete is the easy first implementation; disambiguation (rate, grade, parent email fragment) is often skipped as "nice to have" until it causes a real mis-bill.

**How to avoid:**
- Session records reference the student by **stable ID**, never by name string — autocomplete resolves a typed name to an ID as early as possible in the flow.
- When two+ students share a name (exact or close match), the autocomplete dropdown must show a disambiguator — e.g., rate or parent email initial ("Michael — $40/hr — j.smith@…") — so selection is unambiguous even glancing quickly.
- Consider surfacing a soft warning when adding a new student whose name closely matches an existing one ("A student named Michael already exists — is this a different student?") to catch accidental duplicate creation (which fragments one real student's history across two records) as well as genuine same-name siblings.
- On the dashboard, list students in a way that never renders two rows with identical, unlabeled names.

**Warning signs:**
- Autocomplete component keys/filters on `student.name` rather than `student.id`.
- No secondary field shown in the dropdown besides the name.
- No duplicate-name detection at student creation.

**Phase to address:**
Student CRUD + session logging phase (autocomplete implementation) — cheap to build correctly the first time, annoying to retrofit once sessions already reference names ambiguously.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|--------------------|-----------------|------------------|
| Store money as float dollars instead of integer cents | Faster to prototype, "just a number" | Silent rounding drift in totals; expensive migration once invoices exist | Never — fix before first real invoice is generated |
| Invoice = live query over sessions (no snapshot) | Simpler schema, less code up front | Editing a billed session retroactively changes a "sent" invoice's numbers | Never for this project — snapshotting is a stated requirement (sessions stay editable) |
| No rate limiting on login | Saves an hour of work | App is a public brute-force target once deployed with a URL | Never — cheap to add, high value |
| Skip backup strategy at launch | Ship faster | Total, irrecoverable loss of business records on a DB incident | Only acceptable for the first few days before real data exists; must be resolved before she relies on it |
| mailto with no fallback/copy option | Simpler UI | Silent failures with no recovery path for a core workflow step | Acceptable only for a throwaway prototype, not for what she'll use weekly |
| Hard-delete students/sessions | Simpler CRUD | Breaks invoice history integrity if a billed student/session is deleted | Prefer soft-delete for anything referenced by an invoice snapshot; hard-delete is fine for never-billed records |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|------------------|-------------------|
| `mailto:` links | Treating it like a normal link with unbounded body text; using `escape()` instead of `encodeURIComponent` | Encode correctly, keep body compact, measure real-world worst-case length, provide a copy-to-clipboard fallback |
| Hosted Postgres free/hobby tier | Assuming "managed" implies backups are included | Read the specific tier's backup policy; add a scheduled `pg_dump`-style export if not included |
| Env-var-based shared password | Comparing plaintext with `===`, logging the raw password on failed-auth errors | Hash it, never log raw input, rate-limit the comparison endpoint |
| Zelle "instructions only" (no API) | Assuming payment status can be inferred/automated later without a design change | Keep payment marking manual/explicit (out of scope per PROJECT.md) — don't let a future feature assume Zelle webhooks exist |

## Performance Traps

Given this is a single-user app with a handful of students and modest session volume, classic scale traps (indexing, pagination, N+1 queries at volume) are **not** the primary risk here — call this out explicitly so the roadmap doesn't over-invest in performance work that doesn't matter at this scale.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Recomputing dashboard totals via full table scans on every page load | Noticeable lag if session history grows into the thousands over years | Simple indexed query on `billed = false` is more than sufficient at this scale; no caching layer needed | Realistically never at one tutor's data volume — don't build for it prematurely |
| N+1 queries fetching sessions per student on dashboard | Slower dashboard as student count grows | A single joined/aggregated query instead of per-student loop | Only matters past dozens of students; not a near-term concern here |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Plaintext password comparison | Password exposed via logs/error messages; no defense-in-depth | Hash the password, compare hashes, never log raw credentials |
| No login rate limiting | Brute-forceable over the public internet since the app is URL-accessible | Add attempt counter + lockout/backoff (e.g., 5 attempts / 15 min lockout) |
| Missing `Secure`/`HttpOnly`/`SameSite` on session cookie | Session hijacking via XSS or network sniffing | Set all three flags; use HTTPS-only hosting |
| No HTTPS enforcement | Credentials and student/financial data sent in clear text | Confirm hosting platform forces HTTPS; redirect HTTP to HTTPS explicitly if not automatic |
| Storing parent emails / financial data with no backup/access controls beyond the password gate | A single compromised session exposes all students' PII and billing history | Treat the shared password as the sole security boundary and harden it accordingly (this is *the* security surface of the entire app) |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| "Email invoice" button always enabled, even with no parent email on file | Confusing silent failure when clicked | Disable with a clear reason, link to fix the student record |
| Dashboard shows raw session list instead of per-student unbilled rollups | She has to mentally re-total what Excel used to total for her — defeats the purpose of replacing the spreadsheet | Dashboard's primary view is "who owes what," computed and displayed, not left as an exercise |
| No confirmation before marking sessions billed / generating invoice | Accidental invoice generation is hard to undo cleanly given the snapshot model | Show a preview (line items + total) before committing to "generate invoice," since generation is a one-way action (auto-marks billed) |
| Editing a billed session gives no indication it won't affect the already-sent invoice | She may think she's "fixed" an invoice that a parent already received, when she hasn't | Surface a small note when editing a billed session: "this won't change Invoice #N, already sent" |
| Ambiguous duplicate student names in dropdowns/lists | Wrong student billed | See Pitfall 7 — always show a disambiguator |

## "Looks Done But Isn't" Checklist

- [ ] **Invoice generation:** Often missing true snapshotting — verify that editing a billed session's hours/rate does NOT change a previously generated invoice's stored total when reopened.
- [ ] **Money math:** Often missing integer-cents storage — verify the schema uses integer cents (or DECIMAL) for rate/amount fields, not float/REAL, and that invoice totals equal the sum of displayed line items to the cent.
- [ ] **Email draft:** Often missing a fallback — verify there's a "copy invoice text" or equivalent path for when mailto fails (missing email, oversized body, client quirk).
- [ ] **Auth:** Often missing rate limiting — verify repeated wrong-password attempts get throttled/locked out, not just "wrong password, try again" with no limit.
- [ ] **Backups:** Often missing entirely — verify there's an actual export/backup happening on a schedule, not just "the provider probably backs this up."
- [ ] **Student autocomplete:** Often missing disambiguation — verify two same-named students are visually distinguishable in every dropdown/list, and sessions reference student ID not name.
- [ ] **Deleting billed sessions/students:** Often missing guardrails — verify deleting a student or session that's referenced by a generated invoice either is blocked or preserves the invoice snapshot correctly (soft-delete).
- [ ] **Missing parent email:** Often missing a UI signal — verify the invoice-send flow clearly communicates when a student has no email on file, rather than failing silently on click.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|-----------------|------------------|
| Float rounding drift discovered after invoices exist | MEDIUM | Migrate amount columns to integer cents; recompute historical invoice totals from stored line items (not by re-deriving from sessions, to avoid re-triggering Pitfall 2); spot-check against any invoices already emailed to parents to confirm no visible number changes |
| Invoice snapshot missing (built as live query) discovered after sessions have been edited post-billing | HIGH | Requires a schema change (add `invoice_line_items` snapshot table) and, if any billed-session edits already happened, manual reconciliation of what the "true" originally-sent total was (may need to check her email sent folder for what was actually emailed) |
| No rate limiting, and login endpoint shows signs of brute-force attempts in logs | LOW-MEDIUM | Add rate limiting immediately, rotate the shared password, review access logs for any successful unauthorized logins |
| Data loss from hosted DB incident with no backup | HIGH (potentially unrecoverable) | If provider has any snapshot/point-in-time feature even on a short window, use it immediately; otherwise, data is likely gone — this is why backup strategy must be in place before it's needed, not after |
| Duplicate/ambiguous student records discovered after sessions logged against the wrong one | MEDIUM | Manual data cleanup: merge session history onto the correct student ID, verify against any invoices already sent for accuracy before further billing |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|--------------------|----------------|
| Float money math | Data model / schema phase | Amount fields are integer cents (or DECIMAL with single explicit rounding point); invoice total = sum of stored line-item amounts, verified against manual calculator check |
| Billed session edit corrupts invoice | Invoice generation phase | Edit a billed session's hours after generating its invoice; confirm the invoice's stored total is unchanged when reopened |
| mailto truncation/failure | Email draft generation phase | Generate a draft for a student with a realistic max session count; confirm the client opens correctly and all content is present |
| mailto missing recipient | Email draft generation + student CRUD phases | Attempt to send an invoice for a student with no email on file; confirm the button is disabled/blocked with a clear message, not a silent broken draft |
| Insecure shared password | Auth gate phase | Attempt 10+ rapid wrong-password submissions; confirm lockout/backoff triggers; inspect cookie flags in devtools |
| Hosted DB data loss | Deployment/hosting phase | Confirm a scheduled backup/export job exists and has successfully produced at least one restorable dump before go-live |
| Duplicate/ambiguous student names | Student CRUD + session logging phase | Create two same-named students; confirm autocomplete/dropdown shows a disambiguator and sessions store student ID, not name |

## Sources

- [Bluejay Digital — Long URLs in mailto: links](https://bluejaydigital.com/long-urls-in-mailto-links-solved/) — mailto length limits by browser/client (MEDIUM confidence, single-source specifics but consistent with other results)
- [Growing with the Web — Getting around the mailto character limit](https://www.growingwiththeweb.com/2012/07/getting-around-mailto-character-limit.html) — corroborates ~2000 char practical URL ceiling and IE-specific ~512 char failure
- [Mozilla Bugzilla #370949](https://bugzilla.mozilla.org/show_bug.cgi?id=370949) — documented Thunderbird mailto length limitation (official bug tracker, HIGH confidence for the specific claim)
- [currency.js](https://currency.js.org/) and [Robin Wieruch — JavaScript Rounding Errors in Financial Applications](https://www.robinwieruch.de/javascript-rounding-errors/) — float/money handling guidance (MEDIUM-HIGH confidence, consistent with well-established IEEE 754 behavior)
- [evertpot.com — Floats and money](https://evertpot.com/currencies-floats/) — integer-cents storage recommendation, corroborated across multiple independent sources
- [Stavros' Stuff — Authentication and rate limiting](https://www.stavros.io/posts/authentication-and-rate-limiting/) — rate-limit threshold guidance for login endpoints (MEDIUM confidence, one practitioner's write-up but aligned with general industry practice)
- General bcrypt/rate-limiting best-practice search results (multiple sources) — cost-factor and lockout guidance (MEDIUM confidence, aggregated from several independent write-ups)
- Provider comparison search results (Neon, Supabase, Railway free-tier characteristics) — MEDIUM confidence; **re-verify exact backup policy directly against the chosen provider's current docs before final decision**, as free-tier terms change frequently
- [Zuora — Invoice Item Adjustments](https://knowledgecenter.zuora.com/Zuora_Billing/Bill_your_customers/Adjust_invoice_amounts/Invoice_Item_Adjustments/AA_Overview_of_Invoice_Item_Adjustments) — general pattern reference for adjusting finalized invoices without mutating the original (MEDIUM confidence, general industry pattern rather than this project's exact model)
- Project-specific reasoning: `.planning/PROJECT.md` (billed/unbilled state machine, shared-password auth, mailto-based email, hosted DB — all directly drive the pitfalls above)

---
*Pitfalls research for: single-user tutoring time-tracking + invoicing web app*
*Researched: 2026-07-03*
