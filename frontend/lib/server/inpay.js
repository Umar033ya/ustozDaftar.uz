import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * inPAY API client — SERVER SIDE ONLY (route handlers under app/api/payments).
 *
 * Source: official API reference https://inpay.uz/api/ (v1.0) and the official
 * PHP SDK https://github.com/inpayuz/inpay-php (WebhookHandler.php):
 *
 *   GET  /api/v1/authorization/?merchant_id=&merchant_token=  -> { success, bearer_token } (valid 24h)
 *   POST /api/v1/create/   (trailing slash required)         -> { success, order_id, pay_url, ... }
 *   GET  /api/v1/transactions/?order_id=                      -> { success, status, amount, ... }
 *        status: pending | success | failed | cancelled
 *   Webhook POST to callback_url: { order_id, status, amount, transaction_id, ... }
 *        SDK: X-InPAY-Signature = hex(HMAC-SHA256(raw body, webhook secret))
 *
 * The API reference does not document webhook signing, so a webhook is never
 * trusted by itself: it only triggers getTransaction(), a server-to-server
 * status check with the merchant's bearer token.
 *
 * Credentials come from server environment variables and are never logged or
 * returned to the browser.
 */

const DEFAULT_BASE_URL = "https://inpay.uz/api/v1";
const TOKEN_TTL_MS = 23 * 60 * 60 * 1000; // inPAY tokens live 24h; refresh an hour early
const REQUEST_TIMEOUT_MS = 15_000;

export class InPayError extends Error {
  /**
   * @param {string} message safe, credential-free message
   * @param {{ code?: string, httpStatus?: number }} [details]
   */
  constructor(message, { code = "INPAY_ERROR", httpStatus = 0 } = {}) {
    super(message);
    this.name = "InPayError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export function readInPayConfig(env = process.env) {
  const merchantId = (env.INPAY_MERCHANT_ID || "").trim();
  const merchantToken = (env.INPAY_MERCHANT_TOKEN || "").trim();
  return {
    merchantId,
    merchantToken,
    webhookSecret: (env.INPAY_WEBHOOK_SECRET || "").trim(),
    baseUrl: (env.INPAY_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ""),
    configured: Boolean(merchantId && merchantToken),
  };
}

/**
 * @param {ReturnType<typeof readInPayConfig>} config
 * @param {typeof fetch} [fetchImpl] injectable for tests
 */
export function createInPayClient(config, fetchImpl = fetch) {
  let tokenCache = null; // { token, expiresAt }

  async function call(method, path, { body, auth = true } = {}) {
    const headers = { Accept: "application/json" };
    if (auth) headers.Authorization = `Bearer ${await bearerToken()}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";

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
        code: error?.name === "TimeoutError" ? "TIMEOUT" : "NETWORK",
      });
    }

    const data = await response.json().catch(() => null);
    if (!data || typeof data !== "object") {
      throw new InPayError(`inPAY javobini o'qib bo'lmadi (HTTP ${response.status}).`, {
        code: "BAD_RESPONSE",
        httpStatus: response.status,
      });
    }
    if (!response.ok || data.success === false) {
      if (auth && (data.error_code === "INVALID_TOKEN" || response.status === 401)) tokenCache = null;
      throw new InPayError(typeof data.message === "string" ? data.message.slice(0, 200) : "inPAY so'rovi rad etildi.", {
        code: typeof data.error_code === "string" ? data.error_code : "REJECTED",
        httpStatus: response.status,
      });
    }
    return data;
  }

  async function bearerToken() {
    if (tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.token;
    const query = new URLSearchParams({ merchant_id: config.merchantId, merchant_token: config.merchantToken });
    const data = await call("GET", `/authorization/?${query}`, { auth: false });
    if (typeof data.bearer_token !== "string" || !data.bearer_token) {
      throw new InPayError("inPAY avtorizatsiya tokenini bermadi.", { code: "NO_TOKEN" });
    }
    tokenCache = { token: data.bearer_token, expiresAt: Date.now() + TOKEN_TTL_MS };
    return tokenCache.token;
  }

  return {
    /**
     * @param {{ amount: number, description: string, callbackUrl: string, returnUrl: string, clientIp?: string }} p
     * @returns {Promise<{ orderId: string, payUrl: string }>}
     */
    async createPayment({ amount, description, callbackUrl, returnUrl, clientIp }) {
      const body = {
        merchant_id: config.merchantId,
        token: config.merchantToken,
        amount,
        description,
        callback_url: callbackUrl,
        return_url: returnUrl,
      };
      if (clientIp) body.client_ip = clientIp;
      const data = await call("POST", "/create/", { body });
      const orderId = String(data.order_id || "");
      const payUrl = String(data.pay_url || "");
      if (!orderId || !/^https:\/\//.test(payUrl)) {
        throw new InPayError("inPAY to'lov havolasini qaytarmadi.", { code: "NO_PAY_URL" });
      }
      return { orderId, payUrl };
    },

    /** @returns {Promise<{ orderId: string, status: string, amount: number, paidAt: string | null }>} */
    async getTransaction(orderId) {
      const data = await call("GET", `/transactions/?order_id=${encodeURIComponent(orderId)}`);
      // The SDK accepts both a flat response and one wrapped in `data`.
      const tx = data.data && typeof data.data === "object" ? data.data : data;
      return {
        orderId: String(tx.order_id || orderId),
        status: String(tx.status || "unknown").toLowerCase(),
        amount: Number(tx.amount) || 0,
        paidAt: tx.paid_at ? String(tx.paid_at) : null,
      };
    },
  };
}

/**
 * Verify X-InPAY-Signature (hex HMAC-SHA256 of the raw body, optional
 * "sha256=" prefix) in constant time.
 */
export function verifyWebhookSignature(rawBody, signature, secret) {
  if (!secret || !signature) return false;
  const candidate = signature.trim().replace(/^sha256=/i, "");
  if (!/^[0-9a-f]{64}$/i.test(candidate)) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest();
  return timingSafeEqual(expected, Buffer.from(candidate, "hex"));
}
