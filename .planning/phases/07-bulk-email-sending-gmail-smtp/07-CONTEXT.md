# Phase 7: Bulk Email Sending via Gmail SMTP

## Goal
Enable the tutor to send multiple invoices at once to different parents directly from the app using her own Gmail account, while maintaining the requirement that emails come from her email address (not an app-owned identity).

## Rationale
Current flow requires manually opening Gmail draft links one-by-one. With auto-generated invoices (Phase 6), she may have multiple invoices ready to send at once. Gmail SMTP allows:
- **Free**: No API cost (uses her Gmail account)
- **Sender identity preserved**: Emails send from her address, appear in her Sent folder
- **Bulk efficiency**: Send all ready invoices in one action
- **Automated**: No manual draft tab clicking

## Requirements

### BULK-01: Gmail Credential Storage & Management
- Settings page to set up Gmail App Password (one-time, encrypted storage)
- Ability to update/revoke the credential without losing other settings
- Never store actual Gmail password; App Passwords only (scope-limited)
- Secure encryption of credential at rest

### BULK-02: Bulk Send Invoice Selection UI
- Invoice history shows all "unsent" invoices by default
- Multi-select checkboxes on invoice rows (or select-all toggle)
- "Send Selected" button appears only when ≥1 invoice selected
- Confirmation dialog showing recipients and total count before send

### BULK-03: Bulk Send Server Action
- Atomically sends all selected invoices in parallel (or safely sequential)
- Reuses existing invoice's frozen `rendered_body`, `rendered_subject`, `parentEmail`
- Per-invoice error handling: one failure doesn't block others
- Marks successfully-sent invoices as sent; reports partial success

### BULK-04: Error Handling & Feedback
- Gmail SMTP rate limiting: ~100 emails/day, graceful fallback messaging
- Network timeouts, auth failures, invalid addresses caught per-invoice
- Toast/banner shows "X sent, Y failed" with detail view for failures
- Failed invoices remain unsent and can be retried

### BULK-05: Email Delivery Verification
- Verify SMTP connection on credential save (test send? or just connect test)
- Display whether Gmail auth is "configured", "verified", or "needs setup"
- Clear error messages if credential expires or is revoked

## Depends On
- Phase 6 (invoices must exist; uses existing invoice fields)
- Phase 3 (email/template system; invoice history UI)

## Success Criteria
1. Tutor can set Gmail App Password in Settings and see its verification status.
2. Tutor can select multiple unsent invoices and click "Send All" in one action.
3. All selected invoices send to their parent emails from her Gmail address.
4. If some fail, she sees which ones and can retry later.
5. Sent invoices are marked sent; history shows send status.

## Non-Goals (v1)
- Schedule automatic send (that's Phase 6 decision; user stays in control)
- Resend already-sent invoices (require explicit un-mark + resend)
- BCC/CC options (keep simple: to + subject + body only)
- Custom per-invoice email tweaks (send what's frozen in the invoice)
- Email logs (basic sent/failed status in invoice.sent flag is enough for v1)

## Tech Approach

### Gmail SMTP Setup
- User generates "App Password" in Gmail Security settings (documented flow)
- App stores encrypted in `settings.gmailAppPassword` (new column)
- Use `nodemailer` (npm package, small, battle-tested, free) to send via SMTP
- On credential save: test connect or simple verify to catch invalid early

### Schema Changes
- `settings.gmailAppPassword` (text, encrypted via `libsodium` or similar)
- `settings.gmailVerified` (boolean, true after successful test)
- No changes to invoices table (reuse existing frozen fields + sent flag)

### UI Changes
- Settings page: new "Email Delivery" section with App Password input + verify button
- Invoice History: multi-select checkboxes + "Send Selected" button (only if ≥1 selected)
- Confirmation dialog before send
- Toast with success/failure summary after send

### Server Actions
- `updateGmailCredential(appPassword)`: Encrypt, store, test, return verified status
- `sendBulkInvoices(invoiceIds[])`: Validate IDs, send all, return { sent, failed, errors }
- Helper: `sendInvoiceViaGmail(invoice, gmailCredential)`: Single invoice send

## Known Unknowns / Risks
1. **Gmail rate limiting**: ~100 emails/day via SMTP (sufficient for one tutor, but document it)
2. **Credential expiry**: App Passwords don't expire, but user can revoke → need clear error + re-setup prompt
3. **SMTP reliability**: Network glitches, Gmail auth failures → per-invoice retry strategy
4. **Encryption overhead**: Small key management cost, but necessary for credential security
5. **Testing**: Need to mock SMTP or use a test Gmail account; can't easily test in CI

## Phase Plan Structure

- **Wave 1 (Schema & Backend)**: Add `gmailAppPassword` + `gmailVerified` to settings, implement `sendInvoiceViaGmail` helper, `updateGmailCredential` action, `sendBulkInvoices` action
- **Wave 2 (Settings UI)**: Add "Email Delivery" settings section with App Password input, verify button, status display
- **Wave 3 (Invoice History UI)**: Add checkboxes, "Send Selected" button, confirmation dialog
- **Wave 4 (Polish & Error Handling)**: Test error paths, implement retry UI, add toast/banner messaging, documentation

---

## Locked Decisions (from user alignment)
- Use Gmail SMTP (free, sender identity preserved)
- App Passwords only (not plain Gmail password)
- Encrypted storage (no plaintext credential in DB)
- Reuse frozen invoice text (no per-send customization)
- Manual multi-select (not auto-send; user stays in control)
