import { NextResponse } from "next/server";
import { AuthError, ConfigError, requireAuth } from "@/lib/firebaseAdmin";
import { BILLING_PERIODS, PAID_PLANS } from "@/lib/plans";
import { paymentRuntime } from "@/lib/server/paymentRuntime";
import { InPayError } from "@/lib/server/inpay";

// POST /api/payments/inpay/create   Authorization: Bearer <Firebase ID token>
// Body: { plan: "pro" | "max", billingPeriod: "monthly" | "yearly" }
// The amount is looked up on the server; the client never sends one.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_WINDOW_MS = 10 * 60_000;
const RATE_MAX = 5;
const recent = new Map(); // uid -> timestamps (best effort, per instance)

function allow(uid) {
  const now = Date.now();
  const stamps = (recent.get(uid) || []).filter((ts) => now - ts < RATE_WINDOW_MS);
  if (stamps.length >= RATE_MAX) return false;
  stamps.push(now);
  recent.set(uid, stamps);
  return true;
}

const fail = (error, status, code) => NextResponse.json({ error, code }, { status });

export async function POST(request) {
  let user;
  try {
    user = await requireAuth(request);
  } catch (error) {
    if (error instanceof AuthError) return fail("Tizimga qayta kiring.", 401, "unauthorized");
    if (error instanceof ConfigError) return fail("Server sozlanmagan.", 500, "config");
    return fail("Avtorizatsiyani tekshirib bo'lmadi.", 500, "auth_unavailable");
  }

  const rt = paymentRuntime();
  if (!rt.ok) {
    console.error("[payments] inPAY is not configured; missing env:", rt.missing.join(", "));
    return fail("Onlayn to'lov vaqtincha ishlamayapti. Birozdan so'ng qayta urinib ko'ring.", 503, "not_configured");
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return fail("So'rov formati noto'g'ri.", 400, "bad_request");
  }
  const plan = typeof body?.plan === "string" ? body.plan : "";
  const billingPeriod = typeof body?.billingPeriod === "string" ? body.billingPeriod : "";
  if (!Object.hasOwn(PAID_PLANS, plan) || !BILLING_PERIODS.includes(billingPeriod)) {
    return fail("Noto'g'ri tarif yoki to'lov davri.", 400, "invalid_plan");
  }

  if (!allow(user.uid)) {
    return fail("Juda ko'p urinish. 10 daqiqadan so'ng qayta urinib ko'ring.", 429, "rate_limited");
  }

  try {
    const { paymentId, payUrl } = await rt.service.startPayment({
      uid: user.uid,
      plan,
      billingPeriod,
      baseUrl: rt.baseUrl,
    });
    return NextResponse.json({ paymentId, payUrl });
  } catch (error) {
    if (error instanceof InPayError) {
      // request_id is what inPAY support asks for; it carries no secret.
      console.error("[payments] inPAY create failed", { code: error.code, httpStatus: error.httpStatus, requestId: error.requestId });
      return fail("To'lov tizimi bilan bog'lanib bo'lmadi. Birozdan so'ng qayta urinib ko'ring.", 502, "provider_error");
    }
    console.error("[payments] create failed", error?.message || error);
    return fail("To'lovni yaratib bo'lmadi.", 500, "server_error");
  }
}
