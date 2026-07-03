# Phase 1: Foundation — Auth Gate & Student Roster - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-03
**Phase:** 1-foundation-auth-gate-student-roster
**Areas discussed:** Login & session feel, Student list display, Remove/archive behavior, Add/edit form UX

---

## Login & session feel

### Access model (raised after initial "no login" answer)

The user first answered several login questions with "no login is necessary… no
sign-in logic, no signing up." Claude clarified the distinction between an *account
system* (never planned) and a *single shared-password box* (needed because the app is
on a public URL), and re-asked.

| Option | Description | Selected |
|--------|-------------|----------|
| One password box | One shared secret per device, ~30-day memory, no accounts/signup; keeps data private | ✓ |
| Wide open, no gate | Anyone with the URL can view/edit everything | |
| Let me think / discuss | Talk through the tradeoff first | |

**User's choice:** One password box (recommended)
**Notes:** The user's original "no login" was a rejection of account/username/signup
flows, not of the single-password gate. Confirmed: keep the shared-password gate as
scoped; AUTH-01..04 stand.

### Session length

| Option | Description | Selected |
|--------|-------------|----------|
| 30 days | Log in ~monthly; best convenience | ✓ (implied by chosen access option "~30 days") |
| 7 days | Weekly re-login | |
| Until logout / very long | Effectively never asks again | |

**User's choice:** ~30 days per device (carried from the access-model option wording)
**Notes:** —

### Logout button

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, tucked away | Logout in a corner/menu | |
| No logout button | Skip it; own devices | ✓ |

**User's choice:** No logout button
**Notes:** —

### Rate-limit UX

| Option | Description | Selected |
|--------|-------------|----------|
| Friendly wait message | "Too many attempts — try again in a few minutes" | ✓ (Claude default) |
| Generic error only | "Incorrect password" with silent lockout | |

**User's choice:** Friendly wait message (Claude-defaulted; the user's original answer here was part of the "no login" response, later superseded by choosing the password gate)
**Notes:** —

### Redirect when already authenticated

| Option | Description | Selected |
|--------|-------------|----------|
| Straight to dashboard/roster | Auth'd visitors skip login | ✓ |
| Always show login first | Everyone sees password screen | |

**User's choice:** Straight to dashboard/roster (recommended)
**Notes:** —

---

## Student list display

| Option | Description | Selected |
|--------|-------------|----------|
| Name + rate + parent email | All three per row | ✓ |
| Name + rate | Email on edit screen | |
| Name only | Rate/email on edit screen | |

**User's choice:** Name + rate + parent email
**Notes:** —

### Rate input format

| Option | Description | Selected |
|--------|-------------|----------|
| Plain dollars '50' | Type 50 → $50.00; stored as cents | ✓ |
| Dollars with cents '50.00' | Always full amount | |

**User's choice:** Plain dollars, e.g. '50'
**Notes:** Stored as integer cents behind the scenes.

### Sort order

| Option | Description | Selected |
|--------|-------------|----------|
| Alphabetical by name | Predictable, easy to find | ✓ |
| Most recently added first | Newest at top | |

**User's choice:** Alphabetical by name

### Duplicate names

| Option | Description | Selected |
|--------|-------------|----------|
| Possible — allow duplicates | No blocking | ✓ |
| Warn me on duplicate | Gentle flag, still allowed | |
| Unlikely / don't care | Free text, move on | |

**User's choice:** Possible — allow duplicates

---

## Remove/archive behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Always archive (soft-hide) | Never erased; builds history-preserving machinery now | ✓ |
| Hard-delete in Phase 1, archive later | Delete now, add archive in Phase 2 | |

**User's choice:** Always archive (soft-hide)

### Archived visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — view/restore | Archived view + restore action | ✓ |
| One-way / hidden | No restore path in Phase 1 | |

**User's choice:** Yes — a way to view/restore

### Confirmation

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, quick confirm | "Archive [name]?" | ✓ |
| No confirm — instant with undo | Undo toast | |
| No confirm at all | One tap removes | |

**User's choice:** Yes, quick confirm

---

## Add/edit form UX

| Option | Description | Selected |
|--------|-------------|----------|
| Pop-up dialog over the list | Modal, stay on page | ✓ |
| Separate add/edit page | Dedicated page | |
| Inline in the list | Edit in row | |

**User's choice:** Pop-up dialog over the list

### Empty state (first login)

| Option | Description | Selected |
|--------|-------------|----------|
| Friendly prompt + Add button | Guides you in | ✓ |
| Empty list + Add button | Minimal | |

**User's choice:** Friendly prompt + Add button

### Parent email requirement (SPEC CHANGE)

The user first answered "require email." Claude flagged the conflict with STUD-01
(optional) and Phase 3 MAIL-04 (no-email fallback) and re-confirmed.

| Option | Description | Selected |
|--------|-------------|----------|
| Required — every student must have one | Can't save without valid email; overrides STUD-01, drops Phase 3 fallback | ✓ |
| Optional (matches current spec) | Save with just name + rate | |
| Required, but allow a 'no parent' case | Require, with an explicit opt-out | |

**User's choice:** Required — every student must have one
**Notes:** Deliberate spec change (D-13). Requires a follow-up ROADMAP.md /
REQUIREMENTS.md update; noted as a deferred follow-up in CONTEXT.md.

### Validation

| Option | Description | Selected |
|--------|-------------|----------|
| Inline error, block save | Field-level messages, block until fixed | ✓ |
| Prevent bad saves quietly | Disable Save, no explicit text | |

**User's choice:** Inline error, block save

---

## Claude's Discretion

- Exact rate-limit thresholds/window (attempt count + cooldown).
- Precise archived-view affordance and modal layout details.
- Session/cookie renewal mechanics (per iron-session).

## Deferred Ideas

- **ROADMAP.md / REQUIREMENTS.md update** to reflect the required-parent-email change
  (STUD-01 wording, Phase 1 success criterion, Phase 3 MAIL-04 reconsideration).
