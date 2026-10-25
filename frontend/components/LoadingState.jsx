"use client";

/** Accessible loading indicator shared by the dashboard pages. */
export default function LoadingState({ label = "Yuklanmoqda...", className = "py-16" }) {
  return (
    <div role="status" aria-live="polite" className={`flex flex-col items-center justify-center gap-3 text-gray-500 ${className}`}>
      <svg className="h-7 w-7 animate-spin text-blue-600" viewBox="0 0 24 24" aria-hidden="true">
        <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
        <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}
