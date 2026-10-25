import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { guardAdmin } from "@/lib/server/adminRoute";
import { approveRequest, rejectRequest, REQUESTS_COLLECTION } from "@/lib/server/manualPayments";
import { markRefunded, PaymentValidationError, PAYMENTS_COLLECTION } from "@/lib/server/subscriptionPayments";

// POST /api/admin/payments   Authorization: Bearer <ID token with the admin claim>
// Body: { action: "approve" | "reject" | "refund", source: "manual" | "inpay", id, note? }
//
// approve/reject apply to manual card-transfer requests. refund records that a
// successful payment was refunded through the inPAY dashboard or by hand
// (inPAY has no refund API); it removes the payment from revenue.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  const { admin, response } = await guardAdmin(request);
  if (response) return response;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "So'rov formati noto'g'ri.", code: "bad_request" }, { status: 400 });
  }
  const { action, source, id } = body || {};
  if (typeof id !== "string" || !/^[A-Za-z0-9]{10,40}$/.test(id)) {
    return NextResponse.json({ error: "Identifikator noto'g'ri.", code: "bad_id" }, { status: 400 });
  }

  const db = adminDb();
  const now = Date.now();
  try {
    let result;
    if (action === "approve" && source === "manual") result = await approveRequest(db, id, { adminUid: admin.uid, now });
    else if (action === "reject" && source === "manual") result = await rejectRequest(db, id, { adminUid: admin.uid, now });
    else if (action === "refund" && (source === "manual" || source === "inpay")) {
      result = await markRefunded(db, source === "inpay" ? PAYMENTS_COLLECTION : REQUESTS_COLLECTION, id, {
        adminUid: admin.uid,
        now,
        note: body.note,
      });
    } else {
      return NextResponse.json({ error: "Noma'lum amal.", code: "bad_action" }, { status: 400 });
    }

    await db.collection("auditLogs").add({
      action: `payment.${action}`,
      source,
      targetId: id,
      targetUid: result.uid || null,
      adminUid: admin.uid,
      planExpiryAfter: result.planExpiryAfter ?? null,
      createdAt: now,
    });
    return NextResponse.json({ ok: true, status: result.status, planExpiry: result.planExpiryAfter ?? null });
  } catch (error) {
    if (error instanceof PaymentValidationError) {
      return NextResponse.json({ error: error.message, code: "invalid" }, { status: 409 });
    }
    console.error("[admin] payment action failed", { action, message: error?.message });
    return NextResponse.json({ error: "Amalni bajarib bo'lmadi.", code: "server_error" }, { status: 500 });
  }
}
