import { computePlanChange, planOffer } from "../plans.js";

/**
 * Subscription payments through inPAY API v2 — SERVER SIDE ONLY.
 *
 * Collection `inpayPayments/{paymentId}` (written only by the Admin SDK; the
 * owner and admins may read through the security rules):
 *   uid, plan, billingPeriod, amount, currency, provider: "inpay", livemode,
 *   status, providerPaymentId, checkoutUrl, providerStatus,
 *   createdAt, updatedAt, paidAt, activatedAt,
 *   previousPlan, previousExpiry, creditMs, planExpiryAfter,
 *   refundedAt, refundedBy, errorCode
 *
 * status: creating -> pending -> success | failed | cancelled | expired | review
 *         success -> refunded (recorded by an admin; inPAY refunds are manual)
 *   review  = inPAY reported success but amount/currency/mode did not match;
 *             nothing is activated and an admin must check it.
 *   expired = unpaid after PENDING_TTL_MS; the payment is also cancelled at
 *             inPAY so its link can no longer be paid.
 *
 * Revenue counts only `success` payments with livemode === true.
 *
 * A subscription is extended only inside a Firestore transaction that first
 * checks `activatedAt`, so repeated webhooks, a webhook racing a status poll,
 * or a refreshed return page can never extend it twice.
 */

export const PAYMENTS_COLLECTION = "inpayPayments";
export const PENDING_TTL_MS = 24 * 60 * 60 * 1000;

export class PaymentValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "PaymentValidationError";
  }
}

/** inPAY v2 payment status -> our payment status. */
export function mapProviderStatus(providerStatus) {
  switch (String(providerStatus || "").toLowerCase()) {
    case "succeeded":
      return "success";
    case "failed":
      return "failed";
    case "canceled":
    case "cancelled":
      return "cancelled";
    default:
      // requires_payment_method, requires_action, processing, unknown
      return "pending";
  }
}

export function toMillis(value) {
  if (typeof value === "number") return value;
  if (value && typeof value.toMillis === "function") return value.toMillis();
  return null;
}

/** What the paying user may see about a payment. */
export function publicView(id, p) {
  return {
    id,
    status: p.status,
    plan: p.plan,
    billingPeriod: p.billingPeriod,
    amount: p.amount,
    livemode: p.livemode === true,
    planExpiry: p.planExpiryAfter ?? null,
    creditDays: p.creditMs ? Math.round((p.creditMs / 86_400_000) * 10) / 10 : 0,
    payUrl: p.status === "pending" ? p.checkoutUrl || null : null,
  };
}

/**
 * Apply a successful payment to the user's subscription exactly once.
 * Shared by inPAY payments and admin-approved manual transfers.
 *
 * @returns {Promise<object>} the stored payment fields after the transaction
 */
export async function activateOnce(db, paymentRef, { now, extra = {}, guard }) {
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(paymentRef);
    const p = snap.data();
    if (p.activatedAt) return { ...p, alreadyActivated: true };
    // Re-checked inside the transaction, e.g. "request is still pending".
    if (guard) guard(p);

    const userRef = db.collection("users").doc(p.uid);
    const userSnap = await tx.get(userRef);
    const user = userSnap.exists ? userSnap.data() : {};
    const previousExpiry = toMillis(user.planExpiry);
    const { planExpiry, creditMs } = computePlanChange({
      currentPlan: user.plan,
      currentExpiry: previousExpiry,
      plan: p.plan,
      days: planOffer(p.plan, p.billingPeriod).days,
      now,
    });

    tx.set(userRef, { plan: p.plan, planExpiry }, { merge: true });
    const update = {
      ...extra,
      activatedAt: now,
      previousPlan: user.plan || "free",
      previousExpiry: previousExpiry ?? null,
      creditMs,
      planExpiryAfter: planExpiry,
      updatedAt: now,
    };
    tx.update(paymentRef, update);
    return { ...p, ...update };
  });
}

/**
 * @param {{ db: import("firebase-admin/firestore").Firestore,
 *           inpay: ReturnType<import("./inpay.js").createInPayClient>,
 *           livemode: boolean,
 *           now?: () => number,
 *           log?: Pick<Console, "info" | "warn" | "error"> }} deps
 */
export function createPaymentService({ db, inpay, livemode, now = () => Date.now(), log = console }) {
  const payments = () => db.collection(PAYMENTS_COLLECTION);

  async function startPayment({ uid, plan, billingPeriod, baseUrl }) {
    const offer = planOffer(plan, billingPeriod);
    if (!offer) throw new PaymentValidationError("Noto'g'ri tarif yoki to'lov davri.");

    const ref = payments().doc();
    const createdAt = now();
    await ref.set({
      uid,
      plan,
      billingPeriod,
      amount: offer.amount,
      currency: "UZS",
      provider: "inpay",
      livemode,
      status: "creating",
      createdAt,
      updatedAt: createdAt,
    });

    try {
      const created = await inpay.createPayment({
        amount: offer.amount,
        description: `UstozDaftar ${plan.toUpperCase()} (${billingPeriod === "yearly" ? "1 yil" : "1 oy"})`,
        returnUrl: `${baseUrl}/dashboard/payment?pid=${ref.id}`,
        webhookUrl: `${baseUrl}/api/payments/inpay/webhook`,
        metadata: { payment_id: ref.id, plan, billing_period: billingPeriod },
        // Our own document id: a retried create can never produce two inPAY payments.
        idempotencyKey: `ustozdaftar-${ref.id}`,
      });
      if (created.livemode !== livemode) {
        throw new PaymentValidationError("inPAY rejimi server sozlamasiga mos emas.");
      }
      await ref.update({
        providerPaymentId: created.id,
        checkoutUrl: created.checkoutUrl,
        providerStatus: created.status,
        status: "pending",
        updatedAt: now(),
      });
      log.info("[payments] created", { paymentId: ref.id, plan, billingPeriod, livemode });
      return { paymentId: ref.id, payUrl: created.checkoutUrl };
    } catch (error) {
      await ref.update({ status: "failed", errorCode: error?.code || "create_failed", updatedAt: now() });
      throw error;
    }
  }

  async function markStatus(ref, p, status, providerStatus, extra = {}) {
    if (status !== p.status || providerStatus !== p.providerStatus || Object.keys(extra).length > 0) {
      await ref.update({ status, providerStatus, updatedAt: now(), ...extra });
    }
    return { ...p, status, providerStatus, ...extra };
  }

  /**
   * Ask inPAY for the real status and apply it. Safe to call any number of
   * times, from the webhook and from the status poll alike.
   * @returns {Promise<ReturnType<typeof publicView> | null>}
   */
  async function syncPayment(paymentId) {
    const ref = payments().doc(paymentId);
    const snap = await ref.get();
    if (!snap.exists) return null;
    const p = snap.data();
    if (p.activatedAt || !p.providerPaymentId || p.status === "refunded") return publicView(paymentId, p);

    let remote = await inpay.getPayment(p.providerPaymentId);
    let mapped = mapProviderStatus(remote.status);

    // Stale unpaid payment: cancel it at inPAY so it cannot be paid later.
    if (mapped === "pending" && now() - p.createdAt > PENDING_TTL_MS) {
      try {
        remote = await inpay.cancelPayment(p.providerPaymentId);
        mapped = mapProviderStatus(remote.status);
        if (mapped === "cancelled") return publicView(paymentId, await markStatus(ref, p, "expired", remote.status));
      } catch (error) {
        if (error?.code !== "invalid_state") throw error;
        remote = await inpay.getPayment(p.providerPaymentId); // it was paid meanwhile
        mapped = mapProviderStatus(remote.status);
      }
    }

    if (mapped === "success") {
      const mismatch =
        remote.amount !== p.amount ? "amount_mismatch" : remote.currency !== "UZS" ? "currency_mismatch" : remote.livemode !== p.livemode ? "mode_mismatch" : null;
      if (mismatch) {
        if (p.status !== "review") log.warn("[payments] not activated", { paymentId, reason: mismatch });
        return publicView(paymentId, await markStatus(ref, p, "review", remote.status, { errorCode: mismatch }));
      }
      const at = now();
      const activated = await activateOnce(db, ref, {
        now: at,
        extra: { status: "success", providerStatus: remote.status, paidAt: at },
      });
      if (!activated.alreadyActivated) log.info("[payments] activated", { paymentId, plan: p.plan, creditMs: activated.creditMs });
      return publicView(paymentId, activated);
    }

    return publicView(paymentId, await markStatus(ref, p, mapped, remote.status));
  }

  async function findPaymentIdByProviderId(providerPaymentId) {
    const result = await payments().where("providerPaymentId", "==", String(providerPaymentId)).limit(1).get();
    return result.empty ? null : result.docs[0].id;
  }

  /** @returns {Promise<boolean>} true when the payment exists and belongs to uid */
  async function isOwner(paymentId, uid) {
    const snap = await payments().doc(paymentId).get();
    return snap.exists && snap.data().uid === uid;
  }

  return { startPayment, syncPayment, findPaymentIdByProviderId, isOwner };
}

/**
 * Record that a successful payment was refunded outside the API (inPAY only
 * refunds through its dashboard/support). The payment leaves revenue; the
 * subscription is not changed automatically — the admin decides separately.
 */
export async function markRefunded(db, collection, id, { adminUid, now, note = "" }) {
  const ref = db.collection(collection).doc(id);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new PaymentValidationError("To'lov topilmadi.");
    const p = snap.data();
    const paid = collection === PAYMENTS_COLLECTION ? p.status === "success" : p.status === "approved";
    if (!paid) throw new PaymentValidationError("Faqat muvaffaqiyatli to'lovni qaytarilgan deb belgilash mumkin.");
    const update = { status: "refunded", refundedAt: now, refundedBy: adminUid, refundNote: String(note).slice(0, 300), updatedAt: now };
    tx.update(ref, update);
    return { ...p, ...update };
  });
}
