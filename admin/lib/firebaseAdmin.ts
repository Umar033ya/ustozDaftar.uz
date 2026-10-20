import "server-only";

import { initializeApp, getApps, cert, type App, type AppOptions, type Credential } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * Firebase Admin SDK — SERVER ONLY.
 *
 * Never import this module from a client component: it is guarded by the
 * `server-only` package and must run on Node.js.
 *
 * Credentials strategy:
 *  1. `FIREBASE_SERVICE_ACCOUNT`   — full service-account JSON (single line).
 *  2. `GOOGLE_APPLICATION_CREDENTIALS` — path to a service-account JSON file.
 *  3. none                         — app works for ID-token verification only
 *     (Google's public signing keys). Privileged operations (session cookies,
 *     Admin Firestore, custom claims) then fail with a clear configuration
 *     error. This mirrors the existing frontend's firebaseAdmin.js.
 */

export class AdminConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminConfigError";
  }
}

export function hasAdminCredentials(): boolean {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS
  );
}

function loadCredential(): Credential | undefined {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (json) {
    try {
      return cert(JSON.parse(json));
    } catch {
      throw new AdminConfigError("FIREBASE_SERVICE_ACCOUNT yaroqli service-account JSON emas.");
    }
  }
  // GOOGLE_APPLICATION_CREDENTIALS (and GCP metadata server) are picked up
  // automatically by firebase-admin when no explicit credential is passed.
  return undefined;
}

export function getAdminApp(): App {
  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!projectId || projectId.startsWith("your_")) {
    throw new AdminConfigError(
      "Firebase loyiha identifikatori sozlanmagan. /admin/.env.local da NEXT_PUBLIC_FIREBASE_PROJECT_ID ni o'rnating."
    );
  }

  if (getApps().length > 0) return getApps()[0];

  const options: AppOptions = { projectId };
  const credential = loadCredential();
  if (credential) options.credential = credential;

  return initializeApp(options);
}

export function requireAdminCredentials(): void {
  if (!hasAdminCredentials()) {
    throw new AdminConfigError(
      "Admin server ma'lumotlari sozlanmagan. README dagi 'Firebase admin sozlamalari' bo'limiga qarang: " +
        "FIREBASE_SERVICE_ACCOUNT yoki GOOGLE_APPLICATION_CREDENTIALS o'rnating."
    );
  }
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function getAdminFirestore(): Firestore {
  requireAdminCredentials();
  return getFirestore(getAdminApp());
}