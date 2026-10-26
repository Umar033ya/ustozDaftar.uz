"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";

export default function DashboardError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard] render failed", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm dark:border-red-900 dark:bg-gray-900">
      <p className="text-base font-semibold text-gray-900 dark:text-gray-100">Sahifani yuklab bo&apos;lmadi</p>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        Serverda vaqtinchalik xatolik yuz berdi. Qayta urinib ko&apos;ring.
        {error.digest && <span className="mt-1 block text-xs text-gray-400">Kod: {error.digest}</span>}
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        Qayta urinish
      </button>
    </div>
  );
}
