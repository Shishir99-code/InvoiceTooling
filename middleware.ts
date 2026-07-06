import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";

import { sessionOptions, type SessionData } from "@/lib/session";

// AUTH-03: single choke point. Deny-by-default via the matcher below — no
// route can opt out of this check by omission.
export async function middleware(request: NextRequest) {
  const session = await getIronSession<SessionData>(
    await cookies(),
    sessionOptions,
  );

  if (!session.isLoggedIn) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // D-02: renew the ~30-day rolling TTL on every authenticated request.
  await session.save();

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|api/cron|_next/static|_next/image|favicon.ico).*)"],
};
