"use client";

import { useTranslation } from "@/lib/useTranslation";

const PLAN_STYLES = {
  free: "bg-gray-50 text-gray-500 border-gray-200",
  pro: "bg-emerald-100 text-emerald-700 border-emerald-300",
  max: "bg-blue-100 text-blue-700 border-blue-300",
};

export default function PlanBadge({ plan = "free", showText = true }) {
  const { t } = useTranslation();
  const normalized = PLAN_STYLES[plan] ? plan : "free";
  const className = PLAN_STYLES[normalized];

  if (!showText) {
    return (
      <span className={`inline-flex items-center justify-center rounded-full border px-1.5 py-0.5 ${className}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${className}`}
    >
      {t(`plan.${normalized}`)}
    </span>
  );
}
