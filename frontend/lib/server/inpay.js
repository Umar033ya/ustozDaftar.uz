import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * inPAY API v2 client — SERVER SIDE ONLY (route handlers under app/api/payments).
 *
 * Source: official reference https://inpay.uz/api/v2/ ("inPAY API v2 — hujjatlar"):
 *
 *   Auth      Authorization: Bearer sk_test_… (sandbox) | sk_live_… (real money)
 *   POST      /payments/            { amount (integer so'm, ≥1000), currency, description,
 *                                     return_url, webhook_url, metadata }  + Idempotency-Key
 *             -> data { id, status, checkout_url, amount, currency, livemode, metadata, created }
 *   GET       /payments/{id}        -> same object; the trusted status check
 *   POST      /payments/{id}/cancel -> cancels an unpaid payment (invalid_state when paid)
 *   status    requires_payment_method | requires_action | processing | succeeded | failed | canceled
 *   Errors    { success: false, error: { type, code, message, request_id, param } }
 *   Webhooks  X-Inpay-Signature: t=<unix>,v1=<hex>  where
 *             v1 = HMAC-SHA256("{t}.{raw body}", whsec_ secret); reject when older than 5 min.
 *   Refunds   not available through the API (manual, via the inPAY dashboard / support).
 *
 * The secret key is read from server environment variables and is never
 * logged or returned to the browser.
 */

const DEFAULT_BASE_URL = "https://inpay.uz/api/v2";
const REQUEST_TIMEOUT_MS = 15_000;
export const SIGNATURE_TOLERANCE_SECONDS = 300;

export class InPayError extends Error {
  /**
   * @param {string} message safe, credential-free message
   * @param {{ code?: string, httpStatus?: number, requestId?: string }} [details]
   */
  constructor(message, { code = "inpay_error", httpStatus = 0, requestId = "" } = {}) {
    super(message);
    this.name = "InPayError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.requestId = requestId;
  }
}

export function readInPayConfig(env = process.env) {
  const secretKey = (env.INPAY_SECRET_KEY || "").trim();
  const mode = secretKey.startsWith("sk_live_") ? "live" : secretKey.startsWith("sk_test_") ? "test" : null;
  return {
    secretKey,
    mode,
    livemode: mode === "live",
    webhookSecret: (env.INPAY_WEBHOOK_SECRET || "").trim(),
    baseUrl: (env.INPAY_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ""),
    configured: mode !== null,
  };
}

function normalizePayment(raw) {
  return {
    id: String(raw?.id || ""),
    status: String(raw?.status || "unknown").toLowerCase(),
    amount: Number(raw?.amount),
    currency: String(raw?.currency || "UZS").toUpperCase(),
    livemode: raw?.livemode === true,
    checkoutUrl: typeof raw?.checkout_url === "string" ? raw.checkout_url : "",
    metadata: raw?.metadata && typeof raw.metadata === "object" ? raw.metadata : {},
  };
}

/**
 * @param {ReturnType<typeof readInPayConfig>} config
 * @param {typeof fetch} [fetchImpl] injectable for tests
 */
export function createInPayClient(config, fetchImpl = fetch) {
  async function call(method, path, { body, idempotencyKey } = {}) {
    const headers = { Accept: "application/json", Authorization: `Bearer ${config.secretKey}` };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

    let response;
    try {
      response = await fetchImpl(`${config.baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
      });
    } catch (error) {
      throw new InPayError("inPAY serveriga ulanib bo'lmadi.", {
        code: error?.name === "TimeoutError" ? "timeout" : "network_error",
      });
    }

    const payload = await response.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      throw new InPayError(`inPAY javobini o'qib bo'lmadi (HTTP ${response.status}).`, {
        code: "bad_response",
        httpStatus: response.status,
      });
    }
    if (!response.ok || payload.success !== true) {
      const err = payload.error || {};
      throw new InPayError(typeof err.message === "string" ? err.message.slice(0, 200) : "inPAY so'rovi rad etildi.", {
        code: typeof err.code === "string" ? err.code : "rejected",
        httpStatus: response.status,
        requestId: typeof err.request_id === "string" ? err.request_id : "",
      });
    }
    return payload.data;
  }

  return {
    mode: config.mode,

    /**
     * @param {{ amount: number, description: string, returnUrl: string, webhookUrl: string,
     *           metadata: Record<string, string>, idempotencyKey: string }} p
     */
    async createPayment({ amount, description, returnUrl, webhookUrl, metadata, idempotencyKey }) {
      if (!Number.isInteger(amount) || amount < 1000) {
        throw new InPayError("Summa kamida 1000 so'm bo'lgan butun son bo'lishi kerak.", { code: "amount_invalid" });
      }
      const data = await call("POST", "/payments/", {
        body: { amount, currency: "UZS", description, return_url: returnUrl, webhook_url: webhookUrl, metadata },
        idempotencyKey,
      });
      const payment = normalizePayment(data);
      if (!payment.id || !/^https:\/\//.test(payment.checkoutUrl)) {
        throw new InPayError("inPAY to'lov havolasini qaytarmadi.", { code: "no_checkout_url" });
      }
      return payment;
    },

    async getPayment(id) {
      return normalizePayment(await call("GET", `/payments/${encodeURIComponent(id)}`));
    },

    async cancelPayment(id) {
      return normalizePayment(await call("POST", `/payments/${encodeURIComponent(id)}/cancel`));
    },
  };
}

/**
 * Verify an inPAY v2 webhook signature header ("t=<unix>,v1=<hex>[,v1=<hex>]").
 *
 * @returns {{ ok: true, timestamp: number } | { ok: false, reason: string }}
 */
export function verifyWebhookSignature(rawBody, header, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!secret) return { ok: false, reason: "no_secret" };
  if (!header) return { ok: false, reason: "missing_signature" };

  let timestamp = NaN;
  const signatures = [];
  for (const part of String(header).split(",")) {
    const [k, v] = part.trim().split("=", 2);
    if (k === "t") timestamp = Number(v);
    else if (k === "v1" && /^[0-9a-f]{64}$/i.test(v || "")) signatures.push(v.toLowerCase());
  }
  if (!Number.isFinite(timestamp) || signatures.length === 0) return { ok: false, reason: "malformed_signature" };
  if (Math.abs(nowSeconds - timestamp) > SIGNATURE_TOLERANCE_SECONDS) return { ok: false, reason: "stale_signature" };

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest();
  const match = signatures.some((sig) => timingSafeEqual(expected, Buffer.from(sig, "hex")));
  return match ? { ok: true, timestamp } : { ok: false, reason: "bad_signature" };
}
