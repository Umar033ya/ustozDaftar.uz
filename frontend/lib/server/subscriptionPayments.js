import { extendedExpiry, planOffer } from "../plans.js";

/**
 * Subscription payments through inPAY — SERVER SIDE ONLY.
 *
 * Collection `inpayPayments/{paymentId}` (written only by the Admin SDK; the
 * owner may read their own documents through the security rules):
 *   uid, plan, billingPeriod, amount, currency, status, orderId, payUrl,
 *   providerStatus, createdAt, updatedAt, activatedAt, planExpiryAfter, errorCode
 *
 * status: creating -> pending -> success | failed | cancelled | expired | review
 *   review  = inPAY reported success but the amount did not match the plan
 *             price; nothing is activated and an admin must check it.
 *   expired = still unpaid after PENDING_TTL_MS. If inPAY later reports the
 *             payment as successful it is still activated: the money was paid.
 *
 * A subscription is extended only inside a Firestore transaction that first
 * checks `activatedAt`, so webhooks delivered twice, a webhook racing a status
 * poll, or a user refreshing the return page can never extend it twice.
 */

export const PAYMENTS_COLLECTION = "inpayPayments";
export const PENDING_TTL_MS = 24 * 60 * 60 * 1000;

export class PaymentValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "PaymentValidationError";
  }
}

/** inPAY transaction status -> our payment status. */
export function mapProviderStatus(providerStatus) {
  switch (String(providerStatus || "").toLowerCase()) {
    case "success":
    case "paid":
      return "success";
    case "failed":
    case "error":
      return "failed";
    case "cancelled":
    case "canceled":
      return "cancelled";
    default:
      return "pending";
  }
}

function toMillis(value) {
  if (typeof value === "number") return value;
  if (value && typeof value.toMillis === "function") return value.toMillis();
  return null;
}

/** What the browser is allowed to see about a payment. */
export function publicView(id, p) {
  return {
    id,
    status: p.status,
    plan: p.plan,
    billingPeriod: p.billingPeriod,
    amount: p.amount,
    planExpiry: p.planExpiryAfter ?? null,
    payUrl: p.status === "pending" ? p.payUrl || null : null,
  };
}

/**
 * @param {{ db: import("firebase-admin/firestore").Firestore,
 *           inpay: ReturnType<import("./inpay.js").createInPayClient>,
 *           now?: () => number,
 *           log?: Pick<Console, "info" | "warn" | "error"> }} deps
 */
export function createPaymentService({ db, inpay, now = () => Date.now(), log = console }) {
  const payments = () => db.collection(PAYMENTS_COLLECTION);

  async function startPayment({ uid, plan, billingPeriod, baseUrl, clientIp }) {
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
      status: "creating",
      createdAt,
      updatedAt: createdAt,
    });

    try {
      const { orderId, payUrl } = await inpay.createPayment({
        amount: offer.amount,
        description: `UstozDaftar ${plan.toUpperCase()} (${billingPeriod === "yearly" ? "1 yil" : "1 oy"})`,
        callbackUrl: `${baseUrl}/api/payments/inpay/webhook`,
        returnUrl: `${baseUrl}/dashboard/payment?pid=${ref.id}`,
        clientIp,
      });
      await ref.update({ orderId, payUrl, status: "pending", updatedAt: now() });
      log.info("[payments] created", { paymentId: ref.id, plan, billingPeriod });
      return { paymentId: ref.id, payUrl };
    } catch (error) {
      await ref.update({ status: "failed", errorCode: error?.code || "CREATE_FAILED", updatedAt: now() });
      throw error;
    }
  }

  async function activate(ref, providerStatus) {
    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const p = snap.data();
      if (p.activatedAt) return { ...p, alreadyActivated: true };

      const userRef = db.collection("users").doc(p.uid);
      const userSnap = await tx.get(userRef);
      const user = userSnap.exists ? userSnap.data() : {};
      const at = now();
      const planExpiry = extendedExpiry({
        currentPlan: user.plan,
        currentExpiry: toMillis(user.planExpiry),
        plan: p.plan,
        days: planOffer(p.plan, p.billingPeriod).days,
        now: at,
      });

      tx.set(userRef, { plan: p.plan, planExpiry }, { merge: true });
      const update = { status: "success", providerStatus, activatedAt: at, planExpiryAfter: planExpiry, updatedAt: at };
      tx.update(ref, update);
      return { ...p, ...update };
    });
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
    if (p.activatedAt || !p.orderId) return publicView(paymentId, p);

    const tx = await inpay.getTransaction(p.orderId);
    const mapped = mapProviderStatus(tx.status);

    if (mapped === "success") {
      if (Math.round(tx.amount) < p.amount) {
        if (p.status !== "review") {
          await ref.update({ status: "review", providerStatus: tx.status, errorCode: "AMOUNT_MISMATCH", updatedAt: now() });
          log.warn("[payments] amount mismatch, not activated", { paymentId, expected: p.amount, received: tx.amount });
        }
        return publicView(paymentId, { ...p, status: "review" });
      }
      const activated = await activate(ref, tx.status);
      if (!activated.alreadyActivated) log.info("[payments] activated", { paymentId, plan: p.plan });
      return publicView(paymentId, activated);
    }

    const status = mapped === "pending" && now() - p.createdAt > PENDING_TTL_MS ? "expired" : mapped;
    if (status !== p.status || tx.status !== p.providerStatus) {
      await ref.update({ status, providerStatus: tx.status, updatedAt: now() });
    }
    return publicView(paymentId, { ...p, status });
  }

  async function findPaymentIdByOrderId(orderId) {
    const result = await payments().where("orderId", "==", String(orderId)).limit(1).get();
    return result.empty ? null : result.docs[0].id;
  }

  /** @returns {Promise<boolean>} true when the payment exists and belongs to uid */
  async function isOwner(paymentId, uid) {
    const snap = await payments().doc(paymentId).get();
    return snap.exists && snap.data().uid === uid;
  }

  return { startPayment, syncPayment, findPaymentIdByOrderId, isOwner };
}
