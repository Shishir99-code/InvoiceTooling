# Spike: Auto-Send Emails on Monthly Invoice Generation

**Status**: Spike Complete — Ready for Build  
**Date**: 2026-07-08  
**Objective**: Validate feasibility of auto-sending invoices when invoices auto-generate via Phase 6 cadence

---

## Idea

Add optional "Auto-send invoices after generation" toggle to Settings. When enabled, the monthly invoice cadence (Phase 6 cron) automatically sends generated invoices via Gmail SMTP (Phase 7) without manual intervention.

---

## Key Questions Answered

### Q1: Can we hook into invoice generation flow without breaking Phase 6?
**Answer**: ✅ YES. 
- Phase 6 `runInvoiceCadence()` returns `{ generated, skipped, ranThisMonth }`
- We can modify it to also return `invoiceIds: number[]` of newly-generated invoices
- Hook in the cron route AFTER cadence completes, not inside it
- Error isolation: send failures don't rollback invoice generation

### Q2: Will Gmail credentials be available at cron time?
**Answer**: ✅ YES.
- Credentials stored in DB settings table (id=1)
- Cron is a Node.js runtime with full DB access
- Same as invoice generation cron - no constraints

### Q3: What if credentials are invalid/not configured when cron runs?
**Answer**: ✅ SAFE.
- Check `gmailVerified` flag before attempting send
- If not configured or verification failed, skip send but don't block invoice generation
- Log the failure for diagnostics
- User sees invoices as "Not sent yet" in Invoice History; can retry manually

### Q4: What about Gmail rate limiting (~100 emails/day)?
**Answer**: ✅ ACCEPTABLE.
- Single tutor, typically <100 students
- Auto-send once per month = at most 1 request per 30 days
- Rate limit rarely triggered unless manually sending same day
- If 454 rate limit hit, invoices still generated; user can retry next day

### Q5: Can we isolate auto-send errors from invoice generation?
**Answer**: ✅ YES.
- `sendBulkInvoices` already returns `{ ok, sent, failed, errors }`
- Cron logs results separately (send failures don't affect invoice state)
- No transactional coupling - invoice generation is independent of email sending

---

## Architecture

### New Setting
```sql
autoSendInvoices: boolean (default false)  -- Phase 6/7 integration toggle
```

### Modified Functions

#### `runInvoiceCadence()` (lib/invoice/cadence.ts)
**Before**: Returns `{ generated, skipped, ranThisMonth }`  
**After**: Returns `{ generated, skipped, ranThisMonth, invoiceIds: number[] }`

- Collect invoice IDs as they're generated
- Return them for caller to act on

#### Cron Route (app/api/cron/auto-log/route.ts)
**Before**:
```typescript
const cadence = await runInvoiceCadence();
return Response.json({ ok: true, autoLog, cadence });
```

**After**:
```typescript
const cadence = await runInvoiceCadence();

// Auto-send if enabled and invoices were generated
if (cadence.invoiceIds.length > 0) {
  const sendResult = await attemptAutoSendInvoices(cadence.invoiceIds);
  cadence.sendResult = sendResult;  // Log for diagnostics
}

return Response.json({ ok: true, autoLog, cadence, sendResult });
```

#### New Helper: `attemptAutoSendInvoices()` (lib/invoice/cadence.ts)
- Check `autoSendInvoices` setting
- Check `gmailVerified` status
- Call `sendBulkInvoices(invoiceIds)` if both true
- Catch errors, log, never throw
- Return send result for logging

### Settings UI Addition
- Add checkbox to Settings page: "Auto-send invoices to parents after monthly generation"
- Visual note: "Emails send from your Gmail account; must be verified in Email Delivery"
- Store in `settings.autoSendInvoices` boolean

---

## Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Gmail credentials invalid at cron time | Low | Medium | Check `gmailVerified` before send; skip if false |
| Send fails, invoices still generated | Low | Low | By design; user can retry manually; logs show details |
| Rate limit hit (100 emails/day) | Very Low | Low | Single tutor, monthly send; if hit, invoices still valid; user retries tomorrow |
| Cron route timeout extended | Low | Medium | Send errors don't block cron; log independently; set timeout > 30s |
| Backward compatibility break | None | — | Default is `autoSendInvoices = false` (opt-in); existing behavior unchanged |

**Overall Risk**: LOW. Send failures are isolated; invoice generation is the critical path and is unaffected.

---

## Implementation Checklist

### Phase 7 Enhancement (Small, Scoped)

- [ ] T1: Add `autoSendInvoices` column to settings table (boolean, default false)
- [ ] T2: Modify `runInvoiceCadence()` to return `invoiceIds: number[]`
- [ ] T3: Create `attemptAutoSendInvoices()` helper in lib/invoice/cadence.ts
- [ ] T4: Update cron route to call auto-send and log results
- [ ] T5: Add "Auto-send invoices" toggle to Settings page
- [ ] T6: Test: Generate invoices manually, verify auto-send works in dev
- [ ] T7: Test: Disable auto-send, verify invoices still generate without sending
- [ ] T8: Test: Invalid credentials, verify send is skipped gracefully
- [ ] T9: Commit with "feat(07-auto-send)" message

### Files to Change
- `lib/db/schema.ts` — Add `autoSendInvoices` column
- `lib/invoice/cadence.ts` — Modify return type, add attemptAutoSendInvoices()
- `app/api/cron/auto-log/route.ts` — Call auto-send after cadence
- `lib/actions/settings.ts` — Wire up autoSendInvoices in saveSettingsAction
- `components/settings-form.tsx` — Add checkbox UI
- Drizzle migration — One line (add column)

### Verification
- ✅ Build passes
- ✅ Settings toggle saves/loads
- ✅ Invoices generate normally with toggle off
- ✅ Invoices generate + send with toggle on (dev only, mock data)
- ✅ Send failure doesn't break cron
- ✅ cron response includes send result

---

## Go/No-Go Decision

**RECOMMENDATION**: ✅ **GO** — Proceed with build.

**Rationale**:
- Low risk (send errors isolated from invoice generation)
- High user value (full automation of invoice → email flow)
- Minimal scope (4 files, ~50 LOC changes)
- Leverages existing Phase 7 infrastructure
- Backward compatible (opt-in, default off)
- Can be built and tested in parallel with Phase 7 deployment

---

## Timeline Estimate

**Duration**: ~45 min  
**Complexity**: Low (mostly wiring existing pieces)  
**Dependencies**: Phase 7 must be complete (SMTP working, sendBulkInvoices available)

---

## Success Criteria

1. ✅ Toggle added to Settings (visible, saves/loads)
2. ✅ When enabled and invoices are auto-generated, emails are sent automatically
3. ✅ Invoices marked as "Sent" after auto-send succeeds
4. ✅ If Gmail not verified, auto-send is skipped (invoices still generated as "Not sent yet")
5. ✅ Send failures don't block invoice generation
6. ✅ Cron response logs send results
7. ✅ Backward compatible (toggle off = old behavior)

---

## Next Steps

Execute Phase 7.5 (Auto-Send Integration):
1. Run `/gsd-quick` with this spike plan
2. Implement 4-file changes
3. Test end-to-end
4. Commit with "feat(phase-7-auto-send)" prefix
5. Mark Phase 7 as fully complete (manual + auto-send both available)
