import { FieldValue } from "firebase-admin/firestore";

/**
 * Support chat between a teacher and the administrators — SERVER SIDE ONLY.
 *
 *   supportChats/{uid}                 one thread per user
 *     uid, userName, userEmail, lastMessage, lastMessageAt, lastSender,
 *     unreadByAdmin, unreadByUser, createdAt, updatedAt
 *   supportChats/{uid}/messages/{id}   sender: "user" | "admin", text, createdAt (ms)
 *
 * Only the Admin SDK touches these documents: firestore.rules denies every
 * client read/write through the catch-all rule, so a browser can neither read
 * another user's thread nor forge an "admin" message.
 */

export const SUPPORT_CHATS = "supportChats";
export const MAX_MESSAGE_LENGTH = 2000;
export const PAGE_SIZE = 100;

// Control characters except \t and \n.
const CONTROL_CHARS = /[\u0000-\u0008\u000B-\u001F\u007F]/g;

/** @returns {{ text: string } | { error: "empty" | "too_long" }} */
export function cleanMessageText(raw) {
  if (typeof raw !== "string") return { error: "empty" };
  const text = raw.replace(/\r\n?/g, "\n").replace(CONTROL_CHARS, "").trim();
  if (!text) return { error: "empty" };
  if (text.length > MAX_MESSAGE_LENGTH) return { error: "too_long" };
  return { text };
}

function toMessage(doc) {
  const d = doc.data() || {};
  return {
    id: doc.id,
    sender: d.sender === "admin" ? "admin" : "user",
    text: String(d.text || ""),
    createdAt: Number(d.createdAt) || 0,
  };
}

/**
 * Messages of one thread, oldest first. Without `since` the latest page is
 * returned; with `since` everything created at or after it (the client
 * de-duplicates by id, so two messages in the same millisecond are not lost).
 */
export async function listMessages(db, uid, since = 0) {
  const col = db.collection(SUPPORT_CHATS).doc(uid).collection("messages");
  if (since > 0) {
    const snap = await col.where("createdAt", ">=", since).orderBy("createdAt", "asc").limit(PAGE_SIZE).get();
    return snap.docs.map(toMessage);
  }
  const snap = await col.orderBy("createdAt", "desc").limit(PAGE_SIZE).get();
  return snap.docs.map(toMessage).reverse();
}

/** Unread admin replies for the user (0 when no thread exists yet). */
export async function unreadForUser(db, uid) {
  const snap = await db.collection(SUPPORT_CHATS).doc(uid).get();
  return snap.exists ? Number(snap.data().unreadByUser) || 0 : 0;
}

export async function markReadByUser(db, uid) {
  const ref = db.collection(SUPPORT_CHATS).doc(uid);
  const snap = await ref.get();
  if (snap.exists && Number(snap.data().unreadByUser) > 0) await ref.update({ unreadByUser: 0 });
}

/**
 * Append a user message and update the thread summary in one batch.
 * @param {{ uid: string, text: string, userName: string, userEmail: string, now?: number }} p
 */
export async function postUserMessage(db, { uid, text, userName, userEmail, now = Date.now() }) {
  const threadRef = db.collection(SUPPORT_CHATS).doc(uid);
  const messageRef = threadRef.collection("messages").doc();
  const existing = await threadRef.get();

  const batch = db.batch();
  batch.set(messageRef, { sender: "user", text, createdAt: now });
  batch.set(
    threadRef,
    {
      uid,
      userName,
      userEmail,
      lastMessage: text.slice(0, 200),
      lastMessageAt: now,
      lastSender: "user",
      unreadByAdmin: FieldValue.increment(1),
      unreadByUser: 0,
      updatedAt: now,
      ...(existing.exists ? {} : { createdAt: now }),
    },
    { merge: true }
  );
  await batch.commit();
  return { id: messageRef.id, sender: "user", text, createdAt: now };
}
