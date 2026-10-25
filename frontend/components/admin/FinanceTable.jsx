"use client";

import { formatDateTime, formatUZS, PERIOD_LABELS, PLAN_LABELS, PROVIDER_LABELS, STATUS_STYLES } from "./financeFormat";

function StatusBadge({ status, livemode }) {
  const style = STATUS_STYLES[status] || { label: status, className: "bg-gray-100 text-gray-700" };
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${style.className}`}>{style.label}</span>
      {!livemode && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800">sinov</span>}
    </span>
  );
}

function Customer({ row }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-medium text-gray-900">{row.customerName || "—"}</p>
      <p className="truncate text-xs text-gray-500">{row.customerEmail || row.uid}</p>
    </div>
  );
}

function RefundButton({ row, busyId, onRefund }) {
  if (row.status !== "success" || !row.livemode) return null;
  return (
    <button
      type="button"
      onClick={() => onRefund(row)}
      disabled={busyId === row.id}
      className="whitespace-nowrap rounded-md border border-purple-200 px-2 py-1 text-xs font-medium text-purple-700 hover:bg-purple-50 disabled:opacity-50"
    >
      {busyId === row.id ? "..." : "Qaytarildi"}
    </button>
  );
}

export default function FinanceTable({ table, busyId, onRefund, onPage }) {
  if (table.total === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center shadow-xs">
        <p className="text-sm font-medium text-gray-700">Tanlangan filtrlar bo&apos;yicha to&apos;lov topilmadi</p>
        <p className="mt-1 text-xs text-gray-500">Sana oralig&apos;ini kengaytiring yoki filtrlarni tozalang.</p>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xs">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 sm:px-5">
        <h3 className="text-base font-bold text-gray-900">Tranzaksiyalar</h3>
        <span className="text-xs text-gray-500">Jami: {table.total}</span>
      </div>

      {/* Phones: cards */}
      <ul className="divide-y divide-gray-200 md:hidden">
        {table.rows.map((row) => (
          <li key={`${row.source}-${row.id}`} className="space-y-2 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <Customer row={row} />
              <p className="whitespace-nowrap text-sm font-bold tabular-nums text-gray-900">{formatUZS(row.amount)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
              <StatusBadge status={row.status} livemode={row.livemode} />
              <span>
                {PLAN_LABELS[row.plan] || row.plan} · {PERIOD_LABELS[row.billingPeriod] || row.billingPeriod}
              </span>
              <span>· {PROVIDER_LABELS[row.provider]}</span>
            </div>
            <div className="flex items-end justify-between gap-3 text-xs text-gray-500">
              <div>
                <p>Yaratilgan: {formatDateTime(row.createdAt)}</p>
                {row.paidAt && <p>To&apos;langan: {formatDateTime(row.paidAt)}</p>}
                <p className="break-all font-mono">{row.providerPaymentId || row.id}</p>
              </div>
              <RefundButton row={row} busyId={busyId} onRefund={onRefund} />
            </div>
          </li>
        ))}
      </ul>

      {/* Tablets and desktops: table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
            <tr>
              <th className="px-4 py-3 font-semibold">Tranzaksiya</th>
              <th className="px-4 py-3 font-semibold">Mijoz</th>
              <th className="px-4 py-3 font-semibold">Tarif</th>
              <th className="px-4 py-3 text-right font-semibold">Summa</th>
              <th className="px-4 py-3 font-semibold">Holat</th>
              <th className="px-4 py-3 font-semibold">Yaratilgan</th>
              <th className="px-4 py-3 font-semibold">To&apos;langan</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {table.rows.map((row) => (
              <tr key={`${row.source}-${row.id}`} className="hover:bg-gray-50">
                <td className="max-w-[11rem] px-4 py-3">
                  <p className="truncate font-mono text-xs text-gray-900" title={row.providerPaymentId || row.id}>
                    {row.providerPaymentId || row.id}
                  </p>
                  <p className="text-xs text-gray-500">{PROVIDER_LABELS[row.provider]}</p>
                </td>
                <td className="max-w-[14rem] px-4 py-3">
                  <Customer row={row} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-900">
                  {PLAN_LABELS[row.plan] || row.plan}
                  <span className="text-gray-500"> · {PERIOD_LABELS[row.billingPeriod] || row.billingPeriod}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-gray-900">{formatUZS(row.amount)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={row.status} livemode={row.livemode} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-600">{formatDateTime(row.createdAt)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-600">{formatDateTime(row.paidAt)}</td>
                <td className="px-4 py-3 text-right">
                  <RefundButton row={row} busyId={busyId} onRefund={onRefund} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {table.pageCount > 1 && (
        <nav className="flex items-center justify-between border-t border-gray-200 px-4 py-3 text-sm" aria-label="Sahifalar">
          <button
            type="button"
            onClick={() => onPage(table.page - 1)}
            disabled={table.page <= 1}
            className="rounded-md border border-gray-300 px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            ← Oldingi
          </button>
          <span className="text-gray-600">
            {table.page} / {table.pageCount}
          </span>
          <button
            type="button"
            onClick={() => onPage(table.page + 1)}
            disabled={table.page >= table.pageCount}
            className="rounded-md border border-gray-300 px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            Keyingi →
          </button>
        </nav>
      )}
    </section>
  );
}
