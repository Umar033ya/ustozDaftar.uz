import { NextRequest, NextResponse } from "next/server";
import { handleRouteError, requireAdminApi } from "@/lib/apiGuard";
import { getUserDetail, getUserPayments } from "@/lib/data";

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