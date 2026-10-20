import { NextRequest, NextResponse } from "next/server";
import { ApiError } from "@/lib/apiError";
import { handleRouteError, requireAdminApi } from "@/lib/apiGuard";
import { setUserSubscription } from "@/lib/data";
import type { BillingPeriod, PlanId } from "@/lib/types";
import { PLANS } from "@/lib/plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/subscriptions
 * Body: { uid, plan, billingPeriod }
 *
 * Server-side only. Sets a user's subscription (plan + planExpiry). Free users
 * are stored exactly like the existing frontend stores them (plan: "free").
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminApi();

    let body: { uid?: string; plan?: string; billingPeriod?: string };
    try {
      body = await req.json();
    } catch {
      throw new ApiError(400, "BAD_REQUEST", "So'rov formati noto'g'ri.");
    }

    const uid = typeof body.uid === "string" ? body.uid.trim() : "";
    const plan = body.plan as PlanId;
    const billingPeriod = (body.billingPeriod as BillingPeriod) ?? "monthly";

    if (!uid) {
      throw new ApiError(400, "UID_REQUIRED", "Foydalanuvchi identifikatori talab qilinadi.");
    }
    if (!PLANS.includes(plan)) {
      throw new ApiError(400, "INVALID_PLAN", "Noma'lum tarif.");
    }
    if (billingPeriod !== "monthly" && billingPeriod !== "yearly") {
      throw new ApiError(400, "INVALID_PERIOD", "Noma'lum to'lov davri.");
    }

    const result = await setUserSubscription(uid, plan, billingPeriod, admin);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return handleRouteError(error, req);
  }
}