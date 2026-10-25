import { NextResponse } from "next/server";
import { AuthError, requireAuth } from "@/lib/firebaseAdmin";
import { paymentRuntime } from "@/lib/server/paymentRuntime";

// GET /api/payments/inpay/status?pid=<paymentId>   Authorization: Bearer <Firebase ID token>
// Re-checks the payment with inPAY (server to server) and applies the result.
// Only the owner of the payment may ask.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fail = (error, status, code) => NextResponse.json({ error, code }, { status });

export async function GET(request) {
  let user;
  try {
    user = await requireAuth(request);
  } catch (error) {
    if (error instanceof AuthError) return fail("Tizimga qayta kiring.", 401, "unauthorized");
    return fail("Avtorizatsiyani tekshirib bo'lmadi.", 500, "auth_unavailable");
  }

  const rt = paymentRuntime();
  if (!rt.ok) return fail("Onlayn to'lov hozircha yoqilmagan.", 503, "not_configured");

  const pid = new URL(request.url).searchParams.get("pid") || "";
  if (!/^[A-Za-z0-9]{10,40}$/.test(pid)) return fail("To'lov topilmadi.", 404, "not_found");

  try {
    // Same answer for "missing" and "someone else's" so ids cannot be probed.
    if (!(await rt.service.isOwner(pid, user.uid))) return fail("To'lov topilmadi.", 404, "not_found");
    const payment = await rt.service.syncPayment(pid);
    return NextResponse.json({ payment });
  } catch (error) {
    console.error("[payments] status check failed", { code: error?.code, message: error?.message });
    return fail("To'lov holatini tekshirib bo'lmadi. Birozdan so'ng qayta urinib ko'ring.", 502, "check_failed");
  }
}
