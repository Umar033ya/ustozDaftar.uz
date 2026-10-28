import { NextRequest, NextResponse } from "next/server";
import { ApiError } from "@/lib/apiError";
import { handleRouteError, requireAdminApi } from "@/lib/apiGuard";
import { cleanClassInput, cleanStudentNames, createClassForTeachers } from "@/lib/userAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ uid: string }>;
}

/**
 * POST /api/admin/users/[uid]/classes
 * Body: { name, academicYear, students?: string[] }
 * Creates a class (optionally with its roster) in this teacher's workspace.
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const admin = await requireAdminApi();
    const { uid } = await context.params;

    let body: { name?: unknown; academicYear?: unknown; students?: unknown };
    try {
      body = await req.json();
    } catch {
      throw new ApiError(400, "BAD_REQUEST", "So'rov formati noto'g'ri.");
    }

    const input = { ...cleanClassInput(body), students: cleanStudentNames(body.students, { allowEmpty: true }) };
    await createClassForTeachers([uid], input, admin);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error, req);
  }
}
