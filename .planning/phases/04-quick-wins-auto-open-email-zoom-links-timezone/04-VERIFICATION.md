# Phase 4 Verification — Quick Wins (Auto-Open Email, Zoom Links & Timezone)

**Verdict: PASS** (goal-backward, source + live-DB assertions)
**Verified:** 2026-07-06
**Requirements:** MAIL-05, ZOOM-01, ZOOM-02, SET-03 — all delivered.

## Phase Goal

> Ship two low-risk wins immediately — generating an invoice auto-opens the email
> draft, and each student carries a Zoom link — and lay the scheduling foundation
> by capturing the tutor's local timezone.

## Gate Results

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | ✅ exit 0 |
| `npm run lint` | ✅ exit 0 |
| `npm run build` | ✅ compiled + 10/10 static pages |
| Working tree | ✅ clean, all commits landed |
| SUMMARY per plan | ✅ 04-01…04-04 all present |

## Requirement-by-Requirement

### MAIL-05 — auto-open email draft on generate ✅
- `generateInvoiceAction` returns `emailDraft {to,subject,body}` on success, `null` on every failure path (`lib/actions/invoices.ts`).
- `invoice-preview-dialog.tsx` grabs `window.open("", "_blank")` synchronously in the form `onSubmit` (no `preventDefault` — confirmed the only `preventDefault` occurrence is a code comment), then on success points the handle at `buildGmailComposeUrl(emailDraft)` unless over-length/blocked (closes it). Navigation to `/history/[id]` preserved.
- Fallbacks: over-length (`isGmailUrlTooLong`), missing draft, blocked/null handle, and error paths all close the handle — no orphan blank tab; error keeps the dialog open.

### ZOOM-01 — optional per-student Zoom link ✅
- Live DB: `students.zoom_link` (nullable varchar 512) — confirmed via `information_schema`.
- Optional http(s)-only validation (`lib/validation/student.ts`); scheme-less / `javascript:` / `ftp:` rejected (live parse test). Persisted `?? null` in add + edit actions. Editable/pre-filled in the student modal.

### ZOOM-02 — Zoom link surfaced as its own send action ✅
- `buildZoomEmailDraft` (fixed built-in message, no merge-token engine) + `SendZoomLinkButton` (new-tab Gmail compose anchor, returns `null` without a link) wired into the active-roster `renderActions`.
- Sent as its OWN email — never embedded in an invoice; `MERGE_FIELDS` unchanged (length 5, no `{zoom}`); archived page untouched.

### SET-03 — capture local timezone ✅
- Live DB: `settings.timezone` (nullable varchar 64) — confirmed.
- `US_TIMEZONES` shortlist + `isValidIanaTimeZone` (Intl RangeError probe). Optional IANA-validated field via `.extend()` (blank→undefined, bogus rejected — live parse test). Persisted in both upsert `values` and `set`.
- Settings `Select` defaults to `props.timezone ?? browser-detected` (detection via `useSyncExternalStore` — hydration-safe, lint-clean), injects a non-shortlist zone as an option, mirrors to a hidden `name="timezone"` input.
- **Capture-only confirmed:** no timezone-consuming calculation added anywhere this phase (Phase 5/6 are the consumers).

## Deviations (both auto-fixed, documented in plan SUMMARYs)

1. **04-02** — window-handle side effect moved from adjust-during-render into a `useEffect` (project `react-hooks/refs` forbids ref access during render). Behavior identical.
2. **04-04** — browser-zone default derived via `useSyncExternalStore` instead of a `useState(Intl…)` initializer, avoiding a hydration mismatch AND the `react-hooks/set-state-in-effect` lint rule. Strictly more correct.

Neither introduced scope creep; all acceptance criteria met.

## Human/UAT Checks Deferred to `/verify` (browser)

- Generate a normal-length invoice → Gmail draft tab opens with no blocker prompt while origin tab shows `/history/[id]`; force an over-length invoice → no draft tab, copy-first UI.
- Add a Zoom link → Send Zoom link appears and opens a new-tab draft; student without a link shows no button; bad URL rejected inline.
- Fresh settings row → Select shows browser-detected zone → pick America/Chicago → Save → reload persists.
