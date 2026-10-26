"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge, EmptyState, PlanBadge, Select, Spinner, TableShell, Td, Th, Input } from "@/components/ui";
import { formatDate, formatName, formatNumber, initialsOf } from "@/lib/format";
import { subscriptionStatus } from "@/lib/plan";
import type { AdminUser, PaymentRequest, PlanId } from "@/lib/types";

const PAGE_SIZE = 15;

interface UserDetail extends AdminUser {
  payments: PaymentRequest[];
}

export function UsersTable({ initialUsers }: { initialUsers: AdminUser[] }) {
  const [users] = useState<AdminUser[]>(initialUsers);
  const [query, setQuery] = useState("");
  const [planFilter, setPlanFilter] = useState<"all" | PlanId>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "expired" | "free">("all");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users
      .filter((u) => {
        if (planFilter !== "all" && u.plan !== planFilter) return false;
        const status = subscriptionStatus(u.plan, u.planExpiry);
        if (statusFilter === "active" && status !== "active") return false;
        if (statusFilter === "expired" && status !== "expired") return false;
        if (statusFilter === "free" && status !== "none") return false;
        if (!q) return true;
        return (
          formatName(u).toLowerCase().includes(q) ||
          (u.email ?? "").toLowerCase().includes(q) ||
          u.uid.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  }, [users, query, planFilter, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const openDetail = async (user: AdminUser) => {
    setDetailLoading(true);
    setDetailError("");
    setDetail({ ...user, payments: [] });
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(user.uid)}`);
      if (!res.ok) throw new Error("Yuklashda xatolik");
      const data = (await res.json()) as { user: AdminUser; payments: PaymentRequest[] };
      setDetail({ ...user, ...data.user, payments: data.payments });
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : "Xatolik yuz berdi");
    } finally {
      setDetailLoading(false);
    }
  };

  const statusTone = (u: AdminUser) => {
    const status = subscriptionStatus(u.plan, u.planExpiry);
    if (status === "active") return { tone: "green" as const, label: "Faol" };
    if (status === "expired") return { tone: "red" as const, label: "Muddati tugagan" };
    return { tone: "gray" as const, label: "Bepul" };
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
            setPlanFilter(e.target.value as "all" | PlanId);
            setPage(1);
          }}
          className="sm:w-40"
        >
          <option value="all">Barcha tariflar</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="max">Max</option>
        </Select>
        <Select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as "all" | "active" | "expired" | "free");
            setPage(1);
          }}
          className="sm:w-44"
        >
          <option value="all">Barcha holatlar</option>
          <option value="active">Faol obuna</option>
          <option value="expired">Muddati tugagan</option>
          <option value="free">Bepul</option>
        </Select>
        <p className="text-xs text-gray-500 dark:text-gray-400 sm:ml-auto">
          {formatNumber(filtered.length)} ta foydalanuvchi
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="Foydalanuvchilar topilmadi"
          description="Qidiruv yoki filtrlarni o'zgartirib ko'ring."
        />
      ) : (
        <TableShell>
          <thead>
            <tr>
              <Th>Foydalanuvchi</Th>
              <Th>Email</Th>
              <Th>Tarif</Th>
              <Th>Holat</Th>
              <Th className="text-right">Sinflar</Th>
              <Th className="text-right">O'quvchilar</Th>
              <Th className="text-right">BSB</Th>
              <Th className="text-right">ChSB</Th>
              <Th>Obuna tugashi</Th>
              <Th>Ro'yxatdan o'tgan</Th>
              <Th className="text-right">Amal</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {rows.map((user) => {
              const s = statusTone(user);
              return (
                <tr key={user.uid} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <Td>
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                        {initialsOf(user)}
                      </span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {formatName(user)}
                      </span>
                    </div>
                  </Td>
                  <Td className="text-gray-600 dark:text-gray-300">{user.email || "—"}</Td>
                  <Td>
                    <PlanBadge plan={user.plan} />
                  </Td>
                  <Td>
                    <Badge tone={s.tone}>{s.label}</Badge>
                  </Td>
                  <Td className="text-right tabular-nums text-gray-700 dark:text-gray-200">{formatNumber(user.classCount)}</Td>
                  <Td className="text-right tabular-nums text-gray-700 dark:text-gray-200">{formatNumber(user.studentCount)}</Td>
                  <Td className="text-right tabular-nums text-gray-700 dark:text-gray-200">{formatNumber(user.bsbCount)}</Td>
                  <Td className="text-right tabular-nums text-gray-700 dark:text-gray-200">{formatNumber(user.chsbCount)}</Td>
                  <Td className="text-gray-600 dark:text-gray-300">
                    {user.plan === "free" || !user.planExpiry
                      ? "—"
                      : formatDate(user.planExpiry)}
                  </Td>
                  <Td className="text-gray-600 dark:text-gray-300">
                    {formatDate(user.createdAt)}
                  </Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openDetail(user)}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                      >
                        Profil
                      </button>
                      <Link
                        href={`/dashboard/users/${encodeURIComponent(user.uid)}`}
                        className="whitespace-nowrap rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
                      >
                        Sinflar va BSB
                      </Link>
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </TableShell>
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
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              ← Oldingi
            </button>
            <button
              type="button"
              disabled={currentPage >= pageCount}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Keyingi →
            </button>
          </div>
        </div>
      )}

      {detail && (
        <UserProfileModal
          detail={detail}
          loading={detailLoading}
          error={detailError}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

function UserProfileModal({
  detail,
  loading,
  error,
  onClose,
}: {
  detail: UserDetail;
  loading: boolean;
  error: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-base font-bold text-white">
              {initialsOf(detail)}
            </span>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {formatName(detail)}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{detail.email || "—"}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Yopish"
          >
            ✕
          </button>
        </div>

        {loading && <Spinner label="Profil yuklanmoqda..." />}
        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <InfoCell label="Ro'yxatdan o'tgan" value={formatDate(detail.createdAt, true)} />
              <InfoCell label="Tarif" value={<PlanBadge plan={detail.plan} />} />
              <InfoCell
                label="Obuna tugashi"
                value={detail.planExpiry ? formatDate(detail.planExpiry, true) : "—"}
              />
              <InfoCell label="Maktab" value={detail.schoolName || "—"} />
              <InfoCell label="Sinflar" value={formatNumber(detail.classCount)} />
              <InfoCell label="O'quvchilar" value={formatNumber(detail.studentCount)} />
              <InfoCell label="BSB / ChSB" value={`${formatNumber(detail.bsbCount)} / ${formatNumber(detail.chsbCount)}`} />
              <InfoCell label="Oxirgi faollik" value={formatDate(detail.lastActivity, true)} />
              <InfoCell label="UID" value={<span className="break-all font-mono text-xs">{detail.uid}</span>} />
            </div>

            <Link
              href={`/dashboard/users/${encodeURIComponent(detail.uid)}`}
              className="mt-4 inline-flex rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
            >
              Sinflar, o&apos;quvchilar va BSB/ChSB natijalari →
            </Link>

            <h3 className="mt-6 text-sm font-semibold text-gray-900 dark:text-gray-100">
              To'lov tarixi
            </h3>
            {detail.payments.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Ushbu foydalanuvchida to&apos;lov so&apos;rovlari yo&apos;q.
              </p>
            ) : (
              <div className="mt-2 space-y-2">
                {detail.payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 px-3 py-2 dark:border-gray-800"
                  >
                    <div className="text-sm text-gray-700 dark:text-gray-200">
                      <PlanBadge plan={p.plan} /> · {p.billingPeriod} ·{" "}
                      <span className="font-medium">{p.amount} UZS</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(p.createdAt, true)}
                      <StatusPill status={p.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 dark:border-gray-800 dark:bg-gray-800/50">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status: PaymentRequest["status"] }) {
  const map = {
    pending: { tone: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300", label: "Kutilmoqda" },
    approved: { tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300", label: "Tasdiqlangan" },
    rejected: { tone: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300", label: "Rad etilgan" },
  } as const;
  const item = map[status];
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${item.tone}`}>{item.label}</span>
  );
}