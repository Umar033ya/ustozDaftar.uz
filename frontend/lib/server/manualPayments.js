import { planOffer } from "../plans.js";
import { activateOnce, PaymentValidationError } from "./subscriptionPayments.js";

/**
 * Manual card-transfer requests (`paymentRequests`), approved by an admin.
 * SERVER SIDE ONLY — moved here from the browser so approval uses the same
 * prorated, exactly-once activation as inPAY payments and can read the user's
 * current plan (admins cannot read user documents through the rules).
 */

export const REQUESTS_COLLECTION = "paymentRequests";

/** "20,000" / "20 000" / 20000 -> 20000 */
export function parseAmount(value) {
  if (typeof value === "number") return Math.round(value);
  const digits = String(value ?? "").replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

export async function approveRequest(db, requestId, { adminUid, now }) {
  const ref = db.collection(REQUESTS_COLLECTION).doc(requestId);
  const snap = await ref.get();
  if (!snap.exists) throw new PaymentValidationError("So'rov topilmadi.");
  const r = snap.data();
  if (r.uid === adminUid) throw new PaymentValidationError("O'z so'rovingizni tasdiqlay olmaysiz.");
  if (r.activatedAt) return { ...r, alreadyActivated: true };
  if (r.status !== "pending") throw new PaymentValidationError("So'rov allaqachon ko'rib chiqilgan.");
  if (!planOffer(r.plan, r.billingPeriod)) throw new PaymentValidationError("So'rovdagi tarif noto'g'ri.");

  // activateOnce re-reads the request inside the transaction and stops if it
  // was already activated, so two admins clicking at once cannot double-extend.
  return activateOnce(db, ref, {
    now,
    guard: (current) => {
      if (current.status !== "pending") throw new PaymentValidationError("So'rov allaqachon ko'rib chiqilgan.");
    },
    extra: {
      status: "approved",
      processedAt: now,
      processedBy: adminUid,
      // Revenue uses the server price list, never the amount typed in the browser;
      // the admin has checked that this amount actually arrived.
      amountValue: planOffer(r.plan, r.billingPeriod).amount,
      claimedAmount: parseAmount(r.amount),
      provider: "manual",
    },
  });
}

export async function rejectRequest(db, requestId, { adminUid, now }) {
  const ref = db.collection(REQUESTS_COLLECTION).doc(requestId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new PaymentValidationError("So'rov topilmadi.");
    const r = snap.data();
    if (r.uid === adminUid) throw new PaymentValidationError("O'z so'rovingizni rad eta olmaysiz.");
    if (r.status !== "pending") throw new PaymentValidationError("So'rov allaqachon ko'rib chiqilgan.");
    tx.update(ref, { status: "rejected", processedAt: now, processedBy: adminUid });
    return { ...r, status: "rejected" };
  });
}
