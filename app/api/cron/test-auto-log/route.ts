// Test endpoint for cron auto-log (development only)
// This allows you to manually trigger the cron without waiting for Vercel's schedule
// Use: curl http://localhost:3000/api/cron/test-auto-log

import { runAutoLog } from "@/lib/schedule/auto-log";
import { runInvoiceCadence } from "@/lib/invoice/cadence";

export async function GET(req: Request) {
  // In production, this should be deleted or protected. For dev, it's open.
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "Not available in production" }, { status: 403 });
  }

  try {
    console.log("[test-cron] Starting test run...");

    const autoLog = await runAutoLog();
    console.log("[test-cron] Auto-log result:", autoLog);

    const cadence = await runInvoiceCadence();
    console.log("[test-cron] Invoice cadence result:", cadence);

    return Response.json({
      ok: true,
      message: "Test cron executed (check server logs for details)",
      autoLog,
      cadence,
    });
  } catch (error) {
    console.error("[test-cron] Error:", error);
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
