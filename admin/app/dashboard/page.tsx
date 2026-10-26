import Link from "next/link";
import { Card, CardHeader, PlanBadge, StatCard, StatusBadge, TableShell, Td, Th } from "@/components/ui";
import { getOverviewStats } from "@/lib/data";
import { formatDateTime, formatNumber, formatUZS } from "@/lib/format";
import type { PaymentRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  let stats;
  try {
    stats = await getOverviewStats();
  } catch (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Bosh sahifa</h1>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Ma&apos;lumotlarni yuklab bo&apos;lmadi:{" "}
          {error instanceof Error ? error.message : "Server xatosi"}. Admin server
          ma&apos;lumotlari (FIREBASE_SERVICE_ACCOUNT) sozlanganligini tekshiring.
        </div>
      </div>
    );
  }

  const planTotal =
    stats.planDistribution.free + stats.planDistribution.pro + stats.planDistribution.max;
  const planPercent = (value: number) =>
    planTotal === 0 ? 0 : Math.round((value / planTotal) * 100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Bosh sahifa</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          UstozDaftar.uz umumiy holati — real ma&apos;lumotlar asosida.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Jami foydalanuvchilar"
          value={formatNumber(stats.totalUsers)}
          tone="blue"
        />
        <StatCard
          label="Yangi foydalanuvchilar (30 kun)"
          value={formatNumber(stats.newUsers30d)}
          tone="purple"
        />
        <StatCard
          label="Faol obunalar"
          value={formatNumber(stats.activeSubscriptions)}
          hint="Muddati tugamagan Pullik tariflar"
          tone="green"
        />
        <StatCard
          label="Daromad (taxminiy)"
          value={formatUZS(stats.revenueEstimate)}
          hint="Tasdiqlangan so'rovlar yig'indisi"
          tone="amber"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Yaratilgan sinflar"
          value={formatNumber(stats.totalClasses)}
          hint={`${formatNumber(stats.teachersWithClasses)} ta o'qituvchida sinf bor`}
          tone="blue"
        />
        <StatCard
          label="O'quvchilar"
          value={formatNumber(stats.totalStudents)}
          hint="Barcha sinflardagi o'quvchilar"
          tone="purple"
        />
        <StatCard
          label="BSB"
          value={formatNumber(stats.totalBsb)}
          hint="Yaratilgan bo'lim bo'yicha baholashlar"
          tone="green"
        />
        <StatCard
          label="ChSB"
          value={formatNumber(stats.totalChsb)}
          hint="Yaratilgan chorak bo'yicha baholashlar"
          tone="amber"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Kutilayotgan to'lovlar"
          value={formatNumber(stats.pendingPayments)}
          hint="Tasdiqlash kutilmoqda"
          tone="amber"
        />
        <StatCard
          label="Tasdiqlangan to'lovlar"
          value={formatNumber(stats.approvedPayments)}
          tone="green"
        />
        <StatCard
          label="Rad etilgan to'lovlar"
          value={formatNumber(stats.rejectedPayments)}
          tone="red"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Tariflar bo'yicha taqsimot" subtitle="Barcha foydalanuvchilar (joriy holat)" />
          <div className="space-y-4 p-5">
            {(["free", "pro", "max"] as const).map((plan) => (
              <div key={plan}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <PlanBadge plan={plan} />
                  <span className="font-semibold text-gray-700 dark:text-gray-200">
                    {formatNumber(stats.planDistribution[plan])}
                    <span className="ml-1 font-normal text-gray-400">
                      ({planPercent(stats.planDistribution[plan])}%)
                    </span>
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div
                    className={
                      plan === "free"
                        ? "h-full bg-gray-300 dark:bg-gray-600"
                        : plan === "pro"
                          ? "h-full bg-blue-500"
                          : "h-full bg-purple-500"
                    }
                    style={{ width: `${planPercent(stats.planDistribution[plan])}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="So'nggi to'lov so'rovlari"
            subtitle="Oxirgi 6 ta so'rov"
            action={
              <Link
                href="/dashboard/payments"
                className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                Barchasi →
              </Link>
            }
          />
          {stats.recentPayments.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
              Hozircha hech qanday to&apos;lov so&apos;rovi mavjud emas.
            </div>
          ) : (
            <TableShell>
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <Th>Foydalanuvchi</Th>
                  <Th>Tarif</Th>
                  <Th>Summa</Th>
                  <Th>Holat</Th>
                  <Th>Sana</Th>
                </tr>
              </thead>
              <tbody>
                {stats.recentPayments.map((p: PaymentRequest) => (
                  <tr key={p.id} className="border-b border-gray-50 last:border-0 dark:border-gray-800/50">
                    <Td>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {p.userName || p.userEmail || "Noma'lum"}
                      </p>
                      {p.userEmail && p.userName && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">{p.userEmail}</p>
                      )}
                    </Td>
                    <Td>
                      <PlanBadge plan={p.plan} />
                    </Td>
                    <Td className="font-medium text-gray-900 dark:text-gray-100">
                      {p.amount ? `${p.amount} UZS` : "—"}
                    </Td>
                    <Td>
                      <StatusBadge status={p.status} />
                    </Td>
                    <Td className="text-gray-600 dark:text-gray-300">
                      {formatDateTime(p.createdAt)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          )}
        </Card>
      </div>
    </div>
  );
}