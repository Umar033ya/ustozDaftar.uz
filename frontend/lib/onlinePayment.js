"use client";

import { auth } from "./firebase";

/** Online payment is offered only when the deployment has inPAY configured. */
export const ONLINE_PAYMENT_ENABLED = process.env.NEXT_PUBLIC_INPAY_ENABLED === "true";

async function authorizedFetch(url, init = {}) {
  const user = auth.currentUser;
  if (!user) throw Object.assign(new Error("Tizimga qayta kiring."), { code: "unauthorized" });
  const token = await user.getIdToken();
  const response = await fetch(url, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw Object.assign(new Error(payload?.error || ""), { code: payload?.code || "http_error", status: response.status });
  }
  return payload;
}

/**
 * Ask the server to create an inPAY payment for a plan. Only the plan and the
 * billing period are sent; the server decides the amount.
 * @returns {Promise<{ paymentId: string, payUrl: string }>}
 */
export function createOnlinePayment(plan, billingPeriod) {
  return authorizedFetch("/api/payments/inpay/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan, billingPeriod }),
  });
}

/** Server-verified payment status. */
export function fetchPaymentStatus(paymentId) {
  return authorizedFetch(`/api/payments/inpay/status?pid=${encodeURIComponent(paymentId)}`);
}
