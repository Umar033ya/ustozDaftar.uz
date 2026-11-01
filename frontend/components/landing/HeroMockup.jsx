"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/useTranslation";

const TASK_MAX = [5, 5, 10, 10];
const MAX_TOTAL = TASK_MAX.reduce((a, b) => a + b, 0);

// Demo rows. `null` scores are never typed, so that student stays red —
// exactly how the real result table flags a missing score.
const STUDENTS = [
  { name: "Aliyev Sardor", scores: [5, 4, 9, 8] },
  { name: "Karimova Madina", scores: [5, 5, 10, 9] },
  { name: "Rasulov Jasur", scores: [3, 4, 7, 6] },
  { name: "Toshmatova Nilufar", scores: [null, null, null, null] },
  { name: "Yusupov Bobur", scores: [4, 5, 8, 10] },
];

const CELLS = STUDENTS.flatMap((s, row) =>
  s.scores.map((score, col) => ({ row, col, score })).filter((c) => c.score !== null)
);

const STEP_MS = 260;
const HOLD_MS = 3200;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

/** Animated preview of a BSB result table: scores get typed in, totals update, rows turn green. */
export default function HeroMockup() {
  const { t } = useTranslation();
  const reducedMotion = usePrefersReducedMotion();
  const [filled, setFilled] = useState(0);

  useEffect(() => {
    if (reducedMotion) return;
    const done = filled >= CELLS.length;
    const timer = setTimeout(() => setFilled(done ? 0 : filled + 1), done ? HOLD_MS : filled === 0 ? 900 : STEP_MS);
    return () => clearTimeout(timer);
  }, [filled, reducedMotion]);

  const shown = reducedMotion ? CELLS.length : filled;
  const visibleCells = new Set(CELLS.slice(0, shown).map((c) => `${c.row}-${c.col}`));
  const lastCell = shown > 0 && !reducedMotion ? CELLS[shown - 1] : null;

  const rows = STUDENTS.map((s, row) => {
    const scores = s.scores.map((score, col) => (visibleCells.has(`${row}-${col}`) ? score : null));
    const entered = scores.some((v) => v !== null);
    const total = scores.reduce((sum, v) => sum + (v ?? 0), 0);
    return { name: s.name, scores, entered, total, percent: Math.round((total / MAX_TOTAL) * 100) };
  });
  const enteredCount = rows.filter((r) => r.entered).length;

  return (
    <div className="relative w-full max-w-lg mx-auto">
      {/* Floating badges */}
      <div className="hidden sm:flex absolute -top-5 -left-6 z-10 items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-lg ring-1 ring-gray-100 animate-float">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </span>
        <span className="text-xs font-semibold text-gray-700">{t("landing.mock.saved")}</span>
      </div>
      <div
        className="hidden sm:flex absolute -bottom-5 -right-4 z-10 items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-lg ring-1 ring-gray-100 animate-float"
        style={{ animationDelay: "-3.5s" }}
      >
        <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
        <span className="text-xs font-semibold text-gray-700">
          {STUDENTS.length - enteredCount} — {t("landing.mock.missing")}
        </span>
      </div>

      <div className="rounded-2xl bg-white shadow-2xl shadow-blue-900/10 ring-1 ring-gray-200 overflow-hidden">
        {/* Window bar */}
        <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          <span className="ml-2 truncate text-[11px] sm:text-xs font-medium text-gray-500">{t("landing.mock.title")}</span>
        </div>

        <div className="p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-300"
                style={{ width: `${(enteredCount / STUDENTS.length) * 100}%` }}
              />
            </div>
            <span className="text-[11px] font-semibold text-gray-500 tabular-nums whitespace-nowrap">
              {enteredCount}/{STUDENTS.length} {t("landing.mock.entered")}
            </span>
          </div>

          <table className="w-full table-fixed border-collapse text-[11px] sm:text-xs">
            <thead>
              <tr className="text-gray-500">
                <th className="w-[38%] pb-1.5 text-left font-semibold">{t("landing.mock.name")}</th>
                {TASK_MAX.map((max, i) => (
                  <th key={i} className="pb-1.5 text-center font-semibold">
                    {i + 1}
                    <span className="block text-[9px] font-normal text-gray-400">/{max}</span>
                  </th>
                ))}
                <th className="pb-1.5 text-center font-semibold">{t("landing.mock.total")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, row) => (
                <tr
                  key={r.name}
                  className={`transition-colors duration-500 ${
                    r.entered ? "bg-emerald-50" : shown === CELLS.length ? "bg-red-50" : ""
                  }`}
                >
                  <td className="truncate border-t border-gray-100 py-1.5 pl-1.5 pr-1 font-medium text-gray-800">{r.name}</td>
                  {r.scores.map((v, col) => {
                    const active = lastCell && lastCell.row === row && lastCell.col === col;
                    return (
                      <td key={col} className="border-t border-gray-100 py-1 text-center">
                        <span
                          className={`mx-auto flex h-6 w-6 sm:w-7 items-center justify-center rounded-md border tabular-nums font-semibold transition-colors ${
                            active
                              ? "border-blue-500 ring-2 ring-blue-200 text-blue-700 bg-white"
                              : v !== null
                                ? "border-transparent text-gray-900"
                                : "border-dashed border-gray-200 text-gray-300"
                          }`}
                        >
                          {v !== null ? <span key={`${row}-${col}-${v}`} className="animate-pop">{v}</span> : "–"}
                        </span>
                      </td>
                    );
                  })}
                  <td className="border-t border-gray-100 py-1 text-center">
                    <span className={`font-bold tabular-nums ${r.entered ? "text-gray-900" : "text-gray-300"}`}>
                      {r.entered ? r.total : "—"}
                    </span>
                    {r.entered && <span className="block text-[9px] text-gray-500 tabular-nums">{r.percent}%</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
