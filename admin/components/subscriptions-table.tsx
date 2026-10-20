"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge, EmptyState, ErrorBanner, PlanBadge, Select, Td, Th } from "@/components/ui";
import { Input } from "@/components/ui";
import { formatDate, formatName, formatNumber } from "@/lib/format";
import { PLAN_AMOUNTS, subscriptionStatus } from "@/lib/plan";
import type { AdminUser, BillingPeriod, PlanId } from "@/lib/types";

const PAGE_SIZE = 15;

type PlanFilter = "all" | PlanId;

export function SubscriptionsTable({ initialUsers }: { initialUsers: AdminUser[] }) {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>(initialUsers);
  const [query, setQuery] = useState("");
  const [planFilter, setPlanFilter] = useState<PlanFilter>("all");
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<AdminUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState<{ user: AdminUser; plan: PlanId; billingPeriod: BillingPeriod } | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users
      .filter((u) => {
        if (planFilter !== "all" && u.plan !== planFilter) return false;
        if (!q) return true;
        return (
          formatName(u).toLowerCase().includes(q) ||
          (u.email ?? "").toLowerCase().includes(q) ||
          u.uid.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  }, [users, query, planFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const statusTone = (u: AdminUser) => {
    const status = subscriptionStatus(u.plan, u.planExpiry);
    if (status === "active") return { tone: "green" as const, label: "Faol" };
    if (status === "expired") return { tone: "red" as const, label: "Muddati tugagan" };
    return { tone: "gray" as const, label: "Bepul" };
  };

  const runSetPlan = async () => {
    if (!target || !notice) return;
    setBusy(true);
    setActionError("");
    try {
      const res = await fetch("/api/admin/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: target.uid, plan: notice.plan, billingPeriod: notice.billingPeriod }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        result?: { plan: PlanId; planExpiry: number | null };
      };
      if (!res.ok) {
        throw new Error(data.error || "Tarif yangilanmadi.");
      }
      const updated = data.result ?? { plan: notice.plan, planExpiry: null };
      setUsers((prev) =>
        prev.map((u) =>
          u.uid === target.uid
            ? { ...u, plan: updated.plan, planExpiry: updated.planExpiry }
            : u
        )
      );
      setTarget(null);
      setNotice(null);
      router.refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Tarif yangilanmadi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-gray-100 p-4 dark:border-gray-800 sm:flex-row sm:items-center">
        <Input
          placeholder="Ism, email yoki ID bo'yicha qidirish..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          className="sm:max-w-xs"
        />
        <Select
          value={planFilter}
          onChange={(e) => {
            setPlanFilter(e.target.value as PlanFilter);
            setPage(1);
          }}
          className="sm:w-40"
        >
          <option value="all">Barcha tariflar</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="max">Max</option>
        </Select>
        <p className="text-xs text-gray-500 dark:text-gray-400 sm:ml-auto">
          {formatNumber(filtered.length)} ta foydalanuvchi
        </p>
      </div>

      {actionError && (
        <div className="border-b border-gray-100 p-4 dark:border-gray-800">
          <ErrorBanner message={actionError} />
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          title="Foydalanuvchilar topilmadi"
          description="Qidiruv yoki filtrlarni o'zgartirib ko'ring."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
            <thead>
              <tr>
                <Th>Foydalanuvchi</Th>
                <Th>Tarif</Th>
                <Th>Holat</Th>
                <Th>Obuna tugashi</Th>
                <Th>Ro'yxatdan o'tgan</Th>
                <Th className="text-right">Boshqarish</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {rows.map((user) => {
                const s = statusTone(user);
                return (
                  <tr key={user.uid} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <Td>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {formatName(user)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{user.email || "—"}</p>
                    </Td>
                    <Td>
                      <PlanBadge plan={user.plan} />
                    </Td>
                    <Td>
                      <Badge tone={s.tone}>{s.label}</Badge>
                    </Td>
                    <Td className="text-gray-600 dark:text-gray-300">
                      {user.plan === "free" || !user.planExpiry
                        ? "—"
                        : formatDate(user.planExpiry, true)}
                    </Td>
                    <Td className="text-gray-600 dark:text-gray-300">
                      {formatDate(user.createdAt)}
                    </Td>
                    <Td className="text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setActionError("");
                          setTarget(user);
                        }}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                      >
                        Tarifni o'zgartirish
                      </button>
                    </Td>
                  </tr>
                );
              })}
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

      {/* Modal: choose plan + period */}
      {target && (
        <SetPlanModal
          user={target}
          busy={busy}
          onClose={() => setTarget(null)}
          onConfirm={(plan, billingPeriod) => {
            setNotice({ user: target, plan, billingPeriod });
            setTarget(null);
          }}
        />
      )}

      {/* Confirmation */}
      <ConfirmDialog
        open={notice !== null}
        title="Tarifni o'zgartirish"
        description={
          notice
            ? `${formatName(notice.user)} uchun tarif ${notice.plan.toUpperCase()} (${notice.billingPeriod === "yearly" ? "yillik" : "oylik"}) qilib o'rnatiladi. Amal qilish muddati bugundan boshlab hisoblanadi.`
            : ""
        }
        confirmLabel="O'rnatish"
        busy={busy}
        onConfirm={runSetPlan}
        onCancel={() => setNotice(null)}
      />
    </div>
  );
}

function SetPlanModal({
  user,
  busy,
  onClose,
  onConfirm,
}: {
  user: AdminUser;
  busy: boolean;
  onClose: () => void;
  onConfirm: (plan: PlanId, billingPeriod: BillingPeriod) => void;
}) {
  const [plan, setPlan] = useState<PlanId>(user.plan === "free" ? "pro" : user.plan);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("monthly");

  const price = plan === "free" ? "0 UZS" : `${PLAN_AMOUNTS[plan][billingPeriod]} UZS`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Tarifni o'zgartirish</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{formatName(user)}</p>

        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Tarif
            </label>
            <Select value={plan} onChange={(e) => setPlan(e.target.value as PlanId)} className="w-full">
              <option value="free">Free (0 UZS)</option>
              <option value="pro">Pro</option>
              <option value="max">Max</option>
            </Select>
          </div>

          {plan !== "free" && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                To'lov davri
              </label>
              <Select
                value={billingPeriod}
                onChange={(e) => setBillingPeriod(e.target.value as BillingPeriod)}
                className="w-full"
              >
                <option value="monthly">Oylik</option>
                <option value="yearly">Yillik</option>
              </Select>
            </div>
          )}

          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm dark:border-blue-900 dark:bg-blue-950">
            <span className="text-blue-700 dark:text-blue-300">Summa: </span>
            <span className="font-semibold text-blue-900 dark:text-blue-200">{price}</span>
          </div>

          <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
            Diqqat: bu amal foydalanuvchining obunasini darhol yangilaydi (plan + amal qilish
            muddati). Free tanlanganda joriy muddat o'chiriladi.
          </p>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Bekor qilish
          </button>
          <button
            type="button"
            onClick={() => onConfirm(plan, billingPeriod)}
            disabled={busy}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            Davom etish
          </button>
        </div>
      </div>
    </div>
  );
}