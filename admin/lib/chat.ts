import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebaseAdmin";
import { ApiError } from "@/lib/apiError";
import { toMillis } from "@/lib/format";
import { PLANS } from "@/lib/plan";
import type { ChatMessage, ChatThread, PlanId } from "@/lib/types";

/**
 * Support chat — admin side. Same data model as frontend/lib/server/supportChat.js:
 *   supportChats/{uid}                 thread summary (one per teacher)
 *   supportChats/{uid}/messages/{id}   sender "user" | "admin", text, createdAt (ms)
 * Clients never touch these documents (Firestore rules deny them); both apps
 * go through the Admin SDK.
 */

const CHATS = "supportChats";
const USERS = "users";
const THREAD_LIMIT = 200;
const PAGE_SIZE = 100;
export const MAX_MESSAGE_LENGTH = 2000;

// Control characters except \t and \n.
const CONTROL_CHARS = /[\u0000-\u0008\u000B-\u001F\u007F]/g;

export function cleanMessageText(raw: unknown): string {
  if (typeof raw !== "string") throw new ApiError(400, "EMPTY", "Xabar bo'sh.");
  const text = raw.replace(/\r\n?/g, "\n").replace(CONTROL_CHARS, "").trim();
  if (!text) throw new ApiError(400, "EMPTY", "Xabar bo'sh.");
  if (text.length > MAX_MESSAGE_LENGTH) {
    throw new ApiError(400, "TOO_LONG", `Xabar juda uzun (ko'pi bilan ${MAX_MESSAGE_LENGTH} belgi).`);
  }
  return text;
}

function normalizePlan(value: unknown): PlanId {
  return PLANS.includes(value as PlanId) ? (value as PlanId) : "free";
}

function toMessage(doc: FirebaseFirestore.QueryDocumentSnapshot): ChatMessage {
  const d = doc.data();
  return {
    id: doc.id,
    sender: d.sender === "admin" ? "admin" : "user",
    text: String(d.text ?? ""),
    createdAt: Number(d.createdAt) || 0,
  };
}

/** Threads, newest activity first, with each user's current plan. */
export async function listThreads(): Promise<ChatThread[]> {
  const db = getAdminFirestore();
  const snap = await db.collection(CHATS).orderBy("lastMessageAt", "desc").limit(THREAD_LIMIT).get();
  if (snap.empty) return [];

  // The plan is read fresh from users/{uid} (it changes after payments).
  const userRefs = snap.docs.map((d) => db.collection(USERS).doc(d.id));
  const userSnaps = await db.getAll(...userRefs, {
    fieldMask: ["firstName", "lastName", "email", "plan", "planExpiry"],
  });
  const users = new Map(userSnaps.map((s) => [s.id, s.exists ? s.data() ?? {} : {}]));

  return snap.docs.map((doc) => {
    const d = doc.data();
    const u = users.get(doc.id) ?? {};
    const name = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
    return {
      uid: doc.id,
      userName: name || (d.userName as string | undefined) || undefined,
      userEmail: (u.email as string | undefined) || (d.userEmail as string | undefined) || undefined,
      plan: normalizePlan(u.plan),
      planExpiry: toMillis(u.planExpiry),
      lastMessage: String(d.lastMessage ?? ""),
      lastMessageAt: Number(d.lastMessageAt) || 0,
      lastSender: d.lastSender === "admin" ? "admin" : "user",
      unreadByAdmin: Number(d.unreadByAdmin) || 0,
    };
  });
}

/** Number of threads with unread user messages (for the sidebar badge). */
export async function unreadThreadCount(): Promise<number> {
  const agg = await getAdminFirestore().collection(CHATS).where("unreadByAdmin", ">", 0).count().get();
  return agg.data().count;
}

/** Messages oldest first; with `since`, those created at or after it. */
export async function listThreadMessages(uid: string, since = 0): Promise<ChatMessage[]> {
  const col = getAdminFirestore().collection(CHATS).doc(uid).collection("messages");
  if (since > 0) {
    const snap = await col.where("createdAt", ">=", since).orderBy("createdAt", "asc").limit(PAGE_SIZE).get();
    return snap.docs.map(toMessage);
  }
  const snap = await col.orderBy("createdAt", "desc").limit(PAGE_SIZE).get();
  return snap.docs.map(toMessage).reverse();
}

export async function markReadByAdmin(uid: string): Promise<void> {
  const ref = getAdminFirestore().collection(CHATS).doc(uid);
  const snap = await ref.get();
  if (snap.exists && Number(snap.data()?.unreadByAdmin) > 0) await ref.update({ unreadByAdmin: 0 });
}

/** Reply to a teacher (or start a conversation with one). */
export async function sendAdminMessage(
  uid: string,
  rawText: string,
  actor: { uid: string }
): Promise<ChatMessage> {
  const text = cleanMessageText(rawText);
  const db = getAdminFirestore();
  const userSnap = await db.collection(USERS).doc(uid).get();
  if (!userSnap.exists) throw new ApiError(404, "USER_NOT_FOUND", "Foydalanuvchi topilmadi.");

  const threadRef = db.collection(CHATS).doc(uid);
  const messageRef = threadRef.collection("messages").doc();
  const now = Date.now();
  const existing = await threadRef.get();
  const u = userSnap.data() ?? {};

  const batch = db.batch();
  batch.set(messageRef, { sender: "admin", text, createdAt: now, adminUid: actor.uid });
  batch.set(
    threadRef,
    {
      uid,
      userName: [u.firstName, u.lastName].filter(Boolean).join(" ").trim(),
      userEmail: String(u.email ?? ""),
      lastMessage: text.slice(0, 200),
      lastMessageAt: now,
      lastSender: "admin",
      unreadByAdmin: 0,
      unreadByUser: FieldValue.increment(1),
      updatedAt: now,
      ...(existing.exists ? {} : { createdAt: now }),
    },
    { merge: true }
  );
  await batch.commit();
  return { id: messageRef.id, sender: "admin", text, createdAt: now };
}
