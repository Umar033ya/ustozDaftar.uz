import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

/**
 * Firebase Admin — SERVER SIDE ONLY.
 *
 * Only ever imported from `app/api/extract-students/route.js`. Nothing under
 * `app/` (client components) may import this module, so the Admin SDK and the
 * credentials it reads never reach a browser bundle.
 *
 * No service account private key is used or required. Verifying an ID token
 * only needs the project id: the SDK downloads Google's public signing
 * certificates over HTTPS, checks the JWT signature, then validates `aud`,
 * `iss`, `exp` and `sub` against the project. A private key would only be
 * needed for privileged access that bypasses Firestore security rules (Admin
 * Firestore reads/writes) or for `checkRevoked: true`, which calls the Identity
 * Toolkit with an OAuth2 token. This feature does neither — teachers keep
 * writing through the client SDK, exactly as before.
 */

let cachedAuth;

/**
 * @returns {import("firebase-admin/auth").Auth} the Admin auth instance
 * @throws when the project id is not configured
 */
function adminAuth() {
  if (cachedAuth) return cachedAuth;

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new ConfigError(
      "Firebase project id is not configured. Set FIREBASE_PROJECT_ID (or NEXT_PUBLIC_FIREBASE_PROJECT_ID)."
    );
  }

  // getApps() guard: Next.js can evaluate this module more than once per process.
  const app = getApps().length > 0 ? getApps()[0] : initializeApp({ projectId });
  cachedAuth = getAuth(app);
  return cachedAuth;
}

/** Thrown for every token that must produce an HTTP 401. */
export class AuthError extends Error {
  constructor(reason) {
    super(reason);
    this.name = "AuthError";
  }
}

export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConfigError";
  }
}

/**
 * Pull the raw JWT out of an `Authorization: Bearer <ID_TOKEN>` header.
 * @param {Request} request
 * @returns {string} the token, or "" when the header is missing/malformed
 */
export function readBearerToken(request) {
  const header = request.headers.get("authorization") || "";
  const match = /^Bearer[ \t]+(\S+)[ \t]*$/i.exec(header.trim());
  return match ? match[1] : "";
}

/**
 * Verify a Firebase ID token and return its claims.
 *
 * @param {Request} request
 * @returns {Promise<{ uid: string, email: string | null }>}
 * @throws {AuthError} when the header is absent or malformed, or the token is
 *   invalid, expired, or issued for a different project.
 */
export async function requireAuth(request) {
  const token = readBearerToken(request);
  if (!token) {
    throw new AuthError("missing_token");
  }

  try {
    // checkRevoked is intentionally left off: it needs a service-account
    // credential, and this app has no token-revocation flow. Expired and
    // invalid tokens are still rejected by the signature/claims validation.
    const decoded = await adminAuth().verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email || null };
  } catch (error) {
    // auth/id-token-expired, auth/invalid-id-token, auth/argument-error … all
    // mean the same thing to a caller: 401.
    throw new AuthError(error?.code || "invalid_token");
  }
}