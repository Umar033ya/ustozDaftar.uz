// Replaces frontend/lib/firebaseAdmin.js and admin/lib/firebaseAdmin.ts in
// route-level tests. State lives on globalThis.__routeHarness:
//   db      in-memory Firestore (pathFirestore.mjs)
//   tokens  Map<idToken, { uid, email, admin? }>

const state = () => globalThis.__routeHarness;

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
export class ForbiddenError extends Error {
  constructor() {
    super("forbidden");
    this.name = "ForbiddenError";
  }
}
export class AdminConfigError extends Error {}

export const hasAdminCredentials = () => true;
export const requireAdminCredentials = () => {};
export const adminDb = () => state().db;
export const getAdminFirestore = () => state().db;
export const getAdminAuth = () => {
  throw new Error("Firebase Auth is not faked in route tests");
};

export function readBearerToken(request) {
  const match = /^Bearer[ \t]+(\S+)$/i.exec((request.headers.get("authorization") || "").trim());
  return match ? match[1] : "";
}

export async function requireAuth(request) {
  const user = state().tokens.get(readBearerToken(request));
  if (!user) throw new AuthError("invalid_token");
  return { uid: user.uid, email: user.email || null };
}

export async function requireAdmin(request) {
  const user = await requireAuth(request);
  if (state().tokens.get(readBearerToken(request)).admin !== true) throw new ForbiddenError();
  return user;
}
