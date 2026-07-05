---
phase: 02-session-logging-unbilled-dashboard
verified: 2026-07-05T16:10:42Z
status: gaps_found
score: 9/11 must-haves verified
overrides_applied: 0
gaps:
  - truth: "User can log a session by picking a student via name autocomplete (repeatable — the tutor's primary real-world workflow of logging several sessions in one sitting)"
    status: failed
    reason: "CR-01 (confirmed by direct code read, not just SUMMARY claim): addSessionAction and editSessionAction both return the exact same module-level constant object (initialSessionActionState, lib/actions/sessions.ts:15) on every successful save. SessionFormDialog's auto-close logic (components/session-form-dialog.tsx:93-99) decides whether to close the dialog by reference-inequality (`state !== prevState`). The 1st successful save closes the dialog correctly (new state object differs from the dialog's own initial literal). The 2nd and every subsequent successful save in the same mounted dialog instance returns the identical object reference as the 1st success, so `state !== prevState` is false and the dialog silently fails to close — even though the session WAS saved to the DB. Because the page-level 'Log Session' trigger and each row's 'Edit' trigger are long-lived component instances (not remounted between opens), this reproduces on the very next session logged/edited without a full page reload — i.e. on essentially every real usage session where the tutor logs more than one session at a sitting. Elevated risk: since the dialog appears to still be open/unsaved, a confused user re-clicking Save re-submits the still-populated form, risking an accidental duplicate session row."
    artifacts:
      - path: "lib/actions/sessions.ts"
        issue: "addSessionAction (line 83) and editSessionAction (line 124) both `return initialSessionActionState` — the same shared object reference — on success, instead of a fresh object literal."
      - path: "components/session-form-dialog.tsx"
        issue: "Lines 93-99 gate the dialog's auto-close on `state !== prevState` (reference identity), which cannot distinguish 'no new result yet' from 'a second identical-reference success just occurred'."
    missing:
      - "Change addSessionAction/editSessionAction to `return { fieldErrors: null };` (a fresh object literal) on every success path instead of the shared `initialSessionActionState` constant, OR change the dialog's close condition to something that doesn't depend on reference identity across repeated identical successes (e.g. a monotonically-incrementing success token/counter)."
      - "Note: lib/actions/students.ts has the identical latent defect (also flagged by 02-REVIEW.md CR-01) — out of this phase's file scope, but the same fix pattern should be applied there too when touched."
deferred: []
human_verification:
  - test: "Log two sessions back-to-back for the same (or different) student without reloading the page, using the page-header 'Log Session' trigger both times."
    expected: "The dialog should auto-close after each successful save. Per CR-01 this is expected to FAIL on the 2nd save — confirms the gap above in a live browser rather than by code reading alone."
    why_human: "Confirms the reference-identity bug's real-world effect (dialog staying open, risk of accidental resubmission) beyond static code analysis."
  - test: "Edit the same session twice in a row (open Edit, change a field, save; open Edit again on the same row, change a field, save) without reloading the page."
    expected: "Per CR-01, the 2nd edit's dialog should also fail to auto-close."
    why_human: "Same reference-identity defect applies to editSessionAction; confirms it reproduces for edit as well as add."
---

# Phase 2: Session Logging & Unbilled Dashboard Verification Report

**Phase Goal:** Tutor can log tutoring sessions against her students and see, at a glance, who owes what.
**Verified:** 2026-07-05T16:10:42Z
**Status:** gaps_found
**Re-verification:** No — initial verification

**Process note (MVP mode / user-story format):** ROADMAP.md marks this phase `Mode: mvp`, but the phase goal ("Tutor can log tutoring sessions against her students and see, at a glance, who owes what.") is written as a plain outcome statement, not the `As a [role], I want to [capability], so that [outcome].` user-story form referenced by the MVP-mode verification guard. The installed `gsd-tools` CLI in this environment does not expose a `query`/`user-story.validate` command to run the canonical format check programmatically. Rather than block verification entirely, this report proceeds with standard goal-backward verification against ROADMAP's explicit, already-testable Success Criteria (below) — informational only, not counted as a gap. If strict MVP user-story framing is required, run `/gsd mvp-phase 2` to reformat the goal and re-verify.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can log a session by selecting a student via name autocomplete, plus date and hours, with optional notes (ROADMAP SC1 / SESS-01/02) | ✗ FAILED | Single log operation works and persists correctly (`lib/actions/sessions.ts` insert verified), BUT the dialog fails to auto-close on the 2nd+ consecutive successful save in the same sitting — see gap CR-01 above. This is the phase's primary, most-repeated real-world workflow. |
| 2 | A logged session's amountCents is computed server-side as round(durationMinutes × the student's re-fetched rateCents / 60) — never from client input (SESS-05) | ✓ VERIFIED | `lib/actions/sessions.ts:57-70,96-107` re-fetches `students.rateCents` via `db.select().from(students).where(eq(students.id, ...))` in both add and edit, computes `Math.round((durationMinutes * rateCents) / 60)`. Grep confirms no `formData.get("amountCents"\|"rateCents")` anywhere in the file. |
| 3 | The Sessions page lists sessions grouped by student, collapsed by default, expandable to per-session rows (SESS-01/D-08) | ✓ VERIFIED | `components/session-table.tsx` groups by `studentId`, `useState`-driven disclosure defaults closed, 44px (`min-h-11`) header tap target, expanded content shows responsive table/card rows. `app/(app)/sessions/page.tsx` seeds one group per active student + archived students referenced by history (badge shown). |
| 4 | User can edit any session (student/date/length/notes) via the same modal pre-filled; amountCents is recomputed on save (SESS-03) | ⚠ VERIFIED with caveat | `editSessionAction` (`lib/actions/sessions.ts:86-125`) updates all fields and recomputes `amountCents` on every edit, not gated on `billed` status (matches plan's explicit spec). Same modal, pre-filled (`session-form-dialog.tsx:70-89`). Caveat: editing the *same* session twice in one sitting hits the identical CR-01 reference-identity defect as truth #1 (dialog fails to auto-close on the 2nd edit). A single edit works correctly. |
| 5 | User can delete any session via a confirm dialog, then it is hard-deleted and the list updates (SESS-04) | ✓ VERIFIED | `components/session-delete-confirm-dialog.tsx` renders "Delete this session?" + "cannot be undone" copy; form binds `deleteSessionAction.bind(null, sessionId)`; `deleteSessionAction` (`lib/actions/sessions.ts:129-139`) guards a positive-integer id then `db.delete(sessions).where(eq(sessions.id, sessionId))` (hard delete, not update) and revalidates both `/sessions` and `/dashboard`. Delete's close logic uses a plain `onSubmit` callback, not the buggy reference-identity pattern, so repeated deletes are unaffected by CR-01. |
| 6 | The `sessions` table exists in the Neon database with columns id, student_id, date, duration_minutes, amount_cents, notes, billed, created_at | ✓ VERIFIED | Live query against Neon: `to_regclass('public.sessions')` → `"sessions"`; `information_schema.columns` confirms all 8 columns with matching types (integer/date/text/boolean/timestamp). FK `sessions_student_id_students_id_fk` confirmed live with `confdeltype = 'r'` (restrict). |
| 7 | A top nav with three destinations (Students / Dashboard / Sessions) renders on every authenticated page; Archived stays nested under Students | ✓ VERIFIED | `components/top-nav.tsx` renders exactly 3 `NAV_ITEMS` (`/`, `/dashboard`, `/sessions`); Students tab is active for both `/` and `/archived`. `app/(app)/layout.tsx` renders `<TopNav />` above `{children}`; root `app/layout.tsx` has no `TopNav` reference. `app/(app)/page.tsx` still inlines the nested Students/Archived sub-tab pair. |
| 8 | Navigating to /dashboard and /sessions loads a page (heading visible) instead of 404; root `/` still serves the roster; `/login` has no top nav | ✓ VERIFIED | `app/page.tsx`/`app/archived/page.tsx` no longer exist (moved into `app/(app)/`); `npm run build` route manifest lists `○ /`, `○ /archived`, `○ /dashboard`, `○ /login`, `○ /sessions` all as valid static routes. `app/login/page.tsx` lives outside the `(app)` route group so it never gets `TopNav`. |
| 9 | Dashboard shows every ACTIVE student with their total unbilled hours and amount owed, sorted most-owed first, $0 shown (not hidden) at the bottom (DASH-01) | ✓ VERIFIED | `app/(app)/dashboard/page.tsx:24-35` — `leftJoin(sessions, ...)`, `where(eq(students.archived, false))`, `groupBy(students.id, students.name)`, `orderBy(desc(unbilledAmountExpr), asc(students.name))`. `coalesce(sum(...), 0)` guarantees $0 rows for no-session students. `components/dashboard-table.tsx` renders every row (no client filtering), de-emphasizing `$0` rows with `text-zinc-600` instead of hiding them. |
| 10 | Billed sessions are excluded from the unbilled hours/amount totals (DASH-02) | ✓ VERIFIED | Both `unbilledMinutesExpr`/`unbilledAmountExpr` use `sum(...) filter (where ${sessions.billed} = false)` — an aggregate FILTER, not an INNER JOIN or `WHERE sessions.billed = false` (which would incorrectly drop $0/billed-only students). Grep confirms `leftJoin` present and no `innerJoin(sessions` / `where(eq(sessions.billed` in the file. |
| 11 | Expanding a student on the Dashboard reveals their underlying unbilled sessions with a path to edit one; archived students never appear | ✓ VERIFIED | `components/dashboard-table.tsx` expands to a table/card list of `sessionsByStudentId[row.id]` (sourced from a `where(eq(sessions.billed, false))` query, unbilled-only) with a single `SessionFormDialog mode="edit"` action, no Delete. Roster query's `where(eq(students.archived, false))` guarantees archived students are absent from `dashboardRows` entirely. |

**Score:** 9/11 truths fully verified, 1 verified-with-caveat (same root cause as the failed truth), 1 failed.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/db/schema.ts` | `sessions` table, FK restrict | ✓ VERIFIED | Exists, matches columns; live in Neon with FK confirmed |
| `lib/format.ts` | `formatCents`, `formatDuration` | ✓ VERIFIED | Both exported, used across student-table/session-table/dashboard-table |
| `components/top-nav.tsx` | 3-item nav, active-link logic | ✓ VERIFIED | `usePathname()`-driven, Students active on `/`+`/archived` |
| `app/(app)/layout.tsx` | Route-group layout with TopNav | ✓ VERIFIED | Renders `<TopNav />` + `<main>` |
| `app/(app)/dashboard/page.tsx` | Aggregate query + rendering | ✓ VERIFIED | LEFT JOIN + FILTER aggregate, wired to `DashboardTable` |
| `app/(app)/sessions/page.tsx` | Data fetch + grouped table + Log Session | ✓ VERIFIED | Grouped by student, wired to `SessionTable`/`SessionFormDialog` |
| `lib/validation/session.ts` | `sessionFormSchema`, `SessionFormValues` | ✓ VERIFIED | Both exported, zod v4 `z.iso.date()`, coercions match plan |
| `lib/actions/sessions.ts` | add/edit/delete Server Actions | ⚠ WIRED BUT DEFECTIVE | Exists, exports all three actions, DB writes are correct — but see CR-01 gap (shared success-state reference breaks dialog auto-close) |
| `components/session-form-dialog.tsx` | Log/Edit Session modal | ⚠ WIRED BUT DEFECTIVE | Exists, submits correct FormData shape — but auto-close logic is the other half of the CR-01 defect |
| `components/student-combobox.tsx` | Student picker → id | ✓ VERIFIED | Resolves "Name — parent email"; `itemToStringLabel`+`itemToStringValue` both set (fixes a deviation noted in 02-02-SUMMARY) |
| `components/session-table.tsx` | Grouped, collapsible list | ✓ VERIFIED | Present, matches spec |
| `components/dashboard-table.tsx` | Expandable unbilled rows | ✓ VERIFIED | Present, matches spec |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `lib/db/schema.ts sessions.studentId` | `students.id` | `references()` onDelete restrict | ✓ WIRED | Confirmed live in Neon (`confdeltype='r'`) |
| `app/(app)/layout.tsx` | `components/top-nav.tsx` | import + render | ✓ WIRED | `<TopNav />` rendered in layout |
| `lib/actions/sessions.ts addSessionAction` | `students.rateCents` (DB re-fetch) | `db.select().from(students)` | ✓ WIRED | Confirmed at lines 57-60 and 96-99 |
| `components/session-form-dialog.tsx` | `addSessionAction`/`editSessionAction` | `useActionState` | ⚠ WIRED BUT DEFECTIVE | Wired correctly for data flow; the *result-driven UI behavior* (auto-close) is broken by CR-01 |
| `components/student-combobox.tsx` | hidden `studentId` input | value bound to selected id | ✓ WIRED | `<input type="hidden" name="studentId" value={selectedStudent?.id ?? ""} />` |
| `app/(app)/dashboard/page.tsx` | sessions aggregate (filter billed=false) | sql filter aggregate over leftJoin | ✓ WIRED | Confirmed `filter (where` present, no inner join/WHERE-billed |
| `components/dashboard-table.tsx` | `SessionFormDialog` (edit mode) | expanded-row Edit action | ✓ WIRED | Present, no Delete action (per spec) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `app/(app)/dashboard/page.tsx` → `DashboardTable` | `dashboardRows` | Live `leftJoin`+`groupBy`+`filter` query against Neon `sessions`/`students` | Yes — confirmed schema/FK live in Neon, query structure verified, prior SUMMARY documents a live-data smoke test (temp rows inserted/verified/removed) | ✓ FLOWING |
| `app/(app)/sessions/page.tsx` → `SessionTable` | `groups` | Live `leftJoin` query on `sessions`/`students`, grouped in JS | Yes — same live table, verified structurally and by 02-02's SUMMARY live-data smoke test | ✓ FLOWING |
| `components/session-form-dialog.tsx` | `state` (from `useActionState`) | `addSessionAction`/`editSessionAction` return value | Yes, DB write is real — but the *UI behavior driven by this state* (auto-close) is broken because both actions return an identical object reference on every success (CR-01) | ⚠ HOLLOW (control-flow, not data-value) — the underlying insert/update data is real and correct; the *signal* used to drive UI is not distinguishable between successive successes |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `sessions` table live in Neon with correct columns | `to_regclass('public.sessions')` + `information_schema.columns` query | `sessions` present; 8 columns match schema.ts exactly | ✓ PASS |
| FK `sessions.student_id → students.id` restrict | `pg_constraint` query on `sessions` | `sessions_student_id_students_id_fk`, `confdeltype='r'` | ✓ PASS |
| Typecheck clean | `npx tsc --noEmit` | Exit 0, no output | ✓ PASS |
| Build clean, all routes present | `npm run build` | Exit 0; route manifest lists `/`, `/archived`, `/dashboard`, `/login`, `/sessions` as static routes | ✓ PASS |
| No unresolved debt markers in phase-modified files | `grep -n -E "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` across all 14 phase-created/modified source files | No matches (2 false-positive hits are legitimate HTML `placeholder=` input attributes) | ✓ PASS |
| Repeated add-session dialog auto-close (CR-01 reproduction via static trace) | Code trace: `lib/actions/sessions.ts:15,83,124` + `components/session-form-dialog.tsx:93-99` | Confirmed both actions return the identical `initialSessionActionState` object reference on every success; dialog's `state !== prevState` reference check cannot detect the 2nd+ success | ✗ FAIL (matches 02-REVIEW.md CR-01 exactly) |

### Probe Execution

No `scripts/*/tests/probe-*.sh` files exist in this repository and none are referenced by the phase's PLAN/SUMMARY files. Step 7c: SKIPPED (no probes declared or found).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|--------------|-------------|--------------|--------|----------|
| SESS-01 | 02-01, 02-02 | Log a session via name autocomplete + date + hours | ⚠ PARTIALLY BLOCKED | Single-log path fully works; repeated-log path (the realistic usage pattern) breaks per CR-01 |
| SESS-02 | 02-02 | Optional notes on a session | ✓ SATISFIED | `notes` optional field present, bounded, persisted |
| SESS-03 | 02-02 | Edit any session's student/date/hours/notes at any time, including already-billed | ✓ SATISFIED (single-edit) / caveat on repeated edit of same row (CR-01) | `editSessionAction` not gated on `billed`; recomputes correctly |
| SESS-04 | 02-02 | Delete a session | ✓ SATISFIED | Hard delete confirmed, unaffected by CR-01 |
| SESS-05 | 02-01, 02-02 | Session amounts computed from hours × rate, integer cents | ✓ SATISFIED | `Math.round`, server-side re-fetch, no client-trusted money fields |
| DASH-01 | 02-03 | Each student's total unbilled hours + amount at a glance | ✓ SATISFIED | LEFT JOIN + GROUP BY aggregate, all active students shown |
| DASH-02 | 02-03 | Billed sessions excluded from unbilled totals | ✓ SATISFIED | Aggregate `FILTER (WHERE billed = false)`, confirmed no inner join / WHERE-billed shortcut |

No orphaned requirements — all 7 IDs mapped to this phase in REQUIREMENTS.md (`SESS-01..05`, `DASH-01..02`) are claimed by at least one plan's frontmatter `requirements` field.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `lib/actions/sessions.ts` | 15, 83, 124 | Shared module-level success-state object returned by reference on every save | 🛑 BLOCKER | CR-01 — breaks dialog auto-close on repeated logging/editing (see gap above) |
| `lib/actions/sessions.ts` | 45, 86, 129 | No auth/session re-check inside the Server Actions themselves (rely entirely on `middleware.ts`) | ⚠ WARNING | Defense-in-depth gap; CLAUDE.md itself calls out Server Actions as an independent network boundary. Middleware currently covers it (verified matcher denies all but `/login`), but a future middleware regression would have no second line of defense. |
| `lib/actions/sessions.ts` | 105-107 | `editSessionAction` recomputes `amountCents` from the *current* rate on every edit, even edits that only touch notes/date | ⚠ WARNING | Matches the plan's explicit spec ("amountCents is recomputed on save") but contradicts the schema's own D-14 "frozen snapshot" comment (`lib/db/schema.ts:19`) — if a student's rate changes, a typo-fix to a historical session's notes silently re-prices it. Design inconsistency worth a product decision, not a phase-blocking defect since it matches the written plan. |
| `lib/validation/session.ts` | 18-21 | `durationMinutes` validated only as a positive integer, no upper bound / 15-min increment enforcement matching the UI's 0-8h/15-min constraints | ⚠ WARNING | A crafted POST could submit an arbitrary large duration, producing an absurd `amountCents`. Server is the sole validation boundary per CLAUDE.md's own Server Actions guidance. |
| `components/session-form-dialog.tsx` | 82-89 | Local field state (`date`, `hours`, `minutes`, `selectedStudent`) not reset after a successful add | ⚠ WARNING | Next "Log Session" open is pre-filled with the previous session's student and date (not today) rather than resetting — silently easy to log against the wrong date. Compounds the CR-01 UX confusion. |
| `lib/actions/sessions.ts` | 111-120, 135 | `editSessionAction`/`deleteSessionAction` don't check affected-row count; a non-existent id silently "succeeds" | ℹ INFO | Low real-world likelihood (ids always come from real rendered rows) but no explicit `.returning()`/rowcount check |
| `app/(app)/sessions/page.tsx` | 47-48 | Dead defensive fallbacks (`?? "Unknown student"`, `?? false`) for a join that can never be null (NOT-NULL FK, restrict) | ℹ INFO | Harmless, just implies a nullability that can't occur |
| `app/(app)/dashboard/page.tsx` | 41 | Over-fetches unbilled sessions for archived students that are never rendered (only active students appear in `dashboardRows`) | ℹ INFO | Wasted work, not a correctness bug |

All items above (except the CR-01 blocker) were originally surfaced by `02-REVIEW.md` and independently re-confirmed by direct code reading during this verification, not taken on the review's word alone.

### Human Verification Required

### 1. Repeated Log Session in one sitting

**Test:** With the dev server running, open `/sessions`, click "Log Session," fill the form, save. Then click "Log Session" again (same page, no reload), fill a different session, save.
**Expected:** Both dialogs should auto-close on save. Per CR-01's code trace, the 2nd save is expected to leave the dialog open even though the session was saved.
**Why human:** Confirms the real-world UX impact (visible dialog staying open, risk of a confused user re-submitting) beyond the deterministic static-code trace already performed.

### 2. Repeated Edit of the same session

**Test:** Edit the same session twice in a row from the Sessions page (or Dashboard expanded row) without a page reload in between.
**Expected:** Both saves should auto-close the dialog. Per CR-01, the 2nd edit is expected to leave the dialog open.
**Why human:** Same underlying defect as #1, applied to the edit path — worth confirming the identical failure mode in a live browser.

### Gaps Summary

One BLOCKER gap: `CR-01` (originally surfaced by `02-REVIEW.md`, independently re-confirmed here by direct code inspection of `lib/actions/sessions.ts` and `components/session-form-dialog.tsx`) breaks the core, most-repeated real-world workflow this phase exists to deliver — logging (or editing) more than one session without reloading the page. The underlying data writes are correct (money math, FK integrity, revalidation all verified independently and separately from this defect), but the UI's success signal is broken because both `addSessionAction` and `editSessionAction` return the exact same shared object reference on every successful call, and the dialog's auto-close logic depends on that reference changing. This is a small, well-understood, single-root-cause fix (return a fresh object literal per call, e.g. `{ fieldErrors: null }`), but it is not cosmetic — it undermines the phase goal's practical usability and creates a real risk of accidental duplicate session rows from a confused re-click. All other Phase 2 must-haves (schema, nav, money integrity, delete, dashboard aggregate correctness, archived-student exclusion, $0 handling) are independently verified as fully working.
