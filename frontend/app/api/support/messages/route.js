import { NextResponse } from "next/server";
import { AuthError, ConfigError, adminDb, requireAuth } from "@/lib/firebaseAdmin";
import {
  cleanMessageText,
  listMessages,
  markReadByUser,
  postUserMessage,
  unreadForUser,
} from "@/lib/server/supportChat";

// GET  /api/support/messages?since=<ms>   the caller's own thread (marks admin replies read)
// GET  /api/support/messages?peek=1       only the unread count (cheap, for the badge)
// POST /api/support/messages  { text }    send a message to the administrators
// Authorization: Bearer <Firebase ID token>. The thread id is always the
// verified uid, never a value from the request.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;
const recent = new Map(); // uid -> timestamps (best effort, per instance)

function allow(uid) {
  const now = Date.now();
  const stamps = (recent.get(uid) || []).filter((ts) => now - ts < RATE_WINDOW_MS);
  if (stamps.length >= RATE_MAX) return false;
  stamps.push(now);
  recent.set(uid, stamps);
  return true;
}

const fail = (error, status, code) => NextResponse.json({ error, code }, { status });

async function authenticate(request) {
  try {
    return { user: await requireAuth(request) };
  } catch (error) {
    if (error instanceof AuthError) return { response: fail("Tizimga qayta kiring.", 401, "unauthorized") };
    return { response: fail("Server sozlanmagan.", 500, "config") };
  }
}

function serverFailure(error) {
  if (error instanceof ConfigError) {
    console.error("[support] chat unavailable:", error.message);
    return fail("Chat hozircha ishlamayapti.", 503, "not_configured");
  }
  console.error("[support] chat request failed", error?.code || "", error?.message || error);
  return fail("Xabarlarni yuklab bo'lmadi.", 500, "server_error");
}

export async function GET(request) {
  const { user, response } = await authenticate(request);
  if (response) return response;

  const params = new URL(request.url).searchParams;
  try {
    const db = adminDb();
    if (params.get("peek") === "1") {
      return NextResponse.json({ unread: await unreadForUser(db, user.uid) });
    }
    const since = Number(params.get("since"));
    const messages = await listMessages(db, user.uid, Number.isFinite(since) && since > 0 ? since : 0);
    await markReadByUser(db, user.uid);
    return NextResponse.json({ messages, unread: 0 });
  } catch (error) {
    return serverFailure(error);
  }
}

export async function POST(request) {
  const { user, response } = await authenticate(request);
  if (response) return response;

  let body;
  try {
    body = await request.json();
  } catch {
    return fail("So'rov formati noto'g'ri.", 400, "bad_request");
  }
  const cleaned = cleanMessageText(body?.text);
  if (cleaned.error === "empty") return fail("Xabar bo'sh.", 400, "empty");
  if (cleaned.error === "too_long") return fail("Xabar juda uzun.", 400, "too_long");

  if (!allow(user.uid)) return fail("Juda ko'p xabar. Birozdan so'ng qayta urinib ko'ring.", 429, "rate_limited");

  try {
    const db = adminDb();
    // Name/email come from the user's own profile on the server, not from the request.
    const profile = (await db.collection("users").doc(user.uid).get()).data() || {};
    const userName = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
    const message = await postUserMessage(db, {
      uid: user.uid,
      text: cleaned.text,
      userName: userName.slice(0, 120),
      userEmail: String(profile.email || user.email || "").slice(0, 200),
    });
    return NextResponse.json({ message });
  } catch (error) {
    return serverFailure(error);
  }
}
