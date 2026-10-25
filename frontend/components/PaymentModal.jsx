"use client";

import { useCallback, useState } from "react";
import { useTranslation } from "@/lib/useTranslation";
import { formatSom, planOffer } from "@/lib/plans";

const CARD_NUMBER = "9860011202074545";
const CARDHOLDER = "Yakubov Abdulla";


export default function PaymentModal({ open, onClose, plan, billingPeriod, onContinue }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(CARD_NUMBER);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError(true);
      setTimeout(() => setCopyError(false), 3000);
    }
  }, []);

  if (!open || !plan || !billingPeriod) return null;

  const offer = planOffer(plan, billingPeriod);
  const amount = offer ? formatSom(offer.amount) : "";
  const planName = plan === "max" ? t("subscription.max") : t("subscription.pro");
  const periodName =
    billingPeriod === "yearly" ? t("subscription.yearlyBilling") : t("subscription.monthlyBilling");
  const periodSuffix = billingPeriod === "yearly" ? t("subscription.perYear") : t("subscription.perMonth");

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-black/50 px-4 py-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("sub.manual.title")}
        className="my-auto w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 p-5">
          <h2 className="text-lg font-bold text-gray-900">{t("sub.manual.title")}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label={t("paymentModal.close")}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-5 p-5">
          {/* Manual transfer only; online (inPAY) payment lives on /dashboard/subscription. */}
          <p className="text-sm text-gray-600">{t("sub.manual.desc")}</p>

          {/* Plan summary */}
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div>
              <p className="text-xs font-medium text-blue-700">{t("paymentModal.plan")}</p>
              <p className="mt-0.5 text-sm font-semibold text-blue-900">
                {planName} · {periodName}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-blue-700">{t("paymentModal.amount")}</p>
              <p className="mt-0.5 text-sm font-semibold text-blue-900">
                {amount} UZS{periodSuffix}
              </p>
            </div>
          </div>

          {/* Card details */}
          <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">
                {t("paymentModal.cardNumber")}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={CARD_NUMBER}
                  readOnly
                  className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm tracking-wider text-gray-900 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700"
                >
                  {copied ? (
                    <>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {t("paymentModal.copied")}
                    </>
                  ) : copyError ? (
                    <>{t("paymentModal.copyError")}</>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                      {t("paymentModal.copyCard")}
                    </>
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">
                {t("paymentModal.cardholder")}
              </label>
              <input
                type="text"
                value={CARDHOLDER}
                readOnly
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs leading-relaxed text-amber-800">{t("paymentModal.instructionText")}</p>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-gray-200 p-5 sm:flex-row sm:justify-end">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
          >
            {t("paymentModal.close")}
          </button>
          {onContinue && (
            <button
              onClick={onContinue}
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              {t("paymentModal.submitReference")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
