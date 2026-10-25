import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { paymentRuntime } from "@/lib/server/paymentRuntime";
import { verifyWebhookSignature } from "@/lib/server/inpay";

// POST /api/payments/inpay/webhook — called by inPAY API v2.
//
// 1. The X-Inpay-Signature (t=…,v1=… = HMAC-SHA256("{t}.{raw body}", whsec_…))
//    must be valid and at most 5 minutes old whenever INPAY_WEBHOOK_SECRET is
//    configured (it must be in production).
// 2. Even a correctly signed body is not trusted for the outcome: it only says
//    WHICH payment changed. The status is then fetched from inPAY with
//    GET /payments/{id} and applied idempotently (see syncPayment).
// 3. inPAY may deliver an event more than once; each event id is recorded and
//    repeats are acknowledged without work.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 64 * 1024;
const EVENTS_COLLECTION = "inpayWebhookEvents";

export async function POST(request) {
  const rt = paymentRuntime();
  if (!rt.ok) {
    console.error("[payments] webhook received but inPAY is not configured; missing env:", rt.missing.join(", "));
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ ok: false }, { status: 413 });

  const secret = rt.config.webhookSecret;
  if (secret) {
    const check = verifyWebhookSignature(raw, request.headers.get("x-inpay-signature") || "", secret);
    if (!check.ok) {
      console.warn("[payments] webhook rejected", { reason: check.reason });
      return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 401 });
    }
  } else if (rt.config.livemode) {
    // Live mode without a secret is a configuration error: refuse rather than guess.
    console.error("[payments] INPAY_WEBHOOK_SECRET is required with a live key");
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const eventId = typeof event?.id === "string" && /^evt_[A-Za-z0-9]{6,80}$/.test(event.id) ? event.id : null;
  const type = typeof event?.type === "string" ? event.type : "";
  const object = event?.data?.object || {};
  if (!type.startsWith("payment.")) return NextResponse.json({ ok: true, ignored: "event_type" });
  if (event.livemode !== rt.config.livemode) {
    console.warn("[payments] webhook mode mismatch ignored", { type, livemode: event.livemode });
    return NextResponse.json({ ok: true, ignored: "mode" });
  }

  const providerPaymentId = typeof object.id === "string" ? object.id : "";
  const metaId = typeof object.metadata?.payment_id === "string" ? object.metadata.payment_id : "";
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(providerPaymentId)) return NextResponse.json({ ok: false }, { status: 400 });

  try {
    const db = adminDb();
    if (eventId) {
      const seen = await db.collection(EVENTS_COLLECTION).doc(eventId).get();
      if (seen.exists) return NextResponse.json({ ok: true, duplicate: true });
    }

    // Prefer our own id from metadata, but only if it really maps to this inPAY payment.
    let paymentId = null;
    if (/^[A-Za-z0-9]{10,40}$/.test(metaId)) {
      const snap = await db.collection("inpayPayments").doc(metaId).get();
      if (snap.exists && snap.data().providerPaymentId === providerPaymentId) paymentId = metaId;
    }
    paymentId = paymentId || (await rt.service.findPaymentIdByProviderId(providerPaymentId));
    if (!paymentId) {
      console.warn("[payments] webhook for unknown payment", { type });
      return NextResponse.json({ ok: true, ignored: "unknown_payment" });
    }

    const payment = await rt.service.syncPayment(paymentId);
    if (eventId) {
      await db.collection(EVENTS_COLLECTION).doc(eventId).set({ type, paymentId, status: payment?.status || null, receivedAt: Date.now() });
    }
    return NextResponse.json({ ok: true, status: payment?.status });
  } catch (error) {
    // Non-2xx makes inPAY retry (1 min … 24 h), which is right for a transient failure.
    console.error("[payments] webhook processing failed", { code: error?.code, message: error?.message });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
