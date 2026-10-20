"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge, EmptyState, ErrorBanner, Input, PlanBadge, Select } from "@/components/ui";
import { formatDate, formatDateTime, formatName, formatNumber } from "@/lib/format";
import type { PaymentRequest } from "@/lib/types";

const PAGE_SIZE = 10;

type Filter = "all" | "pending" | "approved" | "rejected";

export function PaymentsTable({ initialPayments }: { initialPayments: PaymentRequest[] }) {
  const router = useRouter();
  const [payments, setPayments] = useState<PaymentRequest[]>(initialPayments);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [pendingAction, setPendingAction] = useState<{ id: string; action: "approve" | "reject" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return payments
      .filter((p) => {
        if (filter !== "all" && p.status !== filter) return false;
        if (!q) return true;
        return (
          (p.userName ?? "").toLowerCase().includes(q) ||
          (p.userEmail ?? "").toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  }, [payments, query, filter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const pendingCount = payments.filter((p) => p.status === "pending").length;

  const runAction = useCallback(
    async (requestId: string, action: "approve" | "reject") => {
      setBusy(true);
      setActionError("");
      try {
        const res = await fetch("/api/admin/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId, action }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          throw new Error(data.error || "Amal bajarilmadi.");
        }
        // Keep the client list in sync immediately (router.refresh() re-renders
        // server components but does not reset this component's state).
        setPayments((prev) =>
          prev.map((p) =>
            p.id === requestId
              ? { ...p, status: action === "approve" ? "approved" : "rejected" }
              : p
          )
        );
        setPendingAction(null);
        router.refresh();
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "Amal bajarilmadi.");
        setPendingAction(null);
      } finally {
        setBusy(false);
      }
    },
    [router]
  );

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-gray-100 p-4 dark:border-gray-800 sm:flex-row sm:items-center">
        <Input
          placeholder="Foydalanuvchi, email yoki ID bo'yicha qidirish..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          className="sm:max-w-xs"
        />
        <Select
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value as Filter);
            setPage(1);
          }}
          className="sm:w-48"
        >
          <option value="all">Barcha holatlar</option>
          <option value="pending">Kutilmoqda ({formatNumber(pendingCount)})</option>
          <option value="approved">Tasdiqlangan</option>
          <option value="rejected">Rad etilgan</option>
        </Select>
        <p className="text-xs text-gray-500 dark:text-gray-400 sm:ml-auto">
          {formatNumber(filtered.length)} ta so&apos;rov
        </p>
      </div>

      {actionError && (
        <div className="border-b border-gray-100 p-4 dark:border-gray-800">
          <ErrorBanner message={actionError} />
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          title="To'lov so'rovlari topilmadi"
          description="Filtr yoki qidiruvni o'zgartirib ko'ring."
        />
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {rows.map((p) => (
            <PaymentRow
              key={p.id}
              request={p}
              onAction={(action) => {
                setActionError("");
                setPendingAction({ id: p.id, action });
              }}
            />
          ))}
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

      <ConfirmDialog
        open={pendingAction !== null}
        title={
          pendingAction?.action === "approve" ? "To'lovni tasdiqlash" : "To'lovni rad etish"
        }
        description={
          pendingAction?.action === "approve"
            ? "Tasdiqlashda so'rov holati va foydalanuvchining obunasi (plan + amal qilish muddati) bitta tranzaksiyada yangilanadi. O'z so'rovingizni tasdiqlash taqiqlangan."
            : "So'rov 'rad etilgan' holatga o'tkaziladi. Foydalanuvchi obunasi o'zgarmaydi."
        }
        confirmLabel={pendingAction?.action === "approve" ? "Tasdiqlash" : "Rad etish"}
        danger={pendingAction?.action === "reject"}
        busy={busy}
        onConfirm={() => pendingAction && runAction(pendingAction.id, pendingAction.action)}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
}

function PaymentRow({
  request,
  onAction,
}: {
  request: PaymentRequest;
  onAction: (action: "approve" | "reject") => void;
}) {
  return (
    <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {request.userName || formatName({ email: request.userEmail })}
          </span>
          {request.userEmail && request.userName && (
            <span className="text-xs text-gray-500 dark:text-gray-400">{request.userEmail}</span>
          )}
          <StatusBadge status={request.status} />
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Tarif: </span>
            <span className="inline-block align-middle"><PlanBadge plan={request.plan} /></span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">To'lov davri: </span>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {request.billingPeriod === "yearly" ? "Yillik" : "Oylik"}
            </span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Summa: </span>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {request.amount ? `${request.amount} UZS` : "—"}
            </span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Karta: </span>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              ****{request.cardLastFour || "————"}
            </span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Karta egasi: </span>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {request.cardholderName || "—"}
            </span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">To'lov vaqti: </span>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {request.paymentDateTime
                ? formatDate(new Date(request.paymentDateTime).getTime(), true)
                : "—"}
            </span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Yuborilgan: </span>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {formatDateTime(request.createdAt)}
            </span>
          </div>
          {request.processedAt && (
            <div>
              <span className="text-gray-500 dark:text-gray-400">Ko'rib chiqilgan: </span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {formatDateTime(request.processedAt)}
              </span>
            </div>
          )}
        </div>
      </div>

      {request.status === "pending" && (
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => onAction("approve")}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
          >
            Tasdiqlash
          </button>
          <button
            type="button"
            onClick={() => onAction("reject")}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            Rad etish
          </button>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: PaymentRequest["status"] }) {
  const map = {
    pending: { tone: "amber" as const, label: "Kutilmoqda" },
    approved: { tone: "green" as const, label: "Tasdiqlangan" },
    rejected: { tone: "red" as const, label: "Rad etilgan" },
  };
  const item = map[status];
  return <Badge tone={item.tone}>{item.label}</Badge>;
}