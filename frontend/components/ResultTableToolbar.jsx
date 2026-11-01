"use client";

/** True when the student's name contains the search text (case-insensitive). */
export function matchesStudent(result, search) {
  const query = String(search ?? "").toLowerCase().trim();
  if (!query) return true;
  return String(result?.studentName ?? "").toLowerCase().includes(query);
}

/**
 * Row colours for the "show entered" mode: green when a score is entered,
 * red when it is still missing. Print always stays plain.
 */
export function rowHighlightClass(entered, enabled) {
  if (!enabled) return "";
  return entered ? "bg-green-100 print:bg-white" : "bg-red-100 print:bg-white";
}

export default function ResultTableToolbar({ search, onSearchChange, highlight, onHighlightChange, enteredCount, totalCount }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3 print:hidden">
      <div className="relative flex-1">
        <svg
          className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
        </svg>
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="O'quvchi ismi bo'yicha qidirish..."
          aria-label="O'quvchini qidirish"
          className="w-full h-11 sm:h-10 pl-10 pr-3 text-base sm:text-sm border border-gray-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <button
          type="button"
          role="switch"
          aria-checked={highlight}
          onClick={() => onHighlightChange(!highlight)}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
            highlight ? "bg-emerald-600" : "bg-gray-300"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
              highlight ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
        <span className="text-sm text-gray-700 font-medium">
          Ball qo&apos;yilganlarni ko&apos;rsatish
          <span className="ml-1 text-xs text-gray-500">
            ({enteredCount}/{totalCount})
          </span>
        </span>
      </label>
    </div>
  );
}
