/**
 * Paid plan catalog. The server uses ONLY these numbers to decide how much a
 * payment must be and how long it extends a subscription; nothing the browser
 * sends can change an amount. Values match the prices already shown in the UI
 * (subscription page / subscriptionContext) and the durations used by admin approval.
 */
export const PAID_PLANS = {
  pro: { monthly: { amount: 20_000, days: 30 }, yearly: { amount: 180_000, days: 365 } },
  max: { monthly: { amount: 45_000, days: 30 }, yearly: { amount: 480_000, days: 365 } },
};

export const BILLING_PERIODS = ["monthly", "yearly"];

/** 180000 -> "180 000" (grouping with a regular space, independent of locale data). */
export function formatSom(amount) {
  return String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Whole-percent saving of the yearly price against twelve monthly payments. */
export function yearlySavingPercent(plan) {
  const p = PAID_PLANS[plan];
  return p ? Math.round((1 - p.yearly.amount / (p.monthly.amount * 12)) * 100) : 0;
}

/** @returns {{ amount: number, days: number } | null} */
export function planOffer(plan, billingPeriod) {
  if (!Object.hasOwn(PAID_PLANS, plan) || !Object.hasOwn(PAID_PLANS[plan], billingPeriod)) return null;
  return PAID_PLANS[plan][billingPeriod];
}

export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Value of one day of a plan, from its monthly price (so'm per day).
 * Free / unknown plans are worth nothing.
 */
export function dailyValue(plan) {
  const monthly = Object.hasOwn(PAID_PLANS, plan) ? PAID_PLANS[plan].monthly : null;
  return monthly ? monthly.amount / monthly.days : 0;
}

/**
 * Upgrade / renewal policy — "prorate by value".
 *
 * The unused time of the current plan keeps its money value and is converted
 * into time of the purchased plan at each plan's daily price:
 *
 *   credit = remaining time × dailyValue(current) / dailyValue(purchased)
 *   new expiry = now + purchased days + credit
 *
 * - Same plan: the ratio is 1, so a renewal simply stacks on the remaining time.
 * - Pro → Max: 10 unused Pro days (≈6 667 so'm) become ≈4.4 Max days.
 * - Max → Pro: unused Max time becomes proportionally more Pro time.
 * - Free or expired: no credit, the purchase starts now.
 *
 * Existing subscriptions are never touched until their owner pays again.
 *
 * @returns {{ planExpiry: number, creditMs: number }}
 */
export function computePlanChange({ currentPlan, currentExpiry, plan, days, now }) {
  const remainingMs = typeof currentExpiry === "number" && currentExpiry > now ? currentExpiry - now : 0;
  const target = dailyValue(plan);
  const creditMs = remainingMs > 0 && target > 0 ? Math.round((remainingMs * dailyValue(currentPlan)) / target) : 0;
  return { planExpiry: now + days * DAY_MS + creditMs, creditMs };
}

/** Kept for callers that only need the new expiry. */
export function extendedExpiry(args) {
  return computePlanChange(args).planExpiry;
}
