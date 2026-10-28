import { NextRequest, NextResponse } from "next/server";
import { handleRouteError, requireAdminApi } from "@/lib/apiGuard";
import { ApiError } from "@/lib/apiError";
import { getUserDetail, getUserPayments } from "@/lib/data";
import { deleteUserAccount, setUserBlocked } from "@/lib/userAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ uid: string }>;
}

/** GET /api/admin/users/[uid] — profile detail + that user's payment history. */
export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    await requireAdminApi();
    const { uid } = await context.params;

    const user = await getUserDetail(uid);
    if (!user) {
      return NextResponse.json({ error: "Foydalanuvchi topilmadi." }, { status: 404 });
    }
    const payments = await getUserPayments(uid);
    return NextResponse.json({ user, payments });
  } catch (error) {
    return handleRouteError(error);
  }
}

/** PATCH /api/admin/users/[uid] — Body: { blocked: boolean }. Blocks or unblocks sign-in. */
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const admin = await requireAdminApi();
    const { uid } = await context.params;

    let body: { blocked?: unknown };
    try {
      body = await req.json();
    } catch {
      throw new ApiError(400, "BAD_REQUEST", "So'rov formati noto'g'ri.");
    }
    if (typeof body.blocked !== "boolean") {
      throw new ApiError(400, "BLOCKED_REQUIRED", "blocked qiymati true yoki false bo'lishi kerak.");
    }

    await setUserBlocked(uid, body.blocked, admin);
    return NextResponse.json({ ok: true, blocked: body.blocked });
  } catch (error) {
    return handleRouteError(error, req);
  }
}

/** DELETE /api/admin/users/[uid] — removes the sign-in account and the workspace. */
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const admin = await requireAdminApi();
    const { uid } = await context.params;
    await deleteUserAccount(uid, admin);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error, req);
  }
}