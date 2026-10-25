/**
 * Print a user's plan fields and their payment records from the LOCAL
 * emulator (refuses to run without the emulator host variables).
 *   node scripts/emulator-inspect.mjs teacher@test.local
 */
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error("Refusing to run: point FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST at the emulators.");
  process.exit(1);
}
const app = initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || "ustozdaftar-uz" });
const { uid } = await getAuth(app).getUserByEmail(process.argv[2]);
const db = getFirestore(app);
const user = (await db.doc(`users/${uid}`).get()).data() || {};
const payments = await db.collection("inpayPayments").where("uid", "==", uid).get();
console.log(
  JSON.stringify(
    {
      plan: user.plan ?? null,
      planExpiry: user.planExpiry ? new Date(user.planExpiry).toISOString() : null,
      payments: payments.docs.map((d) => ({ id: d.id, status: d.data().status, amount: d.data().amount, activatedAt: d.data().activatedAt ?? null })),
    },
    null,
    1
  )
);
process.exit(0);
