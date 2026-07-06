---
phase: 04-quick-wins-auto-open-email-zoom-links-timezone
plan: 02
subsystem: ui
tags: [react, server-actions, gmail, window-open, useActionState, useEffect]

requires:
  - phase: 03-invoicing-email-history
    provides: generateInvoiceAction, buildGmailComposeUrl, invoice-preview-dialog
provides:
  - "generateInvoiceAction returns emailDraft {to,subject,body} on success, null on failure"
  - "auto-opening Gmail compose draft in a new tab after Generate & Freeze (pop-up-blocker-safe)"
affects: [04-03-zoom-links, phase-05, phase-06]

tech-stack:
  added: []
  patterns:
    - "pop-up-safe post-action new tab: grab window.open('','_blank') handle synchronously in form onSubmit, redirect it after the Server Action resolves"
    - "ref side effects run in useEffect (not adjust-during-render) to satisfy react-hooks/refs"

key-files:
  created: []
  modified: [lib/actions/invoices.ts, components/invoice-preview-dialog.tsx]

key-decisions:
  - "Client builds the Gmail URL from emailDraft; the action never builds a URL or sends (sending stays client-side)"
  - "Split the submit-result reaction: navigation/close in adjust-during-render, window-handle redirect/close in a useEffect keyed on state"

patterns-established:
  - "MAIL-05 auto-open pattern reusable by any future post-Server-Action new-tab flow"

requirements-completed: [MAIL-05]

duration: 6min
completed: 2026-07-06
---

# Phase 4: Auto-Open Email Draft Summary

**Generate & Freeze now auto-opens the pre-filled Gmail compose draft in a new tab (pop-up-blocker-safe) while the tutor lands on /history/[id], with over-length/blocked/error fallbacks that never orphan a blank tab**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-07-06T17:07:20Z
- **Completed:** 2026-07-06T17:12:17Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `InvoiceActionState` gains `emailDraft: {to,subject,body} | null`; every failure path returns `null`, success returns the parent email + frozen subject/body.
- The preview dialog grabs a blank `window.open("", "_blank")` handle synchronously in the form `onSubmit` (no `preventDefault`), then redirects it to `buildGmailComposeUrl(emailDraft)` on success.
- Over-length (`isGmailUrlTooLong`), missing-draft, blocked/null-handle, and error paths all `close()` the handle — no orphan blank tab; error keeps the dialog open without navigating.
- tsc + lint + build all green.

## Task Commits

1. **Task 1: Widen generateInvoiceAction to return the email draft** - `4db681e` (feat)
2. **Task 2: Pop-up-safe auto-open in the preview dialog** - `1bdb1d2` (feat)

## Files Created/Modified
- `lib/actions/invoices.ts` - `emailDraft` added to state + every return path; DB batch CTE / revalidatePath / deleteInvoiceAction byte-for-byte unchanged.
- `components/invoice-preview-dialog.tsx` - `popupRef` + `handleSubmit` onSubmit; success/error reaction split between adjust-during-render (navigate) and a `useEffect` (window handle).

## Decisions Made
- Kept navigation in the existing adjust-during-render block and moved only the window-handle redirect/close into a `useEffect` — the cleanest split that satisfies both `react-hooks/refs` (no ref access during render) and `react-hooks/set-state-in-effect` (no setState in effect).

## Deviations from Plan

### Auto-fixed Issues

**1. [Lint gate — react-hooks/refs] Window-handle logic moved from adjust-during-render into a useEffect**
- **Found during:** Task 2 (Pop-up-safe auto-open)
- **Issue:** The plan specified pointing `popupRef.current.location` inside the adjust-during-render success branch, but the project's `react-hooks/refs` lint rule errors on any ref access during render (and `react-hooks/set-state-in-effect` errors if `setOpen` moves into the effect).
- **Fix:** Left the `setOpen(false); router.push(...)` navigation in the adjust-during-render block (setState during render is allowed) and moved only the ref redirect/close into a `useEffect` keyed on `state`. The handle is still grabbed synchronously in `handleSubmit` inside the click gesture, so pop-up-blocker safety is preserved.
- **Files modified:** components/invoice-preview-dialog.tsx
- **Verification:** `npx tsc --noEmit`, `npm run lint`, `npm run build` all exit 0.
- **Committed in:** `1bdb1d2` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 lint-gate compliance)
**Impact on plan:** Behavior identical to the plan's intent; all acceptance criteria met (onSubmit window.open without preventDefault, isGmailUrlTooLong checked before redirect, handle closed on too-long/error, router.push preserved). No scope creep.

## Issues Encountered
None beyond the lint-rule adjustment above.

## Next Phase Readiness
- The `buildGmailComposeUrl` + new-tab pattern is proven for Plan 04-03's Zoom send button (which uses a direct anchor, no window-handle dance needed).

---
*Phase: 04-quick-wins-auto-open-email-zoom-links-timezone*
*Completed: 2026-07-06*
