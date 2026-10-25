import { adminDb, hasAdminCredentials } from "../firebaseAdmin.js";
import { createInPayClient, readInPayConfig } from "./inpay.js";
import { createPaymentService } from "./subscriptionPayments.js";

/**
 * Wires environment configuration to the payment service — SERVER SIDE ONLY.
 *
 * APP_BASE_URL is taken from configuration, never from the request's Host
 * header, so a forged header cannot redirect inPAY callbacks elsewhere.
 * The key prefix decides the mode: sk_test_ (sandbox) or sk_live_ (real money).
 */

let cached;

/** @returns {{ ok: true, service: ReturnType<typeof createPaymentService>, config: object, baseUrl: string } | { ok: false, missing: string[] }} */
export function paymentRuntime() {
  if (cached) return cached;

  const config = readInPayConfig();
  const baseUrl = (process.env.APP_BASE_URL || "").trim().replace(/\/+$/, "");
  const missing = [];
  if (!config.configured) missing.push("INPAY_SECRET_KEY (sk_test_… / sk_live_…)");
  if (!/^https?:\/\//.test(baseUrl)) missing.push("APP_BASE_URL");
  if (!hasAdminCredentials()) missing.push("FIREBASE_SERVICE_ACCOUNT");
  if (missing.length > 0) return { ok: false, missing };

  cached = {
    ok: true,
    config,
    baseUrl,
    service: createPaymentService({ db: adminDb(), inpay: createInPayClient(config), livemode: config.livemode }),
  };
  return cached;
}
