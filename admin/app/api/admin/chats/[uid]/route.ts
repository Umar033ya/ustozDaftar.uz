import { NextRequest, NextResponse } from "next/server";
import { handleRouteError, requireAdminApi } from "@/lib/apiGuard";
import { ApiError } from "@/lib/apiError";
import { listThreadMessages, markReadByAdmin, sendAdminMessage } from "@/lib/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ uid: string }>;
}

const UID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

async function readUid(context: RouteContext): Promise<string> {
  const { uid } = await context.params;
  if (!UID_PATTERN.test(uid)) throw new ApiError(400, "INVALID_UID", "Noto'g'ri foydalanuvchi.");
  return uid;
}

/** GET /api/admin/chats/[uid]?since=<ms> — messages of one thread; marks it read. */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    await requireAdminApi();
    const uid = await readUid(context);
    const since = Number(req.nextUrl.searchParams.get("since"));
    const messages = await listThreadMessages(uid, Number.isFinite(since) && since > 0 ? since : 0);
    await markReadByAdmin(uid);
    return NextResponse.json({ messages });
  } catch (error) {
    return handleRouteError(error, req);
  }
}

/** POST /api/admin/chats/[uid]  { text } — reply as the administrator. */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const admin = await requireAdminApi();
    const uid = await readUid(context);
    const body = (await req.json().catch(() => null)) as { text?: unknown } | null;
    const message = await sendAdminMessage(uid, String(body?.text ?? ""), admin);
    return NextResponse.json({ message });
  } catch (error) {
    return handleRouteError(error, req);
  }
}
