import { adminDb } from "@/lib/firebaseAdmin";

/**
 * AI student import is a paid feature. Mirrors subscriptionContext: a paid
 * plan counts until its expiry has passed (a missing expiry never expires).
 *
 * @param {Record<string, unknown> | undefined} data users/{uid} document
 * @returns {"ok" | "blocked" | "plan_required"}
 */
export function aiAccessFor(data, now = Date.now()) {
  if (!data) return "plan_required";
  if (data.blocked === true) return "blocked";
  const plan = data.plan;
  if (plan !== "pro" && plan !== "max") return "plan_required";
  const expiry = data.planExpiry;
  const ms = typeof expiry === "number" ? expiry : typeof expiry?.toMillis === "function" ? expiry.toMillis() : null;
  if (ms !== null && ms < now) return "plan_required";
  return "ok";
}

/** Reads the caller's profile with the Admin SDK and decides AI access. */
export async function checkAiAccess(uid) {
  const snap = await adminDb().collection("users").doc(uid).get();
  return aiAccessFor(snap.exists ? snap.data() : undefined);
}
