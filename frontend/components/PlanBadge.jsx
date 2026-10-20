"use client";

import { useTranslation } from "@/lib/useTranslation";

const PLAN_STYLES = {
  free: "bg-gray-100 text-gray-700 border-gray-300",
  pro: "bg-blue-100 text-blue-700 border-blue-300",
  max: "bg-purple-100 text-purple-700 border-purple-300",
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
