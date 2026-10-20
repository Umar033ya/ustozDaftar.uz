import { NextRequest, NextResponse } from "next/server";
import { ApiError } from "@/lib/apiError";
import { handleRouteError, requireAdminApi } from "@/lib/apiGuard";
import { approvePayment, rejectPayment } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/payments
 * Body: { requestId, action: "approve" | "reject" }
 *
 * Server-side only, requires the admin custom claim. Approval runs in a single
 * Firestore transaction: payment request -> approved + the target user's
 * plan/planExpiry updated atomically. Self-approval is rejected.
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminApi();

    let body: { requestId?: string; action?: string };
    try {
      body = await req.json();
    } catch {
      throw new ApiError(400, "BAD_REQUEST", "So'rov formati noto'g'ri.");
    }

    const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
    if (!requestId) {
      throw new ApiError(400, "REQUEST_ID_REQUIRED", "So'rov identifikatori talab qilinadi.");
    }

    const action = body.action;

    if (action === "approve") {
      const result = await approvePayment(requestId, admin);
      return NextResponse.json({ ok: true, result });
    }

    if (action === "reject") {
      await rejectPayment(requestId, admin);
      return NextResponse.json({ ok: true });
    }

    throw new ApiError(400, "INVALID_ACTION", "Noma'lum amal. 'approve' yoki 'reject' kutilgan edi.");
  } catch (error) {
    return handleRouteError(error, req);
  }
}