import { eq } from "drizzle-orm";

import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { runAutoLog } from "@/lib/schedule/auto-log";
import { runInvoiceCadence } from "@/lib/invoice/cadence";
import { sendBulkInvoices } from "@/lib/actions/email";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";

// Node.js runtime (App Router default) — node:crypto + the Neon/Drizzle client
// require it; the Edge runtime must not be selected here. Never statically cache.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    // Run auto-log FIRST so today's scheduled sessions exist as billable sessions
    // before the cadence checks for unbilled sessions (F4 ordering).
    const autoLog = await runAutoLog();

    // Then run the monthly invoice cadence. The HWM guarantees at most one run per
    // calendar month, so a late/skipped daily run self-heals but never double-fires.
    const cadence = await runInvoiceCadence();

    // Attempt auto-send if invoices were generated and auto-send is enabled.
    // Send failures don't affect invoice generation (error isolation).
    let sendResult: {
      ok: boolean;
      error?: string;
      sent?: number;
      failed?: number;
    } = { ok: true };
    if (cadence.invoiceIds.length > 0) {
      try {
        // Check if auto-send is enabled and Gmail is verified
        const [settingsRow] = await db
          .select({
            autoSendInvoices: settings.autoSendInvoices,
            gmailVerified: settings.gmailVerified,
          })
          .from(settings)
          .where(eq(settings.id, 1));

        if (settingsRow?.autoSendInvoices && settingsRow.gmailVerified) {
          console.log(
            `[cron auto-send] Attempting to send ${cadence.invoiceIds.length} invoices`,
          );
          sendResult = await sendBulkInvoices(cadence.invoiceIds);
          console.log(
            `[cron auto-send] Complete: ${sendResult.ok ? "success" : "failed"}`,
          );
        } else if (settingsRow?.autoSendInvoices && !settingsRow.gmailVerified) {
          console.log(
            "[cron auto-send] Auto-send enabled but Gmail not verified, skipping",
          );
          sendResult = {
            ok: true,
            error: "Gmail not verified",
          };
        } else {
          console.log("[cron auto-send] Auto-send disabled, skipping");
        }
      } catch (error) {
        console.error("[cron auto-send] Exception:", error);
        sendResult = {
          ok: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }

    return Response.json({ ok: true, autoLog, cadence, sendResult });
  } catch {
    // Generic error — never leak internals.
    return Response.json({ ok: false, error: "auto-log failed" }, { status: 500 });
  }
}
