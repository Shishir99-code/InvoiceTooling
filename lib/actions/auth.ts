"use server";

import { timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ipAddress } from "@vercel/functions";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { loginAttempts } from "@/lib/db/schema";
import { getSession } from "@/lib/session";

// Claude's Discretion (CONTEXT.md) — sensible defaults for a single low-traffic user.
const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes

export interface LoginActionState {
  error: string | null;
}

export async function loginAction(
  _prevState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  // AUTH-04 first: derive a stable rate-limit key before touching the password at all.
  // ipAddress() (not NextRequest.ip, which is removed/unreliable) with a non-null
  // fallback so a lookup failure can't collapse every request onto a shared bucket
  // in a way that silently bypasses the limiter (RESEARCH Assumption A2).
  const hdrs = await headers();
  const ip = ipAddress(hdrs) ?? "unknown";

  const [existing] = await db
    .select()
    .from(loginAttempts)
    .where(eq(loginAttempts.ipAddress, ip));

  if (existing?.lockedUntil && existing.lockedUntil > new Date()) {
    return { error: "Too many attempts — try again in a few minutes." };
  }

  const submitted = formData.get("password")?.toString() ?? "";
  const expected = process.env.APP_PASSWORD ?? "";

  const submittedBuffer = Buffer.from(submitted);
  const expectedBuffer = Buffer.from(expected);

  // Never compare with `===` — constant-time compare requires equal-length buffers,
  // so the length check must happen first (short-circuits before timingSafeEqual).
  const isValid =
    submittedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(submittedBuffer, expectedBuffer);

  if (!isValid) {
    const failedCount = (existing?.failedCount ?? 0) + 1;
    const lockedUntil =
      failedCount >= MAX_ATTEMPTS ? new Date(Date.now() + COOLDOWN_MS) : null;

    await db
      .insert(loginAttempts)
      .values({ ipAddress: ip, failedCount, lockedUntil })
      .onConflictDoUpdate({
        target: loginAttempts.ipAddress,
        set: { failedCount, lockedUntil },
      });

    return { error: "Incorrect password." };
  }

  // Success — reset this IP's counter and establish the session.
  await db.delete(loginAttempts).where(eq(loginAttempts.ipAddress, ip));

  const session = await getSession();
  session.isLoggedIn = true;
  await session.save();

  redirect("/");
}
