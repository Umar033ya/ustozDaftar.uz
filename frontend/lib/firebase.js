import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const PLACEHOLDER_PATTERN = /^(placeholder|your_|your-|change_?me|xxx)/i;
const missingKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !value || PLACEHOLDER_PATTERN.test(String(value).trim()))
  .map(([key]) => key);

if (missingKeys.length > 0 && typeof window !== "undefined") {
  console.error(
    `[Firebase] Sozlama qiymatlari to'ldirilmagan yoki placeholder: ${missingKeys.join(", ")}. ` +
      "frontend/.env.local faylini haqiqiy Firebase loyihasi qiymatlari bilan to'ldiring."
  );
}

// Validate storage bucket format
if (firebaseConfig.storageBucket && typeof window !== "undefined") {
  const bucket = firebaseConfig.storageBucket;
  if (!bucket.includes("firebasestorage.com") && !bucket.includes("firebasestorage.app")) {
    console.warn(
      `[Firebase] Storage bucket format not standard: "${bucket}". ` +
      "Expected format: your-project.appspot.com or your-project.firebasestorage.app"
    );
  }
  console.log(`[Firebase] Storage bucket configured: ${bucket}`);
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
