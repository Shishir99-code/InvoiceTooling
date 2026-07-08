# Phase 7: Gmail SMTP Setup & Configuration

## Overview

Phase 7 enables bulk sending of invoices via your Gmail account using SMTP. Emails are sent directly from your Gmail address, keeping you in control of communication.

## Prerequisites

- Gmail account with 2-step verification enabled
- Gmail App Passwords support enabled (available for most Gmail accounts)

## Setup Steps

### 1. Enable Gmail App Password

1. Visit [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
2. If prompted, sign in to your Google account
3. Select "Mail" and "Windows (or your device)"
4. Google will generate a 16-character app password (format: `xxxx xxxx xxxx xxxx`)
5. Copy this password — you'll use it in Step 2

**Note:** This is different from your regular Gmail password. App passwords are specific to this application and can be revoked independently.

### 2. Set Up Email Delivery in App

1. Go to the **Settings** page in the app
2. Scroll to "Email Delivery" section
3. Enter your Gmail address in "Gmail Email" field
4. Paste your 16-character App Password (spaces will be removed automatically)
5. Click "Save & Verify"

The app will test the connection. If successful, you'll see "Verified ✓" status.

**If verification fails:**
- Double-check the App Password is correct (it's case-sensitive)
- Ensure 2-step verification is enabled on your Gmail account
- Try generating a new App Password at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)

### 3. Environment Variables (Production Only)

When deploying to production (Vercel):

1. In your Vercel project settings, add these environment variables to **Production**:
   - `ENCRYPTION_KEY` — encryption key for storing credentials securely
   
   To generate: `openssl rand -hex 16` (or use any 32-character random string)

2. Do **not** set `gmailAppPassword` or `gmailUserEmail` as env vars — store them via the Settings page in the app instead (encrypted in the database).

## Sending Invoices

1. Go to **Invoice History** page
2. Select one or more unsent invoices (checkboxes appear only when Gmail is verified)
3. Click "Send Selected"
4. Review the confirmation dialog (shows recipient emails)
5. Click "Send"
6. Wait for success/failure notification

Successfully sent invoices are marked as "Sent". Failed invoices show an error reason (e.g., "Gmail rate limited") and can be retried.

## Rate Limits

Gmail allows approximately **100 emails per day** via SMTP. This is sufficient for a single tutor managing a small roster.

If you hit the daily limit, you'll see: "Gmail rate limited — you can send ~100 emails/day. Try again tomorrow."

## Troubleshooting

### "Credential invalid or expired"

- Verify the App Password at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
- Regenerate a new App Password and update it in Settings

### "Network timeout"

- Check your internet connection
- Try again in a few moments

### "Parent email invalid or blocked by Gmail"

- The parent's email address may be malformed or on Gmail's spam list
- Verify the email address is correct in the Student record

### "Unable to reach Gmail servers"

- Gmail SMTP servers may be temporarily unavailable
- Wait a few minutes and try again

## Revoking Access

To stop sending emails via this app:

1. Go to **Settings** → "Email Delivery"
2. Click "Revoke" button (if credential is set)
3. Alternatively, revoke the app password at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)

## Security

- App Passwords are encrypted in the database using AES-256-CBC
- Passwords are never logged or displayed in plaintext
- Only the app owner (authenticated via the shared password) can view/modify email settings
- App Passwords are independent of your main Gmail password — you can revoke them without affecting your Gmail account

## Manual vs. Bulk Sending

Phase 7 adds **bulk sending** — you can send multiple invoices at once. This is still **manual** (you click "Send Selected"); there is no automatic sending. You retain full control over which invoices are sent and when.

If you need to resend a previously-sent invoice, you must first unmark it as sent (edit is not available in this version).
