# Phase 3: Invoicing, Email & History - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-05
**Phase:** 3-invoicing-email-history
**Areas discussed:** Invoice text format, Generate-invoice flow, Template & Zelle instructions, History & mistake recovery

---

## Invoice text format

**Overall format**

| Option | Description | Selected |
|--------|-------------|----------|
| Itemized per session | Each session a line (date, duration, amount), then total | |
| Summary total only | Just session count, hours, amount due | |
| Itemized + session notes | Itemized lines with the session note appended per line | ✓ |

**User's choice:** Itemized + session notes
**Notes:** Flagged as a heads-up that this makes Phase 2 notes parent-facing (D-02).

**Header date info**

| Option | Description | Selected |
|--------|-------------|----------|
| Covered period range | Min–max date span of the billed sessions | ✓ |
| Generated date only | Just the "generated on" date | |
| Both | Period range + generated date | |

**User's choice:** Covered period range

**Invoice number**

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, number them | Sequential #001, #002 frozen into snapshot | |
| No, keep it plain | Identify by student + date in history | ✓ |

**User's choice:** No, keep it plain

---

## Generate-invoice flow

**Trigger location**

| Option | Description | Selected |
|--------|-------------|----------|
| From the Dashboard | Per-student "Generate invoice" button on the who-owes-what Dashboard | ✓ |
| Dedicated Invoices page | Separate tab to pick a student and generate | |
| Both places | Dashboard button + Invoices page | |

**User's choice:** From the Dashboard

**Confirm step (irreversible action)**

| Option | Description | Selected |
|--------|-------------|----------|
| Preview then confirm | Show rendered invoice text + "Generate & freeze" confirm | ✓ |
| Simple confirm dialog | Quick yes/no confirm, text seen after | |
| Generate immediately | One click, no confirm | |

**User's choice:** Preview then confirm

**After generating**

| Option | Description | Selected |
|--------|-------------|----------|
| On the new invoice | Land on finished invoice with Email + Copy buttons | ✓ |
| Back to Dashboard | Return to Dashboard, invoice saved to send later | |

**User's choice:** On the new invoice

---

## Template & Zelle instructions

**Email handoff mechanism** *(raised by user via "Other": "is there a way to open a gmail email to the parent with the message and all the user has to do is click send?")*

| Option | Description | Selected |
|--------|-------------|----------|
| Gmail compose | Gmail compose deep link, pre-filled, click Send | ✓ |
| Default mail app (mailto) | mailto: opens device default email app | |
| Both buttons | Gmail + mailto | |

**User's choice:** Gmail compose
**Notes:** Answered the user's freeform question in prose (Gmail compose deep link vs mailto, the ~2,000-char URL limit, and why the copy-text fallback exists), then confirmed Gmail as primary.

**Template scope**

| Option | Description | Selected |
|--------|-------------|----------|
| Full message, invoice slots in | Template is whole body with {invoice} placeholder | ✓ |
| Auto invoice + editable closing | App builds invoice; template is only the appended closing | |

**User's choice:** Full message, invoice slots in

**Subject line**

| Option | Description | Selected |
|--------|-------------|----------|
| Editable in Settings | Second template field for the subject | ✓ |
| Fixed auto subject | App generates it | |

**User's choice:** Editable in Settings

**Merge fields** (multiSelect)

| Option | Description | Selected |
|--------|-------------|----------|
| {student} name | Student's name | ✓ |
| {total} amount | Total due, $X.XX | ✓ |
| {zelle} handle | Zelle email/phone from Settings | ✓ |
| {period} range | Covered date span | ✓ |

**User's choice:** All four ({invoice} always included)

---

## History & mistake recovery

**History organization**

| Option | Description | Selected |
|--------|-------------|----------|
| Flat, newest first | One chronological list | ✓ |
| Grouped by student | Nested under each student | |
| Flat with student filter | Newest-first + filter | |

**User's choice:** Flat, newest first

**Re-open a past invoice**

| Option | Description | Selected |
|--------|-------------|----------|
| View + re-send/copy | Frozen snapshot + reusable Gmail draft/copy buttons | ✓ |
| View only | Read-only snapshot | |

**User's choice:** View + re-send/copy

**Mistake recovery**

| Option | Description | Selected |
|--------|-------------|----------|
| Void it → un-bills sessions | Grey/void the invoice, return sessions to unbilled | |
| Delete entirely + un-bill | Fully delete invoice, return sessions to unbilled | ✓ |
| No undo | Invoices permanent once generated | |

**User's choice:** Delete entirely + un-bill

---

## Claude's Discretion

- Default template body + default subject wording (ship editable defaults).
- Settings page layout; placement of Settings + History in the top nav.
- Zelle handle field: single free-text (email or phone), loose validation.
- Empty/edge states: $0-unbilled generate disabled/hidden, blank-note line omission, single-session period range.
- Exact "Delete invoice" confirm affordance and where it's reachable from.

## Deferred Ideas

- MAIL-04 ("no parent email" guard) is moot due to P1 D-13 (parent email required + unique) — reconcile in REQUIREMENTS.md; don't build the guard.
- Per-session cherry-picking at generate time — out of scope (ROADMAP locks "all unbilled"); potential v2 enhancement.
