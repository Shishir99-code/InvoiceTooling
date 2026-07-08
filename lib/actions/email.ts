"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { invoices, settings } from "@/lib/db/schema";
import { decryptAppPassword, sendInvoiceViaGmail } from "@/lib/mailer";

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
  // Validation
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

  if (!gmailVerified) {
    return {
      ok: false,
      sent: 0,
      failed: 0,
      error: "Gmail credential not verified. Set up email delivery in Settings first.",
    };
  }

  // Fetch invoice data
  const invoiceRows = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceIds[0]))
    .limit(invoiceIds.length);

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

  // Send each invoice with error isolation
  for (const invoice of invoiceRows) {
    try {
      // Defensive: skip already-sent invoices
      if (invoice.sent) {
        console.log(`Invoice ${invoice.id} already sent, skipping`);
        continue;
      }

      console.log(`Sending invoice ${invoice.id} to ${invoice.studentId}`);

      // Decrypt and send
      const result = await sendInvoiceViaGmail({
        invoice: {
          id: invoice.id,
          parentEmail: "", // Will need to fetch from student
          renderedSubject: invoice.renderedSubject,
          renderedBody: invoice.renderedBody,
        },
        gmailAppPassword,
        gmailUserEmail,
      });

      if (!result.ok) {
        results.failed++;
        results.errors?.push({
          invoiceId: invoice.id,
          recipientEmail: "unknown",
          error: result.error || "Unknown error",
        });
        console.warn(`Failed to send invoice ${invoice.id}: ${result.error}`);
        continue;
      }

      // Mark as sent
      await db.update(invoices).set({ sent: true }).where(eq(invoices.id, invoice.id));
      results.sent++;
      console.log(`Successfully sent invoice ${invoice.id}`);
    } catch (error) {
      results.failed++;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      results.errors?.push({
        invoiceId: invoice.id,
        recipientEmail: "unknown",
        error: errorMessage,
      });
      console.error(`Error sending invoice ${invoice.id}:`, error);
    }
  }

  // Revalidate pages
  revalidatePath("/history");
  revalidatePath("/dashboard");

  return results;
}
