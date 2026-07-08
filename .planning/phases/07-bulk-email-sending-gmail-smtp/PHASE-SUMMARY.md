# Phase 7: Bulk Email Sending via Gmail SMTP — Planning Summary

## Phase Overview

**Goal**: Enable bulk sending of multiple invoices at once directly from the app using Gmail SMTP, keeping sender identity as the tutor's own email address.

**Dependencies**: Phase 6 (invoices exist), Phase 3 (email/template system)

**Tech Stack**: 
- **Email library**: Nodemailer (free, zero dependencies)
- **Credential encryption**: Node.js built-in `crypto` module
- **Gmail SMTP**: `smtp.gmail.com:587` with App Passwords
- **UI components**: shadcn/ui (checkboxes, buttons, dialogs)

---

## Planned Waves (4 total)

### Wave 1: Schema & Backend Mailer (Foundation)
**Duration**: ~2 hours  
**Deliverable**: Encryption, SMTP sending, credential verification  
**Tasks**:
1. Add schema columns: `gmailAppPassword`, `gmailVerified`, `gmailLastError`
2. Implement encryption/decryption helpers
3. Build `sendInvoiceViaGmail` atomic sender
4. Build `updateGmailCredential` Server Action with verification
5. Setup environment variables

**Blocking**: Waves 2, 3, 4 depend on this

---

### Wave 2: Settings UI (Parallel with Wave 3)
**Duration**: ~1.5 hours  
**Deliverable**: User can set up Gmail App Password  
**Tasks**:
1. Add "Email Delivery" section to Settings page
2. Create form for App Password input
3. Verification status display (Not configured / Verified / Needs setup)
4. Revoke/update controls
5. Error handling for verification failures

**Blocking**: Wave 3 needs this to gate "Send" button

---

### Wave 3: Invoice History UI (Parallel with Wave 2)
**Duration**: ~2 hours  
**Deliverable**: Multi-select invoices, bulk send button  
**Tasks**:
1. Add checkboxes to invoice history table (only if Gmail verified)
2. Toolbar with selection count + "Send Selected" button
3. Confirmation dialog showing recipients before send
4. Result summary (X sent, Y failed)
5. Failed invoice details + retry option

**Blocked By**: Wave 1 (needs `sendBulkInvoices` from Wave 4)

---

### Wave 4: Server Action & Error Handling (Final)
**Duration**: ~1.5 hours  
**Deliverable**: Robust bulk send logic  
**Tasks**:
1. Implement `sendBulkInvoices` Server Action
2. Per-invoice error isolation (one failure ≠ stop all)
3. User-friendly error messages (rate limit, auth fail, etc.)
4. Defensive checks (no double-send, stale credentials, etc.)
5. Retry flow for failed invoices

**Dependencies**: All prior waves

---

## Timeline Estimate

| Wave | Duration | Parallelizable |
|------|----------|-----------------|
| 1    | 2 hours  | —               |
| 2    | 1.5 hrs  | ✓ (parallel w/ 3) |
| 3    | 2 hours  | ✓ (parallel w/ 2) |
| 4    | 1.5 hrs  | —               |
| **Total** | **~6.5 hours** | **Compress to ~5 hrs via parallelization** |

---

## Success Criteria (Verification)

1. ✓ Tutor can set Gmail App Password in Settings; verification shows "Verified ✓"
2. ✓ In Invoice History, can select multiple unsent invoices
3. ✓ "Send Selected" button opens confirmation dialog
4. ✓ After sending, parents receive emails from tutor's Gmail address
5. ✓ Successfully-sent invoices marked as sent; failures show error detail + retry option
6. ✓ If Gmail credential is revoked, user sees clear error + re-setup prompt
7. ✓ Rate limiting handled gracefully ("Gmail allows ~100/day; try tomorrow")

---

## Known Constraints & Limitations (v1)

- **Gmail rate limit**: ~100 emails/day via SMTP (sufficient for one tutor)
- **No auto-send yet**: Still manual click "Send Selected" (user stays in control per Phase 6 spec)
- **No email logs**: Basic "sent" flag only (no bounce tracking, open rates, etc.)
- **No resend already-sent**: Would require explicit un-mark + resend
- **App Password only**: Not plain Gmail password (security best practice)
- **Manual credential input**: No OAuth2 flow (simpler, no Google API required)

---

## Files to Create/Modify

### Create (New):
- `lib/mailer.ts` — Encryption, nodemailer transporter, send helper
- `lib/actions/email.ts` — `updateGmailCredential`, `sendBulkInvoices` actions
- `components/email-delivery-form.tsx` — Settings UI for Gmail setup
- `components/bulk-send-confirmation-dialog.tsx` — Confirmation before sending
- `.planning/phases/07-bulk-email-sending-gmail-smtp/SETUP.md` — User docs
- `04-PLAN.md`, `03-PLAN.md`, `02-PLAN.md`, `01-PLAN.md` — Detailed task breakdowns (already created)

### Modify (Existing):
- `lib/db/schema.ts` — Add 3 settings columns + migration
- `app/(app)/settings/page.tsx` — Add Email Delivery section
- `components/invoice-history-table.tsx` — Add checkboxes + "Send Selected" button
- `package.json` — Add `nodemailer` dependency
- `.env.example` — Document `ENCRYPTION_KEY`

### Dependencies to Install:
```bash
npm install nodemailer
npm install --save-dev @types/nodemailer  # TypeScript types
```

---

## Execution Approach

**Recommended order**:
1. **Execute Wave 1** (foundation) — all other waves blocked until this is done
2. **Execute Waves 2 & 3 in parallel** — independent, can run simultaneously
3. **Execute Wave 4** — integrates Waves 2 & 3, produces final bulk send flow

**GSD Execution**:
```bash
/gsd-execute-phase
```
(Will run plans sequentially with proper wave blocking)

---

## Ready to Execute?

Review the four PLAN.md files for detailed task breakdowns. Each plan includes:
- Specific files to create/modify
- Acceptance criteria
- Verification checklist
- Dependencies
- Rollback plan

**Proceed with `/gsd-execute-phase` to start Wave 1, or ask questions below.**
