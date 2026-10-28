import { NextRequest, NextResponse } from "next/server";
import { ApiError } from "@/lib/apiError";
import { handleRouteError, requireAdminApi } from "@/lib/apiGuard";
import { getSchool } from "@/lib/schools";
import { cleanClassInput, cleanStudentNames, createClassForTeachers } from "@/lib/userAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ key: string }>;
}

/**
 * POST /api/admin/schools/[key]/classes
 * Body: { name, academicYear, students?: string[] }
 * Adds the class to every teacher of the school, so each of them sees it in
 * their own dashboard. Blocked accounts are skipped.
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const admin = await requireAdminApi();
    const { key } = await context.params;

    let body: { name?: unknown; academicYear?: unknown; students?: unknown };
    try {
      body = await req.json();
    } catch {
      throw new ApiError(400, "BAD_REQUEST", "So'rov formati noto'g'ri.");
    }
    const input = { ...cleanClassInput(body), students: cleanStudentNames(body.students, { allowEmpty: true }) };

    const school = await getSchool(decodeURIComponent(key));
    if (!school) throw new ApiError(404, "SCHOOL_NOT_FOUND", "Maktab topilmadi.");

    const uids = school.teachers.filter((t) => !t.blocked).map((t) => t.uid);
    const teachers = await createClassForTeachers(uids, input, admin, { schoolName: school.name });
    return NextResponse.json({ ok: true, teachers });
  } catch (error) {
    return handleRouteError(error, req);
  }
}
