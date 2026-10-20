"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/useTranslation";

const PLAN_META = {
  free: {
    nameKey: "planModal.free.title",
    featuresKey: "pricing.free.features",
    color: "gray",
    purchasable: false,
  },
  pro: {
    nameKey: "planModal.pro.title",
    featuresKey: "pricing.pro.features",
    monthlyKey: "planModal.pro.price.monthly",
    yearlyKey: "planModal.pro.price.yearly",
    color: "blue",
    purchasable: true,
  },
  max: {
    nameKey: "planModal.max.title",
    featuresKey: "pricing.max.features",
    monthlyKey: "planModal.max.price.monthly",
    yearlyKey: "planModal.max.price.yearly",
    color: "purple",
    purchasable: true,
  },
};

const COLOR_STYLES = {
  gray: { box: "bg-gray-50 border-gray-200", title: "text-gray-900", price: "text-gray-700", tick: "text-gray-500", button: "" },
  blue: { box: "bg-blue-50 border-blue-200", title: "text-blue-900", price: "text-blue-700", tick: "text-blue-600", button: "bg-blue-600 hover:bg-blue-700" },
  purple: { box: "bg-purple-50 border-purple-200", title: "text-purple-900", price: "text-purple-700", tick: "text-purple-600", button: "bg-purple-600 hover:bg-purple-700" },
};

export default function PlanInfoModal({ open, onClose, onPurchase }) {
  const { t } = useTranslation();
  const [period, setPeriod] = useState("monthly");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white p-5">
          <h2 className="text-lg font-bold text-gray-900">{t("planModal.title")}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label={t("planModal.close")}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 p-5">
          {/* Billing period toggle (applies to Pro / Max) */}
          <div className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2">
            <span className="text-xs font-medium text-gray-600">{t("planModal.billingPeriod")}</span>
            <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
              {[
                { id: "monthly", label: t("subscription.monthlyBilling") },
                { id: "yearly", label: t("subscription.yearlyBilling") },
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setPeriod(option.id)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    period === option.id ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {Object.entries(PLAN_META).map(([id, meta]) => {
            const colors = COLOR_STYLES[meta.color];
            const features = t(meta.featuresKey) || [];
            const price = meta.purchasable
              ? t(period === "monthly" ? meta.monthlyKey : meta.yearlyKey)
              : t("planModal.free.price");

            return (
              <div key={id} className={`rounded-xl border p-4 ${colors.box}`}>
                <div className="mb-3 flex items-baseline justify-between gap-2">
                  <h3 className={`text-base font-bold ${colors.title}`}>{t(meta.nameKey)}</h3>
                  <p className={`text-lg font-bold ${colors.price}`}>{price}</p>
                </div>

                <ul className="space-y-1.5">
                  {(Array.isArray(features) ? features : []).map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <svg className={`mt-0.5 h-4 w-4 flex-shrink-0 ${colors.tick}`} fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l4-4a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="text-sm text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                {meta.purchasable && (
                  <button
                    type="button"
                    onClick={() => onPurchase?.(id, period)}
                    className={`mt-4 w-full rounded-lg py-2.5 text-sm font-medium text-white transition-colors ${colors.button}`}
                  >
                    {t("subscription.purchase")} {t(meta.nameKey)}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-end border-t border-gray-200 p-5">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
          >
            {t("planModal.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
