import { NextRequest, NextResponse } from "next/server";
import { ApiError } from "@/lib/apiError";
import { handleRouteError, requireAdminApi } from "@/lib/apiGuard";
import { addStudentsToClass, cleanStudentNames } from "@/lib/userAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ uid: string; classId: string }>;
}

/**
 * POST /api/admin/users/[uid]/classes/[classId]/students
 * Body: { names: string[] }
 * Adds students to a teacher's class (e.g. when the AI import could not read the list).
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const admin = await requireAdminApi();
    const { uid, classId } = await context.params;

    let body: { names?: unknown };
    try {
      body = await req.json();
    } catch {
      throw new ApiError(400, "BAD_REQUEST", "So'rov formati noto'g'ri.");
    }

    const added = await addStudentsToClass(uid, classId, cleanStudentNames(body.names), admin);
    return NextResponse.json({ ok: true, added });
  } catch (error) {
    return handleRouteError(error, req);
  }
}
