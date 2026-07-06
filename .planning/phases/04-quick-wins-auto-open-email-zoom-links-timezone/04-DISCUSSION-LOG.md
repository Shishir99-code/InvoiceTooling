# Phase 4: Quick Wins — Auto-Open Email, Zoom Links & Timezone - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-06
**Phase:** 4-quick-wins-auto-open-email-zoom-links-timezone
**Areas discussed:** Auto-open email behavior, Zoom link surfacing, Zoom link input rules, Timezone input UX

---

## Auto-Open Email Behavior (MAIL-05)

| Option | Description | Selected |
|--------|-------------|----------|
| New tab, stay on invoice | Gmail draft opens in a new tab; tutor stays on the frozen invoice page so Copy/re-send stay one click away. Over-length invoices skip auto-open and land on the invoice with the existing copy nudge. Pop-up-blocker-safe. | ✓ |
| Same tab (go to Gmail) | Current tab navigates straight to Gmail compose; leaves the invoice page and loses the Copy fallback. | |

**User's choice:** New tab, stay on invoice
**Notes:** Requires the pop-up-safe pattern (grab window handle in the Generate click gesture, redirect after the action resolves). Manual "Email Invoice" button stays for re-send.

---

## Zoom Link Surfacing (ZOOM-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Both invoice token + your views | Add {zoom} merge token to invoices AND show in session/student views. | |
| Invoice {zoom} token only | Surface only via {zoom} token in invoice emails. | |
| Your views only (not invoices) | Show in session/student views, not exposed to parents. | |
| **Other (free text)** | "Should be a separate zoom link send button in a separate email" | ✓ |

**User's choice:** (Other) A dedicated "Send Zoom link" button that opens its own separate email — not baked into the invoice.

**Follow-up round — separate-email flow:**

| Sub-decision | Chosen |
|--------------|--------|
| Button location | On each student in the roster |
| Email content | Simple fixed built-in message + link (no editable Settings template) |
| Keep {zoom} in invoices too? | No — separate email only; invoice templates unchanged (5 merge fields) |

**Notes:** Tutor treats the class Zoom link as a separate parent communication from billing. Reuses the invoice Gmail-compose + copy-fallback machinery.

---

## Zoom Link Input Rules (ZOOM-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Optional, loose URL check | Optional per student; if present must look like a URL; blank allowed. | ✓ |
| Optional, any text | Optional, no format validation. | |
| Required for every student | Zoom link mandatory like parent email. | |

**User's choice:** Optional, loose URL check
**Notes:** New nullable `zoomLink` column; field added to the existing student modal. {zoom}/link renders empty gracefully when blank.

---

## Timezone Input UX (SET-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-detect + US shortlist | Prefill browser-detected IANA zone as default; override from a short US-timezone list. | ✓ |
| US-timezone dropdown only | Manual pick from common US timezones, no auto-detect. | |
| Full searchable IANA list | Searchable combobox of all ~400 IANA zones. | |

**User's choice:** Auto-detect + US shortlist
**Notes:** Stored as an IANA string in Settings. Phase 4 only captures it; consumed by Phases 5/6.

---

## Claude's Discretion

- Exact wording of the built-in Zoom-link email subject + body.
- Exact US-timezone shortlist entries + the Settings control type.
- Disabled-vs-hidden treatment of the "Send Zoom link" button when no link is set.
- Field placement within the student modal and Settings form.
- Precise React mechanism for the pop-up-safe auto-open (pending researcher confirmation).
- Zoom link normalization (trim, scheme coercion vs reject).

## Deferred Ideas

- Editable Zoom-email template in Settings (v1.1 ships a fixed message).
- `{zoom}` merge token inside invoices (dropped in favor of separate send).
- Zoom-API auto-created meetings (ZOOM-API-01, v2).
- Consuming the timezone — Phases 5 (class-day) and 6 (cadence) are the actual consumers.
