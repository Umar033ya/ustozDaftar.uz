import type { BillingPeriod, PlanId } from "@/lib/types";

// Reused pricing/duration facts. Do NOT change prices — they must stay in sync
// with the existing frontend (PaymentRequestForm, PaymentModal, i18n).
export const PLAN_AMOUNTS: Record<"pro" | "max", Record<BillingPeriod, string>> = {
  pro: { monthly: "20,000", yearly: "180,000" },
  max: { monthly: "45,000", yearly: "480,000" },
};

export const PLAN_DURATION_DAYS: Record<"pro" | "max", Record<BillingPeriod, number>> = {
  pro: { monthly: 30, yearly: 365 },
  max: { monthly: 30, yearly: 365 },
};

export const PLANS: PlanId[] = ["free", "pro", "max"];

export const DAY_MS = 24 * 60 * 60 * 1000;

export function parseAmount(amount: string | undefined): number {
  if (!amount) return 0;
  const digits = String(amount).replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

export function isActivePlan(plan: PlanId, planExpiry?: number | null): boolean {
  if (plan === "free" || !plan) return false;
  return Boolean(planExpiry && planExpiry > Date.now());
}

export function subscriptionStatus(plan: PlanId, planExpiry?: number | null): "active" | "expired" | "none" {
  if (plan === "free" || !plan) return "none";
  return isActivePlan(plan, planExpiry) ? "active" : "expired";
}