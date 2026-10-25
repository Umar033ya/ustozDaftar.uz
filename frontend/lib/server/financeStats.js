import { parseAmount } from "./manualPayments.js";
import { toMillis } from "./subscriptionPayments.js";

/**
 * Admin financial report — pure functions over verified payment records.
 *
 * Sources of truth:
 *   inpayPayments    status set only by the server after inPAY's GET /payments/{id}
 *   paymentRequests  manual transfers; "approved" only after an admin checked them
 *
 * Revenue ("collected") = status "success" AND livemode AND not refunded.
 * Every payment is one document, so a webhook delivered eight times or a
 * refreshed return page can never be counted twice. Pending, failed,
 * cancelled, expired, review and refunded payments are never revenue.
 *
 * Dates are bucketed in Asia/Tashkent (UTC+5, no daylight saving time).
 */

export const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
export const PAGE_SIZE = 25;

export const STATUS_LABELS = {
  success: "Muvaffaqiyatli",
  pending: "Kutilmoqda",
  creating: "Yaratilmoqda",
  failed: "Muvaffaqiyatsiz",
  cancelled: "Bekor qilingan",
  expired: "Muddati o'tgan",
  rejected: "Rad etilgan",
  review: "Tekshiruvda",
  refunded: "Qaytarilgan",
};

const FAILED_GROUP = new Set(["failed", "cancelled", "expired", "rejected"]);
const PENDING_GROUP = new Set(["pending", "creating"]);

/** YYYY-MM-DD of an instant in Tashkent time. */
export function dayKey(ms) {
  return new Date(ms + TASHKENT_OFFSET_MS).toISOString().slice(0, 10);
}

/** YYYY-MM of an instant in Tashkent time. */
export function monthKey(ms) {
  return dayKey(ms).slice(0, 7);
}

/** Start (UTC ms) of a Tashkent calendar day given as YYYY-MM-DD. */
export function dayStart(key) {
  return Date.parse(`${key}T00:00:00Z`) - TASHKENT_OFFSET_MS;
}

export function normalizeInpay(id, p) {
  return {
    id,
    source: "inpay",
    provider: "inpay",
    providerPaymentId: p.providerPaymentId || null,
    uid: p.uid || "",
    plan: p.plan,
    billingPeriod: p.billingPeriod,
    amount: Number(p.amount) || 0,
    currency: p.currency || "UZS",
    status: p.status || "pending",
    livemode: p.livemode === true,
    createdAt: toMillis(p.createdAt) || 0,
    paidAt: toMillis(p.paidAt) || toMillis(p.activatedAt),
    refundedAt: toMillis(p.refundedAt),
    customerName: "",
    customerEmail: "",
  };
}

export function normalizeManual(id, r) {
  const statusMap = { approved: "success", pending: "pending", rejected: "rejected", refunded: "refunded" };
  return {
    id,
    source: "manual",
    provider: "manual",
    providerPaymentId: r.cardLastFour ? `karta ****${r.cardLastFour}` : null,
    uid: r.uid || "",
    plan: r.plan,
    billingPeriod: r.billingPeriod,
    amount: r.amountValue ?? parseAmount(r.amount),
    currency: "UZS",
    status: statusMap[r.status] || "pending",
    livemode: true,
    createdAt: toMillis(r.createdAt) || 0,
    paidAt: r.status === "approved" || r.status === "refunded" ? toMillis(r.activatedAt) || toMillis(r.processedAt) : null,
    refundedAt: toMillis(r.refundedAt),
    customerName: r.userName || "",
    customerEmail: r.userEmail || "",
  };
}

export function isCollected(t, includeTest = false) {
  return t.status === "success" && (t.livemode || includeTest) && Boolean(t.paidAt);
}

/**
 * @param {{ transactions: ReturnType<typeof normalizeInpay>[],
 *           users: { uid: string, plan?: string, planExpiry?: number, name?: string, email?: string }[],
 *           filters: { from?: string, to?: string, status?: string, plan?: string, provider?: string,
 *                      includeTest?: boolean, page?: number },
 *           now: number }} input
 */
export function buildFinanceReport({ transactions, users, filters = {}, now }) {
  const includeTest = filters.includeTest === true;
  const visible = transactions.filter((t) => t.livemode || includeTest);
  const byUid = new Map(users.map((u) => [u.uid, u]));

  // ── Overview cards (independent of the table filters) ──────────────────────
  const today = dayKey(now);
  const month = monthKey(now);
  const collected = visible.filter((t) => isCollected(t, includeTest));
  const sum = (list) => list.reduce((acc, t) => acc + t.amount, 0);

  let activePro = 0;
  let activeMax = 0;
  let expired = 0;
  for (const u of users) {
    const paid = u.plan === "pro" || u.plan === "max";
    if (!paid) continue;
    if (typeof u.planExpiry === "number" && u.planExpiry > now) {
      if (u.plan === "pro") activePro += 1;
      else activeMax += 1;
    } else {
      expired += 1;
    }
  }

  const cards = {
    totalRevenue: sum(collected),
    revenueToday: sum(collected.filter((t) => dayKey(t.paidAt) === today)),
    revenueMonth: sum(collected.filter((t) => monthKey(t.paidAt) === month)),
    successCount: collected.length,
    pendingCount: visible.filter((t) => PENDING_GROUP.has(t.status)).length,
    failedCount: visible.filter((t) => FAILED_GROUP.has(t.status)).length,
    activePro,
    activeMax,
    expiredSubscriptions: expired,
  };

  // ── Filtered set (date range on creation day, Tashkent) ────────────────────
  const to = filters.to || today;
  const from = filters.from || dayKey(dayStart(to) - 29 * 86_400_000);
  const fromMs = dayStart(from);
  const toMs = dayStart(to) + 86_400_000;
  const filtered = visible
    .filter((t) => t.createdAt >= fromMs && t.createdAt < toMs)
    .filter((t) => !filters.plan || t.plan === filters.plan)
    .filter((t) => !filters.provider || t.provider === filters.provider);

  const statusCounts = {};
  for (const t of filtered) statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;

  // Revenue charts use the payment day, restricted to the same range/plan/provider.
  const paidInRange = visible
    .filter((t) => isCollected(t, includeTest) && t.paidAt >= fromMs && t.paidAt < toMs)
    .filter((t) => !filters.plan || t.plan === filters.plan)
    .filter((t) => !filters.provider || t.provider === filters.provider);

  const daily = [];
  for (let ms = fromMs; ms < toMs && daily.length < 366; ms += 86_400_000) daily.push({ key: dayKey(ms), amount: 0, count: 0 });
  const dailyIndex = new Map(daily.map((d, i) => [d.key, i]));
  for (const t of paidInRange) {
    const i = dailyIndex.get(dayKey(t.paidAt));
    if (i !== undefined) {
      daily[i].amount += t.amount;
      daily[i].count += 1;
    }
  }

  // Monthly: the 12 months ending with the current month (all collected payments).
  const monthly = [];
  const [y, m] = month.split("-").map(Number);
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    monthly.push({ key: d.toISOString().slice(0, 7), amount: 0, count: 0 });
  }
  const monthlyIndex = new Map(monthly.map((d, i) => [d.key, i]));
  for (const t of collected) {
    const i = monthlyIndex.get(monthKey(t.paidAt));
    if (i !== undefined) {
      monthly[i].amount += t.amount;
      monthly[i].count += 1;
    }
  }

  const planDistribution = {
    pro: activePro,
    max: activeMax,
    expired,
    free: users.length - activePro - activeMax - expired,
  };

  // ── Table ──────────────────────────────────────────────────────────────────
  const tableRows = filtered
    .filter((t) => !filters.status || t.status === filters.status)
    .sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id));
  const pageSize = PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(tableRows.length / pageSize));
  const page = Math.min(Math.max(1, Number(filters.page) || 1), pageCount);
  const rows = tableRows.slice((page - 1) * pageSize, page * pageSize).map((t) => {
    const u = byUid.get(t.uid);
    return {
      ...t,
      customerName: t.customerName || u?.name || "",
      customerEmail: t.customerEmail || u?.email || "",
    };
  });

  return {
    generatedAt: now,
    timezone: "Asia/Tashkent (UTC+5)",
    range: { from, to },
    cards,
    charts: { daily, monthly, statusCounts, planDistribution },
    table: { rows, page, pageCount, total: tableRows.length, pageSize },
  };
}
