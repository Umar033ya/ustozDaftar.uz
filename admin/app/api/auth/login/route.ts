import { NextResponse } from "next/server";
import { getAdminAuth, hasAdminCredentials } from "@/lib/firebaseAdmin";
import { SESSION_COOKIE, sessionMaxAgeSeconds } from "@/lib/session";

export const runtime = "nodejs";

/**
 * POST /api/auth/login
 * Body: { idToken }
 *
 * Verifies the Firebase ID token, requires the server-assigned `admin: true`
 * custom claim, and exchanges it for a session cookie (httpOnly, not accessible
 * from JavaScript). Admin claims are never set here — only read.
 */
export async function POST(req: Request) {
  if (!hasAdminCredentials()) {
    return NextResponse.json(
      { error: "ADMIN_CONFIG_MISSING", message: "Admin server ma'lumotlari sozlanmagan." },
      { status: 500 }
    );
  }

  let idToken: string;
  try {
    const body = (await req.json()) as { idToken?: string };
    idToken = typeof body.idToken === "string" ? body.idToken : "";
  } catch {
    idToken = "";
  }

  if (!idToken) {
    return NextResponse.json({ error: "ID_TOKEN_MISSING" }, { status: 400 });
  }

  try {
    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(idToken);

    if (decoded.admin !== true) {
      return NextResponse.json(
        { error: "NOT_ADMIN", message: "Bu hisob admin huquqiga ega emas." },
        { status: 403 }
      );
    }

    const maxAgeSeconds = sessionMaxAgeSeconds();
    const sessionCookie = await auth.createSessionCookie(idToken, {
      expiresIn: maxAgeSeconds * 1000,
    });

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: maxAgeSeconds,
    });
    return response;
  } catch (error) {
    console.error("[auth/login] session creation failed:", error);
    return NextResponse.json(
      { error: "LOGIN_FAILED", message: "Kirish so'rovini qayta ishlashda xatolik yuz berdi." },
      { status: 401 }
    );
  }
}