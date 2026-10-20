"use client";

import { useCallback, useState } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Tasdiqlash",
  cancelLabel = "Bekor qilish",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [hasConfirmed, setHasConfirmed] = useState(false);

  const handleConfirm = useCallback(() => {
    if (danger && !hasConfirmed) {
      setHasConfirmed(true);
      return;
    }
    onConfirm();
  }, [danger, hasConfirmed, onConfirm]);

  const reset = useCallback(() => {
    setHasConfirmed(false);
    onCancel();
  }, [onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6"
      onClick={reset}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{description}</p>

        {danger && hasConfirmed && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            Bu amalni tasdiqlash uchun yana bir marta bosing.
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={reset}
            disabled={busy}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              danger
                ? "bg-red-600 hover:bg-red-700"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {busy
              ? "Jarayonda..."
              : danger && !hasConfirmed
                ? "Amalni tasdiqlash"
                : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}