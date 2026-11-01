"use client";

import Link from "next/link";

/** Phone-sized list of assessments (the table is used from md and up). */
export default function AssessmentCards({ assessments, label, basePath, onDelete }) {
  if (assessments.length === 0) {
    return (
      <div className="md:hidden rounded-xl border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500">
        Hech narsa topilmadi
      </div>
    );
  }

  return (
    <ul className="md:hidden space-y-3">
      {assessments.map((a) => {
        const pct = Number(a.avgPercentage) || 0;
        return (
          <li key={a.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs">
            <Link href={`${basePath}/${a.id}`} className="block">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-semibold text-gray-900">
                    {label} {a.number}
                    <span className="ml-2 inline-flex rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 align-middle">
                      {a.className}
                    </span>
                  </p>
                  <p className="mt-0.5 truncate text-sm text-gray-600">{a.subject}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-gray-900 tabular-nums">{a.avgPercentage}%</p>
                  <p className="text-xs text-gray-500">O&apos;rtacha</p>
                </div>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500"
                  style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                />
              </div>
            </Link>
            <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
              <span>
                {a.date} · {a.studentCount} o&apos;quvchi
              </span>
              <div className="flex items-center gap-1">
                <Link
                  href={`${basePath}/${a.id}`}
                  className="rounded-lg px-3 py-1.5 text-sm font-semibold text-blue-600 hover:bg-blue-50"
                >
                  Ochish
                </Link>
                <button
                  onClick={(e) => onDelete(a.id, e)}
                  className="rounded-lg px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50"
                >
                  O&apos;chirish
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
