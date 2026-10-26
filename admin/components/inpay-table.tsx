"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge, EmptyState, Input, PlanBadge, Select, TableShell, Td, Th } from "@/components/ui";
import { formatDateTime, formatUZS } from "@/lib/format";
import type { InpayPayment, InpayStatus } from "@/lib/types";

const STATUS: Record<InpayStatus, { label: string; tone: "green" | "amber" | "red" | "gray" | "purple" }> = {
  success: { label: "To'langan", tone: "green" },
  pending: { label: "Kutilmoqda", tone: "amber" },
  creating: { label: "Yaratilmoqda", tone: "gray" },
  failed: { label: "Muvaffaqiyatsiz", tone: "red" },
  cancelled: { label: "Bekor qilingan", tone: "gray" },
  expired: { label: "Muddati o'tgan", tone: "gray" },
  review: { label: "Tekshiruv kerak", tone: "purple" },
  refunded: { label: "Qaytarilgan", tone: "purple" },
};

/** Read-only list: inPAY payments are verified and applied by the frontend server. */
export function InpayTable({ payments }: { payments: InpayPayment[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | InpayStatus>("all");
  const [mode, setMode] = useState<"all" | "live" | "test">("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return payments.filter((p) => {
      if (status !== "all" && p.status !== status) return false;
      if (mode === "live" && !p.livemode) return false;
      if (mode === "test" && p.livemode) return false;
      if (!q) return true;
      return [p.userName, p.userEmail, p.providerPaymentId, p.id].some((v) => v?.toLowerCase().includes(q));
    });
  }, [payments, query, status, mode]);

  return (
    <div>
      <div className="flex flex-col gap-2 border-b border-gray-100 p-4 dark:border-gray-800 sm:flex-row">
        <Input placeholder="Ism, email yoki to'lov ID" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Select value={status} onChange={(e) => setStatus(e.target.value as "all" | InpayStatus)}>
          <option value="all">Barcha holatlar</option>
          {(Object.keys(STATUS) as InpayStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS[s].label}
            </option>
          ))}
        </Select>
        <Select value={mode} onChange={(e) => setMode(e.target.value as "all" | "live" | "test")}>
          <option value="all">Real + sinov</option>
          <option value="live">Faqat real</option>
          <option value="test">Faqat sinov</option>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="inPAY to'lovlari yo'q"
          description="Foydalanuvchi «inPAY orqali to'lash» tugmasini bosganda to'lovlar shu yerda ko'rinadi."
        />
      ) : (
        <TableShell>
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <Th>Foydalanuvchi</Th>
              <Th>Tarif</Th>
              <Th>Summa</Th>
              <Th>Holat</Th>
              <Th>Rejim</Th>
              <Th>Yaratilgan</Th>
              <Th>To&apos;langan</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-b border-gray-50 last:border-0 dark:border-gray-800/50">
                <Td>
                  <Link
                    href={`/dashboard/users/${encodeURIComponent(p.uid)}`}
                    className="font-medium text-gray-900 hover:text-blue-600 dark:text-gray-100"
                  >
                    {p.userName || p.userEmail || "Noma'lum"}
                  </Link>
                  {p.userName && p.userEmail && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">{p.userEmail}</p>
                  )}
                </Td>
                <Td>
                  <div className="flex items-center gap-1.5">
                    <PlanBadge plan={p.plan} />
                    <span className="text-xs text-gray-500">{p.billingPeriod === "yearly" ? "yillik" : "oylik"}</span>
                  </div>
                </Td>
                <Td className="font-medium text-gray-900 dark:text-gray-100">{formatUZS(p.amount)}</Td>
                <Td>
                  <Badge tone={STATUS[p.status].tone}>{STATUS[p.status].label}</Badge>
                </Td>
                <Td>
                  <Badge tone={p.livemode ? "blue" : "gray"}>{p.livemode ? "Real" : "Sinov"}</Badge>
                </Td>
                <Td className="whitespace-nowrap text-gray-600 dark:text-gray-300">{formatDateTime(p.createdAt)}</Td>
                <Td className="whitespace-nowrap text-gray-600 dark:text-gray-300">{formatDateTime(p.paidAt)}</Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}
    </div>
  );
}
