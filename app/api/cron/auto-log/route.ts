import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { runAutoLog } from "@/lib/schedule/auto-log";

// Node.js runtime (App Router default) — node:crypto + the Neon/Drizzle client
// require it; the Edge runtime must not be selected here. Never statically cache.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const result = await runAutoLog();
    return Response.json({ ok: true, ...result });
  } catch {
    // Generic error — never leak internals.
    return Response.json({ ok: false, error: "auto-log failed" }, { status: 500 });
  }
}
