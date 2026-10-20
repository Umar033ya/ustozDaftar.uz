import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { ApiError } from "@/lib/apiError";
import { getSessionAdmin, type AdminSessionUser } from "@/lib/session";

/**
 * Verifies the session cookie + admin claim for API route handlers.
 * Returns the admin user or throws an ApiError that the wrapper turns into JSON.
 */
export async function requireAdminApi(): Promise<AdminSessionUser> {
  const admin = await getSessionAdmin();
  if (!admin) {
    throw new ApiError(401, "UNAUTHORIZED", "Tizimga kirish talab qilinadi.");
  }
  return admin;
}

export function handleRouteError(error: unknown, req?: NextRequest): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message, code: error.name }, { status: error.status });
  }
  console.error("[admin-api] unhandled error", error, req?.url ?? "");
  return NextResponse.json(
    { error: "Serverda xatolik yuz berdi. Iltimos, qayta urinib ko'ring." },
    { status: 500 }
  );
}