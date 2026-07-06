import { timingSafeEqual } from "node:crypto";

// Constant-time bearer check for the cron route (SC4). Mirrors the APP_PASSWORD
// discipline in lib/actions/auth.ts: the secret lives only in env, never in
// code, and the compare short-circuits on length before timingSafeEqual (which
// throws on unequal-length buffers). Fails closed when CRON_SECRET is unset.
export function isAuthorizedCronRequest(req: Request): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) return false; // fail closed

  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;

  if (header.length !== expected.length) return false;

  return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}
