import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore, requireAdminCredentials } from "@/lib/firebaseAdmin";
import { ApiError } from "@/lib/apiError";
import type {
  AdminUser,
  AuditAction,
  AuditLog,
  BillingPeriod,
  InpayPayment,
  InpayStatus,
  OverviewStats,
  PaymentRequest,
  PaymentStatus,
  PlanId,
  PlanDistribution,
  UserWorkspace,
} from "@/lib/types";
import { DAY_MS, PLAN_DURATION_DAYS, parseAmount, PLANS } from "@/lib/plan";
import { toMillis } from "@/lib/format";
import { buildWorkspace, summarizeWorkspace } from "@/lib/workspace";

const USERS_COLLECTION = "users";
const PAYMENTS_COLLECTION = "paymentRequests";
const INPAY_COLLECTION = "inpayPayments";
const AUDIT_COLLECTION = "auditLogs";

// ─── Short-lived read cache ──────────────────────────────────────────────────
// The user list reads every teacher document (with classes and assessments),
// and Overview, Users, Subscriptions and Analytics all need it. Sharing one
// result for a few seconds makes moving between pages fast; every admin
// mutation below clears it, so this panel's own changes show up immediately.
const CACHE_TTL_MS = 20_000;
const memo = new Map<string, { value: Promise<unknown>; at: number }>();

function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value as Promise<T>;
  const value = load();
  memo.set(key, { value, at: Date.now() });
  value.catch(() => {
    if (memo.get(key)?.value === value) memo.delete(key);
  });
  return value;
}

export function invalidateAdminCache(): void {
  memo.clear();
}

export const USER_PROJECTION = [
  "firstName",
  "lastName",
  "email",
  "schoolName",
  "createdAt",
  "plan",
  "planExpiry",
] as const;

// The teacher's classes and assessments live inside the user document, so the
// list reads them too to count classes, students and BSB/ChSB per user.
const USER_LIST_PROJECTION = [...USER_PROJECTION, "classes", "assessments"] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

type RawUser = {
  firstName?: string;
  lastName?: string;
  email?: string;
  schoolName?: string;
  createdAt?: unknown;
  plan?: string;
  planExpiry?: unknown;
};

function normalizePlan(value: unknown): PlanId {
  return PLANS.includes(value as PlanId) ? (value as PlanId) : "free";
}

function rawUserToBase(doc: { id: string; data: () => RawUser }): Omit<
  AdminUser,
  keyof ReturnType<typeof summarizeWorkspace> | "hasUpcomingPayments"
> {
  const data = doc.data() ?? {};
  return {
    uid: doc.id,
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    schoolName: data.schoolName,
    createdAt: toMillis(data.createdAt),
    plan: normalizePlan(data.plan),
    planExpiry: toMillis(data.planExpiry),
  };
}

function rawPayment(data: Record<string, unknown>, id: string): PaymentRequest {
  return {
    id,
    uid: String(data.uid ?? ""),
    userName: data.userName as string | undefined,
    userEmail: data.userEmail as string | undefined,
    plan: normalizePlan(data.plan),
    billingPeriod: (data.billingPeriod as BillingPeriod) ?? "monthly",
    amount: data.amount as string | undefined,
    cardLastFour: data.cardLastFour as string | undefined,
    cardholderName: data.cardholderName as string | undefined,
    paymentDateTime: data.paymentDateTime as string | undefined,
    status: (data.status as PaymentStatus) ?? "pending",
    createdAt: toMillis(data.createdAt),
    processedAt: toMillis(data.processedAt),
    processedBy: data.processedBy as string | undefined,
  };
}

function listUsers(): Promise<AdminUser[]> {
  return cached("users", async () => {
    const snapshot = await getAdminFirestore().collection(USERS_COLLECTION).select(...USER_LIST_PROJECTION).get();
    return snapshot.docs.map((doc) => ({
      ...rawUserToBase(doc),
      ...summarizeWorkspace(doc.data()),
      hasUpcomingPayments: false,
    }));
  });
}

function listPayments(limit = 5000): Promise<PaymentRequest[]> {
  return cached(`payments:${limit}`, async () => {
    const snapshot = await getAdminFirestore()
      .collection(PAYMENTS_COLLECTION)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();
    return snapshot.docs.map((doc) => rawPayment(doc.data() ?? {}, doc.id));
  });
}

const INPAY_STATUSES: InpayStatus[] = [
  "creating", "pending", "success", "failed", "cancelled", "expired", "review", "refunded",
];

function listInpayPayments(limit = 2000): Promise<InpayPayment[]> {
  return cached(`inpay:${limit}`, async () => {
    const [snapshot, users] = await Promise.all([
      getAdminFirestore().collection(INPAY_COLLECTION).orderBy("createdAt", "desc").limit(limit).get(),
      listUsers(),
    ]);
    const byUid = new Map(users.map((u) => [u.uid, u]));
    return snapshot.docs.map((doc) => {
      const data = doc.data() ?? {};
      const uid = String(data.uid ?? "");
      const user = byUid.get(uid);
      const status = String(data.status ?? "") as InpayStatus;
      return {
        id: doc.id,
        uid,
        userName: user ? [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined : undefined,
        userEmail: user?.email,
        plan: normalizePlan(data.plan),
        billingPeriod: data.billingPeriod === "yearly" ? "yearly" : "monthly",
        amount: Number(data.amount) || 0,
        status: INPAY_STATUSES.includes(status) ? status : "pending",
        livemode: data.livemode === true,
        providerPaymentId: typeof data.providerPaymentId === "string" ? data.providerPaymentId : undefined,
        createdAt: toMillis(data.createdAt),
        paidAt: toMillis(data.paidAt),
      };
    });
  });
}

async function planDistribution(users: AdminUser[]): Promise<PlanDistribution> {
  const counts: PlanDistribution = { free: 0, pro: 0, max: 0 };
  for (const user of users) counts[user.plan] += 1;
  return counts;
}

// ─── Public server queries ───────────────────────────────────────────────────

export async function getOverviewStats(): Promise<OverviewStats> {
  requireAdminCredentials();
  const [users, payments, inpay] = await Promise.all([listUsers(), listPayments(), listInpayPayments()]);

  const now = Date.now();
  const thirtyDaysAgo = now - 30 * DAY_MS;

  const newUsers30d = users.filter((u) => (u.createdAt ?? 0) >= thirtyDaysAgo).length;
  const activeSubscriptions = users.filter(
    (u) => u.plan !== "free" && (u.planExpiry ?? 0) > now
  ).length;

  const pendingPayments = payments.filter((p) => p.status === "pending").length;
  const approvedPayments = payments.filter((p) => p.status === "approved");
  const rejectedPayments = payments.filter((p) => p.status === "rejected").length;

  // Revenue estimate = sum of approved request amounts (the real UZS strings
  // stored on each request). Never fabricated.
  // inPAY: only verified, real-money (livemode) payments count as revenue.
  const inpaySucceeded = inpay.filter((p) => p.status === "success" && p.livemode);
  const inpayRevenue = inpaySucceeded.reduce((sum, p) => sum + p.amount, 0);
  const revenueEstimate =
    approvedPayments.reduce((sum, p) => sum + parseAmount(p.amount), 0) + inpayRevenue;

  return {
    totalUsers: users.length,
    newUsers30d,
    activeSubscriptions,
    pendingPayments,
    approvedPayments: approvedPayments.length,
    rejectedPayments,
    revenueEstimate,
    inpaySucceeded: inpaySucceeded.length,
    inpayRevenue,
    inpayPending: inpay.filter((p) => p.status === "pending").length,
    planDistribution: await planDistribution(users),
    recentPayments: payments.slice(0, 6),
    totalClasses: users.reduce((sum, u) => sum + u.classCount, 0),
    totalStudents: users.reduce((sum, u) => sum + u.studentCount, 0),
    totalBsb: users.reduce((sum, u) => sum + u.bsbCount, 0),
    totalChsb: users.reduce((sum, u) => sum + u.chsbCount, 0),
    teachersWithClasses: users.filter((u) => u.classCount > 0).length,
  };
}

export async function getUsers(): Promise<AdminUser[]> {
  return listUsers();
}

export async function getUserDetail(uid: string): Promise<AdminUser | null> {
  const snap = await getAdminFirestore().collection(USERS_COLLECTION).doc(uid).get();
  if (!snap.exists) return null;
  return {
    ...rawUserToBase({ id: snap.id, data: () => snap.data() as RawUser }),
    ...summarizeWorkspace(snap.data()),
    hasUpcomingPayments: false,
  };
}

/** Profile + full workspace (classes, rosters, BSB/ChSB with results) of one teacher. */
export async function getUserWorkspace(
  uid: string
): Promise<{ user: AdminUser; workspace: UserWorkspace } | null> {
  const snap = await getAdminFirestore().collection(USERS_COLLECTION).doc(uid).get();
  if (!snap.exists) return null;
  const workspace = buildWorkspace(snap.data());
  return {
    user: {
      ...rawUserToBase({ id: snap.id, data: () => snap.data() as RawUser }),
      ...workspace.counts,
      hasUpcomingPayments: false,
    },
    workspace,
  };
}

export async function getUserPayments(uid: string): Promise<PaymentRequest[]> {
  // Single-field equality query only: `where` + `orderBy` on different fields
  // would require a composite index that is not guaranteed to exist in the
  // project. Sorting in memory keeps the read index-free.
  const snapshot = await getAdminFirestore()
    .collection(PAYMENTS_COLLECTION)
    .where("uid", "==", uid)
    .get();
  return snapshot.docs
    .map((doc) => rawPayment(doc.data() ?? {}, doc.id))
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

export async function getPayments(): Promise<PaymentRequest[]> {
  return listPayments();
}

export async function getInpayPayments(): Promise<InpayPayment[]> {
  return listInpayPayments();
}

export async function getAuditLogs(limit = 300): Promise<AuditLog[]> {
  const snapshot = await getAdminFirestore()
    .collection(AUDIT_COLLECTION)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      action: data.action as AuditAction,
      actorUid: String(data.actorUid ?? ""),
      actorEmail: data.actorEmail as string | undefined,
      targetUid: data.targetUid as string | undefined,
      targetEmail: data.targetEmail as string | undefined,
      details: data.details as Record<string, unknown> | undefined,
      createdAt: toMillis(data.createdAt) ?? 0,
    };
  });
}

// ─── Admin mutations (server-side; require admin claim + Admin SDK) ─────────

async function writeAudit(entry: {
  action: AuditAction;
  actorUid: string;
  actorEmail?: string | null;
  targetUid?: string;
  targetEmail?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  await getAdminFirestore().collection(AUDIT_COLLECTION).add({
    action: entry.action,
    actorUid: entry.actorUid,
    actorEmail: entry.actorEmail ?? null,
    targetUid: entry.targetUid ?? null,
    targetEmail: entry.targetEmail ?? null,
    details: entry.details ?? {},
    createdAt: FieldValue.serverTimestamp(),
  });
}

export async function approvePayment(
  requestId: string,
  actor: { uid: string; email?: string | null }
): Promise<{ requestId: string; plan: PlanId; planExpiry: number }> {
  requireAdminCredentials();
  const firestore = getAdminFirestore();

  // The transaction returns its result directly instead of assigning to an outer
  // variable (avoids TypeScript closure-narrowing issues and keeps it atomic).
  const result = await firestore.runTransaction(async (tx) => {
    const requestRef = firestore.collection(PAYMENTS_COLLECTION).doc(requestId);
    const requestSnap = await tx.get(requestRef);

    if (!requestSnap.exists) {
      throw new ApiError(404, "PAYMENT_NOT_FOUND", "To'lov so'rovi topilmadi.");
    }
    const requestData = requestSnap.data() ?? {};
    if (requestData.status !== "pending") {
      throw new ApiError(409, "NOT_PENDING", "So'rov allaqachon ko'rib chiqilgan.");
    }

    const targetUid = String(requestData.uid ?? "");
    if (!targetUid) {
      throw new ApiError(400, "REQUEST_MISSING_UID", "So'rov egasi aniqlanmadi.");
    }
    if (targetUid === actor.uid) {
      throw new ApiError(403, "SELF_APPROVAL", "O'z to'lov so'rovingizni tasdiqlab bo'lmaydi.");
    }

    const plan = normalizePlan(requestData.plan);
    if (plan === "free") {
      throw new ApiError(400, "INVALID_PLAN", "So'rov noto'g'ri tarifga ega.");
    }
    // Validate the stored period instead of trusting it blindly: an unexpected
    // value would otherwise produce NaN planExpiry and fail the transaction.
    const billingPeriod: BillingPeriod =
      requestData.billingPeriod === "yearly" ? "yearly" : "monthly";
    const durationDays = PLAN_DURATION_DAYS[plan][billingPeriod];
    const planExpiry = Date.now() + durationDays * DAY_MS;

    const userRef = firestore.collection(USERS_COLLECTION).doc(targetUid);
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) {
      throw new ApiError(404, "TARGET_USER_NOT_FOUND", "Obuna yangilanadigan foydalanuvchi topilmadi.");
    }
    const userEmail = (userSnap.data()?.email as string | undefined) ?? undefined;

    tx.update(requestRef, {
      status: "approved",
      processedAt: FieldValue.serverTimestamp(),
      processedBy: actor.uid,
    });
    tx.update(userRef, { plan, planExpiry });

    return { requestId, targetUid, targetEmail: userEmail, plan, planExpiry };
  });
  invalidateAdminCache();

  await writeAudit({
    action: "payment.approve",
    actorUid: actor.uid,
    actorEmail: actor.email,
    targetUid: result.targetUid,
    targetEmail: result.targetEmail,
    details: { requestId, plan: result.plan, planExpiry: result.planExpiry },
  });

  return { requestId, plan: result.plan, planExpiry: result.planExpiry };
}

export async function rejectPayment(
  requestId: string,
  actor: { uid: string; email?: string | null }
): Promise<void> {
  requireAdminCredentials();
  const firestore = getAdminFirestore();
  const requestRef = firestore.collection(PAYMENTS_COLLECTION).doc(requestId);

  const requestData = await firestore.runTransaction(async (tx) => {
    const snap = await tx.get(requestRef);
    if (!snap.exists) {
      throw new ApiError(404, "PAYMENT_NOT_FOUND", "To'lov so'rovi topilmadi.");
    }
    const data = snap.data() ?? {};
    if (data.status !== "pending") {
      throw new ApiError(409, "NOT_PENDING", "So'rov allaqachon ko'rib chiqilgan.");
    }
    tx.update(requestRef, {
      status: "rejected",
      processedAt: FieldValue.serverTimestamp(),
      processedBy: actor.uid,
    });
    return data;
  });
  invalidateAdminCache();

  await writeAudit({
    action: "payment.reject",
    actorUid: actor.uid,
    actorEmail: actor.email,
    targetUid: String(requestData.uid ?? ""),
    details: { requestId },
  });
}

export async function setUserSubscription(
  uid: string,
  plan: PlanId,
  billingPeriod: BillingPeriod,
  actor: { uid: string; email?: string | null }
): Promise<{ plan: PlanId; planExpiry: number | null }> {
  requireAdminCredentials();

  if (!PLANS.includes(plan)) {
    throw new ApiError(400, "INVALID_PLAN", "Ruxsat etilmagan tarif.");
  }
  if (uid === actor.uid) {
    throw new ApiError(403, "SELF_SUBSCRIPTION", "O'z tarifingizni ushbu paneldan o'zgartirib bo'lmaydi.");
  }

  const firestore = getAdminFirestore();
  const userRef = firestore.collection(USERS_COLLECTION).doc(uid);

  const result = await firestore.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) {
      throw new ApiError(404, "USER_NOT_FOUND", "Foydalanuvchi topilmadi.");
    }
    const email = (snap.data()?.email as string | undefined) ?? undefined;
    let planExpiry: number | null = null;

    if (plan === "free") {
      // Matches how the existing frontend stores free users (no active plan).
      tx.update(userRef, { plan: "free", planExpiry: 0 });
    } else {
      const durationDays = PLAN_DURATION_DAYS[plan]?.[billingPeriod] ?? 30;
      planExpiry = Date.now() + durationDays * DAY_MS;
      tx.update(userRef, { plan, planExpiry });
    }
    return { plan, planExpiry, email };
  });
  invalidateAdminCache();

  await writeAudit({
    action: "subscription.set",
    actorUid: actor.uid,
    actorEmail: actor.email,
    targetUid: uid,
    targetEmail: result.email,
    details: { plan, planExpiry: result.planExpiry },
  });

  return { plan: result.plan, planExpiry: result.planExpiry };
}