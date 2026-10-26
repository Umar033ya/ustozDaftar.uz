"use client";

import { authorizedFetch } from "./apiClient";

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
