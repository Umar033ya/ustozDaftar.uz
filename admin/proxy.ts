import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "admin_session";

/**
 * Lightweight UX guard: if there is no session cookie at all, send the browser
 * to the login page immediately. This is NOT the security boundary — every
 * dashboard page and every admin API route re-verifies the session cookie (and
 * the admin custom claim) server-side in Node.js via the Firebase Admin SDK.
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/dashboard") && !req.cookies.has(SESSION_COOKIE)) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};