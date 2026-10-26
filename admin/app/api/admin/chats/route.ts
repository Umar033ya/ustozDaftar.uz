import { NextRequest, NextResponse } from "next/server";
import { handleRouteError, requireAdminApi } from "@/lib/apiGuard";
import { listThreads, unreadThreadCount } from "@/lib/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/chats          all support threads (newest first)
 * GET /api/admin/chats?count=1  only the number of threads with unread messages
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdminApi();
    if (req.nextUrl.searchParams.get("count") === "1") {
      return NextResponse.json({ unreadThreads: await unreadThreadCount() });
    }
    return NextResponse.json({ threads: await listThreads() });
  } catch (error) {
    return handleRouteError(error, req);
  }
}
