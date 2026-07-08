// Test endpoint for cron auto-log
// This allows you to manually trigger the cron without waiting for Vercel's schedule
// Requires CRON_SECRET for authentication in production
// Use: curl http://localhost:3000/api/cron/test-auto-log
// Or: curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-vercel-url/api/cron/test-auto-log

import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { runAutoLog } from "@/lib/schedule/auto-log";
import { runInvoiceCadence } from "@/lib/invoice/cadence";

export async function GET(req: Request) {
  // In production, require CRON_SECRET. In dev, allow open access.
  if (process.env.NODE_ENV === "production" && !isAuthorizedCronRequest(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
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
