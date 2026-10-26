// Module hooks for route-level tests: load the real route handlers (frontend
// JS and admin TS) under plain Node, with Firebase replaced by in-memory fakes.
// Import this file before importing any route.
import { registerHooks } from "node:module";
import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const FRONTEND = new URL("../../", import.meta.url);
const ADMIN = new URL("../../../admin/", import.meta.url);
const FAKE_FIREBASE_ADMIN = new URL("./fakeFirebaseAdmin.mjs", import.meta.url).href;
const FAKE_FIRESTORE = new URL("./fakeFirestoreModule.mjs", import.meta.url).href;
const EMPTY_MODULE = "data:text/javascript,export {}";

function aliasUrl(specifier, parentURL) {
  const root = parentURL?.startsWith(ADMIN.href) ? ADMIN : FRONTEND;
  for (const ext of ["", ".js", ".ts", ".tsx", ".jsx", ".mjs"]) {
    const url = new URL(specifier.slice(2) + ext, root);
    const file = fileURLToPath(url);
    if (existsSync(file) && statSync(file).isFile()) return url.href;
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: EMPTY_MODULE, shortCircuit: true };
    if (specifier === "firebase-admin/firestore") return { url: FAKE_FIRESTORE, shortCircuit: true };
    if (specifier === "@/lib/firebaseAdmin") return { url: FAKE_FIREBASE_ADMIN, shortCircuit: true };
    if (specifier === "next/server") return nextResolve("next/server.js", context);
    if (specifier.startsWith("@/")) {
      const url = aliasUrl(specifier, context.parentURL);
      if (url) return { url, shortCircuit: true };
    }
    const result = nextResolve(specifier, context);
    // paymentRuntime.js imports "../firebaseAdmin.js" relatively.
    if (result.url.endsWith("/frontend/lib/firebaseAdmin.js")) return { url: FAKE_FIREBASE_ADMIN, shortCircuit: true };
    return result;
  },
});
