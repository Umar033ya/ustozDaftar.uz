/**
 * Paid plan catalog. The server uses ONLY these numbers to decide how much a
 * payment must be and how long it extends a subscription; nothing the browser
 * sends can change an amount. Values match the prices already shown in the UI
 * (PaymentModal / subscriptionContext) and the durations used by admin approval.
 */
export const PAID_PLANS = {
  pro: { monthly: { amount: 20_000, days: 30 }, yearly: { amount: 180_000, days: 365 } },
  max: { monthly: { amount: 45_000, days: 30 }, yearly: { amount: 480_000, days: 365 } },
};

export const BILLING_PERIODS = ["monthly", "yearly"];

/** @returns {{ amount: number, days: number } | null} */
export function planOffer(plan, billingPeriod) {
  return PAID_PLANS[plan]?.[billingPeriod] ?? null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * New expiry after a successful payment. Renewing the same, still active plan
 * extends it from its current expiry; anything else starts today.
 */
export function extendedExpiry({ currentPlan, currentExpiry, plan, days, now }) {
  const stillActive = currentPlan === plan && typeof currentExpiry === "number" && currentExpiry > now;
  return (stillActive ? currentExpiry : now) + days * DAY_MS;
}
