import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

/**
 * Client-side Firebase (browser only). Uses the SAME public web-app config as
 * the existing UstozDaftar.uz frontend. Nothing here is secret.
 *
 * The app is initialized lazily so that missing environment variables never
 * crash a server-side render or the production build — the login page only
 * touches Firebase after the user interacts with it.
 */

const PLACEHOLDER_PATTERN = /^(placeholder|your_|your-|change_?me|xxx)/i;

function hasPlaceholder(value: string | undefined): boolean {
  return !value || PLACEHOLDER_PATTERN.test(String(value).trim());
}

export function getFirebaseConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

export function getFirebaseApp(): FirebaseApp {
  if (typeof window === "undefined") {
    throw new Error("Firebase web SDK is browser-only. Use lib/firebaseAdmin on the server.");
  }
  const config = getFirebaseConfig();
  if (hasPlaceholder(config.apiKey) || hasPlaceholder(config.projectId)) {
    throw new Error(
      "Firebase web konfiguratsiyasi to'ldirilmagan. /admin/.env.local faylida " +
        "NEXT_PUBLIC_FIREBASE_* qiymatlarini o'rnating."
    );
  }
  return getApps().length === 0 ? initializeApp(config) : getApps()[0];
}

export function getClientAuth(): Auth {
  return getAuth(getFirebaseApp());
}