import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { runAutoLog } from "@/lib/schedule/auto-log";
import { runInvoiceCadence } from "@/lib/invoice/cadence";

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

    return Response.json({ ok: true, autoLog, cadence });
  } catch {
    // Generic error — never leak internals.
    return Response.json({ ok: false, error: "auto-log failed" }, { status: 500 });
  }
}
