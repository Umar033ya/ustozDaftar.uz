import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminAuth, hasAdminCredentials } from "@/lib/firebaseAdmin";

export const SESSION_COOKIE = "admin_session";
export const DEFAULT_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 kun

export interface AdminSessionUser {
  uid: string;
  email: string | null;
  name?: string | null;
}

function sessionMaxAgeSeconds(): number {
  const raw = process.env.ADMIN_SESSION_MAX_AGE_SECONDS;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SESSION_MAX_AGE_SECONDS;
}

export async function getSessionToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value;
}

function isAdminClaim(claims: Record<string, unknown> | undefined): boolean {
  return claims?.admin === true;
}

/** Verify the session cookie and require the server-assigned admin claim. */
export async function getSessionAdmin(): Promise<AdminSessionUser | null> {
  const token = await getSessionToken();
  if (!token) return null;

  try {
    // checkRevoked requires service-account credentials; enable it when they are
    // configured so revoked users/sessions are rejected immediately.
    const checkRevoked = hasAdminCredentials();
    const decoded = await getAdminAuth().verifySessionCookie(token, checkRevoked);
    if (!isAdminClaim(decoded)) return null;
    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      name: typeof decoded.name === "string" ? decoded.name : null,
    };
  } catch {
    return null;
  }
}

/**
 * For dashboard layouts/pages: redirects to /login when there is no valid admin
 * session. Never rely on the middleware — this is the real check.
 */
export async function requireAdminUser(): Promise<AdminSessionUser> {
  const admin = await getSessionAdmin();
  if (!admin) redirect("/login");
  return admin;
}

export { sessionMaxAgeSeconds };