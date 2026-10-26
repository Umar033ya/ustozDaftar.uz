"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardHeader, EmptyState } from "@/components/ui";
import { formatUZS } from "@/lib/format";
import type { PlanDistribution } from "@/lib/types";

const PLAN_COLORS = { free: "#d1d5db", pro: "#10b981", max: "#3b82f6" };

function UzsTooltip({ active, payload, label }: { active?: boolean; payload?: unknown[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const value = (payload[0] as { value?: number })?.value ?? 0;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-md dark:border-gray-700 dark:bg-gray-900">
      <p className="font-semibold text-gray-900 dark:text-gray-100">{label}</p>
      <p className="mt-0.5 text-gray-600 dark:text-gray-300">{formatUZS(Number(value))}</p>
    </div>
  );
}

function CountTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: unknown[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-md dark:border-gray-700 dark:bg-gray-900">
      <p className="font-semibold text-gray-900 dark:text-gray-100">{label}</p>
      {payload.map((entry, i) => {
        const item = entry as { name?: string; value?: number; color?: string };
        return (
          <p key={i} className="mt-0.5 text-gray-600 dark:text-gray-300">
            <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: item.color }} />
            {item.name}: {item.value ?? 0}
          </p>
        );
      })}
    </div>
  );
}

export function AnalyticsCharts({
  registrations,
  payments,
  revenue,
  planDistribution,
}: {
  registrations: { label: string; count: number }[];
  payments: { label: string; approved: number; rejected: number; pending: number }[];
  revenue: { label: string; sum: number }[];
  planDistribution: PlanDistribution;
}) {
  const planData = (
    [
      { name: "Free", value: planDistribution.free, color: PLAN_COLORS.free },
      { name: "Pro", value: planDistribution.pro, color: PLAN_COLORS.pro },
      { name: "Max", value: planDistribution.max, color: PLAN_COLORS.max },
    ] as const
  ).filter((item) => item.value > 0);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader title="Yangi foydalanuvchilar" subtitle="Ro'yxatdan o'tishlar (tanlangan davr)" />
        <div className="h-64 p-4">
          {registrations.length === 0 ? (
            <EmptyState title="Ma'lumot yo'q" description="Bu davrda ro'yxatdan o'tishlar kuzatilmadi." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={registrations} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="regGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <Tooltip content={<CountTooltip />} />
                <Area
                  type="monotone"
                  dataKey="count"
                  name="Foydalanuvchilar"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#regGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="To'lovlar" subtitle="Holat bo'yicha (tanlangan davr)" />
        <div className="h-64 p-4">
          {payments.length === 0 ? (
            <EmptyState title="Ma'lumot yo'q" description="Bu davrda to'lov so'rovlari kuzatilmadi." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={payments} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <Tooltip content={<CountTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="approved" name="Tasdiqlangan" stackId="a" fill="#10b981" />
                <Bar dataKey="pending" name="Kutilayotgan" stackId="a" fill="#f59e0b" />
                <Bar dataKey="rejected" name="Rad etilgan" stackId="a" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Daromad (taxminiy)" subtitle="Tasdiqlangan so'rovlar summasi (tanlangan davr)" />
        <div className="h-64 p-4">
          {revenue.length === 0 ? (
            <EmptyState title="Ma'lumot yo'q" description="Bu davrda daromad kuzatilmadi." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenue} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <Tooltip content={<UzsTooltip />} />
                <Bar dataKey="sum" name="Daromad" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Tariflar taqsimoti" subtitle="Barcha foydalanuvchilar (joriy holat)" />
        <div className="h-64 p-4">
          {planData.length === 0 ? (
            <EmptyState title="Ma'lumot yo'q" description="Hozircha foydalanuvchilar yo'q." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={planData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={(entry) => {
                    const e = entry as { name?: string; percent?: number };
                    return `${e.name} ${e.percent != null ? Math.round(e.percent * 100) : ""}%`;
                  }}
                >
                  {planData.map((item) => (
                    <Cell key={item.name} fill={item.color} />
                  ))}
                </Pie>
                <Tooltip content={<CountTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>
    </div>
  );
}