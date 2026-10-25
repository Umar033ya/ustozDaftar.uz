import { NextResponse } from "next/server";
import { AuthError, ConfigError, ForbiddenError, requireAdmin } from "../firebaseAdmin.js";

/**
 * Shared guard for /api/admin/* route handlers — SERVER SIDE ONLY.
 * Returns the admin, or a ready NextResponse to send back.
 */
export async function guardAdmin(request) {
  try {
    return { admin: await requireAdmin(request) };
  } catch (error) {
    if (error instanceof AuthError) return { response: NextResponse.json({ error: "Tizimga qayta kiring.", code: "unauthorized" }, { status: 401 }) };
    if (error instanceof ForbiddenError) return { response: NextResponse.json({ error: "Bu bo'lim faqat administratorlar uchun.", code: "forbidden" }, { status: 403 }) };
    if (error instanceof ConfigError) {
      console.error("[admin] configuration:", error.message);
      return { response: NextResponse.json({ error: "Server sozlanmagan (FIREBASE_SERVICE_ACCOUNT).", code: "config" }, { status: 500 }) };
    }
    console.error("[admin] auth failed", error?.message);
    return { response: NextResponse.json({ error: "Avtorizatsiyani tekshirib bo'lmadi.", code: "auth_unavailable" }, { status: 500 }) };
  }
}
