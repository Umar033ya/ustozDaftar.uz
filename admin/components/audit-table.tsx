"use client";

import { useMemo, useState } from "react";
import { Badge, EmptyState, Td, Th } from "@/components/ui";
import { Input } from "@/components/ui";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { AuditAction, AuditLog } from "@/lib/types";

const PAGE_SIZE = 25;

const ACTION_LABELS: Record<AuditAction, string> = {
  "payment.approve": "To'lov tasdiqlandi",
  "payment.reject": "To'lov rad etildi",
  "subscription.set": "Tarif o'zgartirildi",
};

const ACTION_TONES: Record<AuditAction, "green" | "red" | "blue"> = {
  "payment.approve": "green",
  "payment.reject": "red",
  "subscription.set": "blue",
};

export function AuditTable({ initialLogs }: { initialLogs: AuditLog[] }) {
  const [logs] = useState<AuditLog[]>(initialLogs);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | AuditAction>("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs
      .filter((log) => {
        if (filter !== "all" && log.action !== filter) return false;
        if (!q) return true;
        return (
          (log.actorEmail ?? "").toLowerCase().includes(q) ||
          (log.targetEmail ?? "").toLowerCase().includes(q) ||
          (log.details?.requestId as string | undefined)?.toLowerCase().includes(q) ||
          String(log.targetUid ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [logs, query, filter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-gray-100 p-4 dark:border-gray-800 sm:flex-row sm:items-center">
        <Input
          placeholder="Email, ID yoki so'rov bo'yicha qidirish..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          className="sm:max-w-xs"
        />
        <select
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value as "all" | AuditAction);
            setPage(1);
          }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 sm:w-56"
        >
          <option value="all">Barcha amallar</option>
          <option value="payment.approve">To'lov tasdiqlash</option>
          <option value="payment.reject">To'lov rad etish</option>
          <option value="subscription.set">Tarif o'zgarishi</option>
        </select>
        <p className="text-xs text-gray-500 dark:text-gray-400 sm:ml-auto">
          {formatNumber(filtered.length)} ta yozuv
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Yozuvlar topilmadi" description="Qidiruv yoki filtrlarni o'zgartirib ko'ring." />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
            <thead>
              <tr>
                <Th>Amal</Th>
                <Th>Admin</Th>
                <Th>Maqsad</Th>
                <Th>Tafsilot</Th>
                <Th>Sana</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {rows.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <Td>
                    <Badge tone={ACTION_TONES[log.action]}>{ACTION_LABELS[log.action]}</Badge>
                  </Td>
                  <Td className="text-gray-700 dark:text-gray-200">
                    {log.actorEmail || log.actorUid}
                  </Td>
                  <Td className="text-gray-600 dark:text-gray-300">
                    {log.targetEmail || log.targetUid || "—"}
                  </Td>
                  <Td className="text-gray-600 dark:text-gray-300">
                    <DetailsText log={log} />
                  </Td>
                  <Td className="whitespace-nowrap text-gray-600 dark:text-gray-300">
                    {formatDateTime(log.createdAt)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 dark:border-gray-800">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {currentPage} / {formatNumber(pageCount)} sahifa
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              ← Oldingi
            </button>
            <button
              type="button"
              disabled={currentPage >= pageCount}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Keyingi →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailsText({ log }: { log: AuditLog }) {
  const details = log.details ?? {};
  if (log.action === "payment.approve" || log.action === "payment.reject") {
    const requestId = details.requestId as string | undefined;
    return requestId ? (
      <span className="font-mono text-xs">{requestId.slice(0, 10)}…</span>
    ) : (
      <span className="text-gray-400 dark:text-gray-500">—</span>
    );
  }
  if (log.action === "subscription.set") {
    const plan = details.plan as string | undefined;
    const expiry = details.planExpiry as number | undefined;
    return (
      <span>
        <span className="font-medium text-gray-800 dark:text-gray-200">{plan ?? "—"}</span>
        {expiry ? <span className="text-gray-500 dark:text-gray-400"> · {formatDateTime(expiry)}</span> : null}
      </span>
    );
  }
  return <span className="text-gray-400 dark:text-gray-500">—</span>;
}