import Link from "next/link";
import { Card, ErrorBanner, PageHeader } from "@/components/ui";
import { AnalyticsCharts } from "@/components/analytics-charts";
import { getUsers, getPayments } from "@/lib/data";
import { DAY_MS, parseAmount } from "@/lib/plan";
import { formatUZS, clampRange, toMillis } from "@/lib/format";
import type { PlanDistribution } from "@/lib/types";

export const dynamic = "force-dynamic";

const RANGES = [
  { value: "7", label: "7 kun" },
  { value: "30", label: "30 kun" },
  { value: "90", label: "90 kun" },
  { value: "0", label: "Barchasi" },
];

const MONTH_NAMES = [
  "Yan", "Fev", "Mar", "Apr", "May", "Iyun", "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek",
];

function dayLabel(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(ts: number): string {
  const d = new Date(ts);
  return `${MONTH_NAMES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

function bucketKey(ts: number, monthly: boolean): string {
  const d = new Date(ts);
  return monthly
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range } = await searchParams;
  const days = clampRange(range, 30);
  const monthly = days === 0;
  const from = monthly ? 0 : Date.now() - days * DAY_MS;

  let data:
    | {
        registrations: { label: string; count: number }[];
        payments: { label: string; approved: number; rejected: number; pending: number }[];
        revenue: { label: string; sum: number }[];
        planDistribution: PlanDistribution;
        totals: { users: number; approved: number; rejected: number; pending: number; revenue: number };
      }
    | undefined;
  let error: string | null = null;

  try {
    const [users, payments] = await Promise.all([getUsers(), getPayments()]);

    const usersInRange = users.filter((u) => (u.createdAt ?? 0) >= from);
    const paymentsInRange = payments.filter((p) => (p.createdAt ?? 0) >= from);

    // Registrations per bucket
    const regBuckets = new Map<string, { label: string; count: number }>();
    for (const u of usersInRange) {
      const ts = toMillis(u.createdAt) ?? 0;
      const key = bucketKey(ts, monthly);
      const label = monthly ? monthLabel(ts) : dayLabel(ts);
      const entry = regBuckets.get(key) ?? { label, count: 0 };
      entry.count += 1;
      regBuckets.set(key, entry);
    }
    const registrations = [...regBuckets.values()]
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((e) => ({ ...e, label: e.label }));

    // Payments per bucket
    const payBuckets = new Map<
      string,
      { label: string; approved: number; rejected: number; pending: number; sum: number }
    >();
    for (const p of paymentsInRange) {
      const ts = toMillis(p.createdAt) ?? Date.now();
      const key = bucketKey(ts, monthly);
      const label = monthly ? monthLabel(ts) : dayLabel(ts);
      const entry =
        payBuckets.get(key) ?? { label, approved: 0, rejected: 0, pending: 0, sum: 0 };
      if (p.status === "approved") {
        entry.approved += 1;
        entry.sum += parseAmount(p.amount);
      } else if (p.status === "rejected") {
        entry.rejected += 1;
      } else {
        entry.pending += 1;
      }
      payBuckets.set(key, entry);
    }
    const payRows = [...payBuckets.values()]
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((e) => ({ label: e.label, approved: e.approved, rejected: e.rejected, pending: e.pending }));
    const revenue = [...payBuckets.values()]
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((e) => ({ label: e.label, sum: e.sum }));

    const planDistribution: PlanDistribution = { free: 0, pro: 0, max: 0 };
    for (const u of users) planDistribution[u.plan] += 1;

    data = {
      registrations,
      payments: payRows,
      revenue,
      planDistribution,
      totals: {
        users: usersInRange.length,
        approved: paymentsInRange.filter((p) => p.status === "approved").length,
        rejected: paymentsInRange.filter((p) => p.status === "rejected").length,
        pending: paymentsInRange.filter((p) => p.status === "pending").length,
        revenue: paymentsInRange
          .filter((p) => p.status === "approved")
          .reduce((sum, p) => sum + parseAmount(p.amount), 0),
      },
    };
  } catch (e) {
    error = e instanceof Error ? e.message : "Server xatosi";
  }

  const activeRange = String(days);

  return (
    <div className="space-y-4">
      <PageHeader title="Analitika" subtitle="Real ma'lumotlar asosida hisoblangan ko'rsatkichlar" />

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-600 dark:text-gray-300">Davr:</span>
        {RANGES.map((r) => (
          <Link
            key={r.value}
            href={`/dashboard/analytics?range=${r.value}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              activeRange === r.value
                ? "bg-blue-600 text-white"
                : "border border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            }`}
          >
            {r.label}
          </Link>
        ))}
      </div>

      {error ? (
        <ErrorBanner message={`Ma'lumotlarni yuklab bo'lmadi: ${error}`} />
      ) : data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <MiniStat label="Yangi foydalanuvchilar" value={String(data.totals.users)} />
            <MiniStat label="Tasdiqlangan to'lovlar" value={String(data.totals.approved)} />
            <MiniStat label="Rad etilgan" value={String(data.totals.rejected)} />
            <MiniStat label="Kutilayotgan" value={String(data.totals.pending)} />
            <MiniStat label="Daromad (tax.)" value={formatUZS(data.totals.revenue)} />
          </div>

          <AnalyticsCharts
            registrations={data.registrations}
            payments={data.payments}
            revenue={data.revenue}
            planDistribution={data.planDistribution}
          />
        </div>
      ) : (
        <Card className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
          Ma&apos;lumot topilmadi.
        </Card>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
    </Card>
  );
}