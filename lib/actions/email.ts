"use server";

import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { invoices, students, settings } from "@/lib/db/schema";
import { sendInvoiceViaGmail } from "@/lib/mailer";

export interface BulkSendResult {
  ok: boolean;
  sent: number;
  failed: number;
  error?: string;
  errors?: Array<{
    invoiceId: number;
    recipientEmail: string;
    error: string;
  }>;
}

export async function sendBulkInvoices(invoiceIds: number[]): Promise<BulkSendResult> {
  console.log(`Starting bulk send for ${invoiceIds.length} invoices`);

  // Validation: non-empty array of positive integers
  if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
    return {
      ok: false,
      sent: 0,
      failed: 0,
      error: "No invoices selected",
    };
  }

  if (!invoiceIds.every((id) => Number.isInteger(id) && id > 0)) {
    return {
      ok: false,
      sent: 0,
      failed: 0,
      error: "Invalid invoice IDs",
    };
  }

  // Fetch Gmail credential from settings
  const settingsRow = await db
    .select({
      gmailAppPassword: settings.gmailAppPassword,
      gmailUserEmail: settings.gmailUserEmail,
      gmailVerified: settings.gmailVerified,
    })
    .from(settings)
    .where(eq(settings.id, 1))
    .limit(1);

  if (settingsRow.length === 0 || !settingsRow[0].gmailAppPassword || !settingsRow[0].gmailUserEmail) {
    return {
      ok: false,
      sent: 0,
      failed: 0,
      error: "No Gmail credential found. Set up email delivery in Settings first.",
    };
  }

  const { gmailAppPassword, gmailUserEmail, gmailVerified } = settingsRow[0];

  // Defensive check: verify credential is marked verified
  if (!gmailVerified) {
    return {
      ok: false,
      sent: 0,
      failed: 0,
      error: "Gmail credential not verified. Set up email delivery in Settings first.",
    };
  }

  // Fetch invoice data with student info (for parent email)
  const invoiceRows = await db
    .select({
      id: invoices.id,
      studentId: invoices.studentId,
      parentEmail: students.parentEmail,
      renderedSubject: invoices.renderedSubject,
      renderedBody: invoices.renderedBody,
      sent: invoices.sent,
    })
    .from(invoices)
    .leftJoin(students, eq(invoices.studentId, students.id))
    .where(inArray(invoices.id, invoiceIds));

  if (invoiceRows.length === 0) {
    return {
      ok: false,
      sent: 0,
      failed: 0,
      error: "Invoices not found",
    };
  }

  const results: BulkSendResult = {
    ok: true,
    sent: 0,
    failed: 0,
    errors: [],
  };

  // Send each invoice with per-invoice error isolation (one failure doesn't block others)
  for (const invoice of invoiceRows) {
    try {
      // Defensive: no double-send
      if (invoice.sent) {
        console.log(`Invoice ${invoice.id} already marked sent, skipping`);
        continue;
      }

      // Defensive: validate parent email format (basic check)
      if (!invoice.parentEmail || !invoice.parentEmail.includes("@")) {
        results.failed++;
        results.errors?.push({
          invoiceId: invoice.id,
          recipientEmail: invoice.parentEmail || "unknown",
          error: "Parent email invalid or missing",
        });
        console.warn(`Invoice ${invoice.id}: Invalid parent email "${invoice.parentEmail}"`);
        continue;
      }

      console.log(`Sending invoice ${invoice.id} to ${invoice.parentEmail}`);

      // Send via Gmail
      const sendResult = await sendInvoiceViaGmail({
        invoice: {
          id: invoice.id,
          parentEmail: invoice.parentEmail,
          renderedSubject: invoice.renderedSubject,
          renderedBody: invoice.renderedBody,
        },
        gmailAppPassword,
        gmailUserEmail,
      });

      if (!sendResult.ok) {
        results.failed++;
        results.errors?.push({
          invoiceId: invoice.id,
          recipientEmail: invoice.parentEmail,
          error: sendResult.error || "Unknown error",
        });
        console.warn(`Failed to send invoice ${invoice.id}: ${sendResult.error}`);
        continue;
      }

      // Mark as sent (only if send succeeded)
      await db
        .update(invoices)
        .set({ sent: true })
        .where(eq(invoices.id, invoice.id));

      results.sent++;
      console.log(`Successfully sent invoice ${invoice.id} to ${invoice.parentEmail}`);
    } catch (error) {
      results.failed++;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      results.errors?.push({
        invoiceId: invoice.id,
        recipientEmail: invoice.parentEmail || "unknown",
        error: errorMessage,
      });
      console.error(`Error sending invoice ${invoice.id}:`, error);
    }
  }

  console.log(`Bulk send complete: ${results.sent} sent, ${results.failed} failed`);

  // Revalidate pages to reflect sent status changes
  revalidatePath("/history");
  revalidatePath("/dashboard");

  return results;
}
