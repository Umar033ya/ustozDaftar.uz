import { NextResponse } from "next/server";
import { paymentRuntime } from "@/lib/server/paymentRuntime";
import { verifyWebhookSignature } from "@/lib/server/inpay";

// POST /api/payments/inpay/webhook — called by inPAY (callback_url).
//
// The body is never trusted: only `order_id` is read from it, and the payment
// is then verified with inPAY's transaction API before anything is activated.
// When INPAY_WEBHOOK_SECRET is configured, a present X-InPAY-Signature must be
// valid (HMAC-SHA256 of the raw body); set INPAY_REQUIRE_SIGNATURE=true to also
// reject unsigned callbacks once inPAY confirms they always sign.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16 * 1024;

export async function POST(request) {
  const rt = paymentRuntime();
  if (!rt.ok) {
    console.error("[payments] webhook received but inPAY is not configured");
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ ok: false }, { status: 413 });

  const signature = request.headers.get("x-inpay-signature") || request.headers.get("x-inpay-sign") || "";
  const secret = rt.config.webhookSecret;
  const requireSignature = process.env.INPAY_REQUIRE_SIGNATURE === "true";
  if (secret && (signature || requireSignature) && !verifyWebhookSignature(raw, signature, secret)) {
    console.warn("[payments] webhook rejected: invalid or missing signature");
    return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 401 });
  }

  let orderId = "";
  try {
    const parsed = JSON.parse(raw);
    orderId = typeof parsed?.order_id === "string" || typeof parsed?.order_id === "number" ? String(parsed.order_id) : "";
  } catch {
    // inPAY also documents form-encoded callbacks
    orderId = new URLSearchParams(raw).get("order_id") || "";
  }
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(orderId)) return NextResponse.json({ ok: false }, { status: 400 });

  try {
    const paymentId = await rt.service.findPaymentIdByOrderId(orderId);
    if (!paymentId) {
      // Not ours (or already cleaned up): acknowledge so inPAY stops retrying.
      console.warn("[payments] webhook for unknown order");
      return NextResponse.json({ ok: true, ignored: true });
    }
    const payment = await rt.service.syncPayment(paymentId);
    return NextResponse.json({ ok: true, status: payment?.status });
  } catch (error) {
    // Non-2xx makes inPAY retry later, which is what we want on a transient failure.
    console.error("[payments] webhook processing failed", { code: error?.code, message: error?.message });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
