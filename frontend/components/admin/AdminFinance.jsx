"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authorizedFetch, useIsAdmin } from "@/lib/apiClient";
import LoadingState from "../LoadingState";
import FinanceCharts from "./FinanceCharts";
import FinanceTable from "./FinanceTable";
import { formatUZS, STATUS_STYLES, tashkentToday } from "./financeFormat";

const EMPTY_FILTERS = { from: "", to: "", status: "", plan: "", provider: "", includeTest: false };

function StatCard({ label, value, tone = "gray", hint }) {
  const tones = {
    gray: "border-gray-200 bg-white text-gray-900",
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-red-200 bg-red-50 text-red-800",
    purple: "border-purple-200 bg-purple-50 text-purple-800",
  };
  return (
    <div className={`min-w-0 rounded-xl border p-4 shadow-xs ${tones[tone]}`}>
      <p className="text-xs font-medium opacity-80">{label}</p>
      <p className="mt-1 break-words text-xl font-bold tabular-nums sm:text-2xl">{value}</p>
      {hint && <p className="mt-0.5 text-xs opacity-70">{hint}</p>}
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="block text-xs font-medium text-gray-600">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-blue-500"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function AdminFinance() {
  const { isAdmin, checking } = useIsAdmin();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [refundTarget, setRefundTarget] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    if (!isAdmin) return undefined;
    let cancelled = false;
    const params = new URLSearchParams({ page: String(page) });
    for (const key of ["from", "to", "status", "plan", "provider"]) if (filters[key]) params.set(key, filters[key]);
    if (filters.includeTest) params.set("includeTest", "1");

    authorizedFetch(`/api/admin/finance?${params}`)
      .then((data) => {
        if (cancelled) return;
        setReport(data);
        setError("");
      })
      .catch((err) => !cancelled && setError(err.message || "Ma'lumotlarni yuklab bo'lmadi."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [isAdmin, filters, page, reloadKey]);

  const update = (key, value) => {
    setLoading(true);
    setPage(1);
    setFilters((f) => ({ ...f, [key]: value }));
  };

  const confirmRefund = async () => {
    const row = refundTarget;
    setRefundTarget(null);
    setBusyId(row.id);
    try {
      await authorizedFetch("/api/admin/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refund", source: row.source, id: row.id }),
      });
      setLoading(true);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err.message || "Belgilab bo'lmadi.");
    } finally {
      setBusyId(null);
    }
  };

  if (checking) return <LoadingState />;
  if (!isAdmin) {
    return (
      <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-sm font-medium text-red-700">
        Bu bo&apos;lim faqat administratorlar uchun.
      </div>
    );
  }

  const c = report?.cards;
  const today = tashkentToday();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Moliyaviy hisobot</h1>
          <p className="mt-1 text-sm text-gray-600">
            Faqat tasdiqlangan to&apos;lovlar tushum hisoblanadi · vaqt: Toshkent (UTC+5)
          </p>
        </div>
        <Link href="/dashboard/admin/payments" className="text-sm font-medium text-blue-600 hover:text-blue-800">
          Karta o&apos;tkazmasi so&apos;rovlari →
        </Link>
      </div>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="font-medium">{error}</span>
          <button type="button" onClick={() => { setLoading(true); setReloadKey((k) => k + 1); }} className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700">
            Qayta urinish
          </button>
        </div>
      )}

      {report?.providers && !report.providers.inpay.configured && (
        <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">inPAY ulanmagan</p>
          <p className="mt-0.5">
            Server sozlamalarida yetishmayapti: {report.providers.inpay.missing.join(", ")}. Onlayn to&apos;lovlar qabul qilinmaydi;
            quyidagi raqamlar faqat bazada saqlangan haqiqiy yozuvlardan olingan.
          </p>
        </div>
      )}
      {report?.providers?.inpay.configured && report.providers.inpay.mode === "test" && (
        <div role="status" className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          inPAY <strong>sinov (sandbox)</strong> rejimida ulangan: sinov to&apos;lovlari haqiqiy tushumga qo&apos;shilmaydi.
        </div>
      )}

      {!report && loading ? (
        <LoadingState label="Hisobot tayyorlanmoqda..." />
      ) : report ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
            <StatCard label="Jami tushum" value={formatUZS(c.totalRevenue)} tone="green" />
            <StatCard label="Bugungi tushum" value={formatUZS(c.revenueToday)} tone="green" />
            <StatCard label="Shu oydagi tushum" value={formatUZS(c.revenueMonth)} tone="green" />
            <StatCard label="Muvaffaqiyatli to'lovlar" value={c.successCount} tone="blue" />
            <StatCard label="Kutilayotgan to'lovlar" value={c.pendingCount} tone="amber" />
            <StatCard label="Muvaffaqiyatsiz / bekor" value={c.failedCount} tone="red" hint="bekor, muddati o'tgan, rad etilgan" />
            <StatCard label="Faol Pro obunalar" value={c.activePro} tone="blue" />
            <StatCard label="Faol Max obunalar" value={c.activeMax} tone="purple" />
            <StatCard label="Muddati tugagan obunalar" value={c.expiredSubscriptions} />
          </div>

          <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs sm:p-5" aria-label="Filtrlar">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <label className="block text-xs font-medium text-gray-600">
                Dan
                <input type="date" value={filters.from || report.range.from} max={filters.to || today} onChange={(e) => update("from", e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900" />
              </label>
              <label className="block text-xs font-medium text-gray-600">
                Gacha
                <input type="date" value={filters.to || report.range.to} min={filters.from || undefined} max={today} onChange={(e) => update("to", e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900" />
              </label>
              <Select label="Holat" value={filters.status} onChange={(v) => update("status", v)} options={[["", "Hammasi"], ...Object.entries(STATUS_STYLES).map(([k, s]) => [k, s.label])]} />
              <Select label="Tarif" value={filters.plan} onChange={(v) => update("plan", v)} options={[["", "Hammasi"], ["pro", "Pro"], ["max", "Max"]]} />
              <Select label="To'lov tizimi" value={filters.provider} onChange={(v) => update("provider", v)} options={[["", "Hammasi"], ["inpay", "inPAY"], ["manual", "Karta o'tkazmasi"]]} />
              <div className="flex flex-col justify-end gap-2">
                <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
                  <input type="checkbox" checked={filters.includeTest} onChange={(e) => update("includeTest", e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
                  Sinov to&apos;lovlari
                </label>
                <button type="button" onClick={() => { setLoading(true); setPage(1); setFilters(EMPTY_FILTERS); }} className="text-left text-xs font-medium text-blue-600 hover:text-blue-800">
                  Filtrlarni tozalash
                </button>
              </div>
            </div>
            {filters.includeTest && (
              <p className="mt-3 text-xs text-sky-800">Sinov (sandbox) to&apos;lovlari ko&apos;rsatilmoqda — ular haqiqiy tushum emas.</p>
            )}
          </section>

          <div className={loading ? "pointer-events-none opacity-60 transition-opacity" : "transition-opacity"} aria-busy={loading}>
            <div className="space-y-6">
              <FinanceCharts charts={report.charts} range={report.range} />
              <FinanceTable table={report.table} busyId={busyId} onRefund={setRefundTarget} onPage={(p) => { setLoading(true); setPage(p); }} />
            </div>
          </div>
        </>
      ) : null}

      {refundTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => setRefundTarget(null)}>
          <div role="dialog" aria-modal="true" aria-label="Qaytarishni tasdiqlash" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900">To&apos;lov qaytarildimi?</h2>
            <p className="mt-2 text-sm text-gray-600">
              {formatUZS(refundTarget.amount)} — {refundTarget.customerName || refundTarget.customerEmail || refundTarget.uid}. inPAY qaytarishni API orqali bajarmaydi: pulni inPAY kabineti yoki qo&apos;llab-quvvatlash orqali qaytargandan keyingina belgilang. To&apos;lov tushumdan chiqariladi; foydalanuvchi tarifi avtomatik o&apos;zgarmaydi.
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setRefundTarget(null)} className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100">
                Bekor qilish
              </button>
              <button type="button" onClick={confirmRefund} className="rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-700">
                Qaytarilgan deb belgilash
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
