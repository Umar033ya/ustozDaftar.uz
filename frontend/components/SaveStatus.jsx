"use client";

/**
 * Autosave indicator for the score tables. A failed save stays on screen with
 * a retry button; before this, failures were only written to the console and
 * the teacher could leave believing the scores were saved.
 */
export default function SaveStatus({ saving, saveError, onRetry }) {
  if (saveError) {
    return (
      <div
        role="alert"
        className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-sm z-50 print:hidden rounded-lg border border-red-200 bg-red-50 px-4 py-3 shadow-lg"
      >
        <p className="text-sm font-semibold text-red-800">Ballar saqlanmadi</p>
        <p className="mt-0.5 text-xs text-red-700">
          Internet aloqasini tekshiring. Kiritilgan ballar shu sahifada saqlanib turibdi — sahifani yopmang.
        </p>
        <button
          type="button"
          onClick={onRetry}
          disabled={saving}
          className="mt-2 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {saving ? "Saqlanmoqda..." : "Qayta saqlash"}
        </button>
      </div>
    );
  }

  if (!saving) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg text-xs font-semibold z-50 print:hidden"
    >
      Saqlanmoqda...
    </div>
  );
}
