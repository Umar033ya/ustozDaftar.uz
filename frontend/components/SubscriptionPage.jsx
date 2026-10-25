"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "@/lib/useTranslation";
import { useSubscription } from "@/lib/subscriptionContext";
import { createOnlinePayment, ONLINE_PAYMENT_ENABLED } from "@/lib/onlinePayment";
import { BILLING_PERIODS, DAY_MS, formatSom, PAID_PLANS, yearlySavingPercent } from "@/lib/plans";
import { useSubscriptionFlow } from "./SubscriptionFlow";
import LoadingState from "./LoadingState";

const PLAN_STYLE = {
  pro: { ring: "border-blue-500 ring-1 ring-blue-500", accent: "text-blue-700", tick: "text-blue-600", button: "bg-blue-600 hover:bg-blue-700" },
  max: { ring: "border-purple-500 ring-1 ring-purple-500", accent: "text-purple-700", tick: "text-purple-600", button: "bg-purple-600 hover:bg-purple-700" },
};

function formatDate(ms) {
  const d = new Date(ms + 5 * 60 * 60 * 1000); // Asia/Tashkent, UTC+5 without DST
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
}

function Tick({ className }) {
  return (
    <svg className={`mt-0.5 h-4 w-4 flex-shrink-0 ${className}`} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  );
}

/**
 * Logged-in plan status and purchase. Selecting a plan only starts a
 * server-priced inPAY payment and redirects; the plan itself changes only
 * after the server has verified the payment with inPAY (see PaymentStatus).
 */
export default function SubscriptionPage() {
  const { t } = useTranslation();
  const { plan, planExpiry, isExpired, loading } = useSubscription();
  const { openManual, dialogs } = useSubscriptionFlow();
  const params = useSearchParams();
  const [period, setPeriod] = useState(BILLING_PERIODS.includes(params.get("period")) ? params.get("period") : "monthly");
  const [busyPlan, setBusyPlan] = useState(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(null);

  // Date.now() only after mount (render must stay pure and SSR-stable).
  useEffect(() => {
    const id = setTimeout(() => setNow(Date.now()), 0);
    return () => clearTimeout(id);
  }, []);

  if (loading || now === null) return <LoadingState />;

  const paid = plan === "pro" || plan === "max";
  const daysLeft = paid && planExpiry ? Math.max(0, Math.ceil((planExpiry - now) / DAY_MS)) : 0;
  const periodLabel = period === "yearly" ? t("sub.billing.yearly") : t("sub.billing.monthly");

  const pay = async (planId) => {
    if (busyPlan) return;
    setBusyPlan(planId);
    setError("");
    try {
      const { payUrl } = await createOnlinePayment(planId, period);
      window.location.assign(payUrl);
    } catch (err) {
      setError(
        err?.status === 401
          ? t("sub.error.auth")
          : err?.code === "rate_limited"
            ? t("sub.error.rateLimited")
            : err?.message || t("sub.error.generic")
      );
      setBusyPlan(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t("sub.title")}</h1>
        <p className="mt-1 text-sm sm:text-base text-gray-600">{t("sub.subtitle")}</p>
      </div>

      {/* Current status */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs" aria-label={t("sub.current.label")}>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{t("sub.current.label")}</p>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className={`text-2xl font-bold ${paid ? PLAN_STYLE[plan].accent : "text-gray-900"}`}>{t(`pricing.${plan}.name`)}</span>
          {paid && planExpiry && (
            <span className="text-sm text-gray-700">
              {t("sub.current.activeUntil", { date: formatDate(planExpiry) })} · {t("sub.current.daysLeft", { days: daysLeft })}
            </span>
          )}
        </div>
        {!paid && !isExpired && <p className="mt-1 text-sm text-gray-600">{t("sub.current.free")}</p>}
        {isExpired && planExpiry && (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {t("sub.current.expired", { date: formatDate(planExpiry) })}
          </p>
        )}
      </section>

      {/* Billing period */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-gray-900">{t("sub.compare.title")}</h2>
        <div className="inline-flex self-start rounded-lg border border-gray-200 bg-white p-1" role="radiogroup" aria-label={t("subscription.selectPeriod")}>
          {BILLING_PERIODS.map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={period === id}
              onClick={() => setPeriod(id)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                period === id ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {t(`sub.billing.${id}`)}
            </button>
          ))}
        </div>
      </div>

      {!ONLINE_PAYMENT_ENABLED && (
        <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t("sub.online.unavailable")}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {/* Plans */}
      <div className="grid gap-4 md:grid-cols-2">
        {["pro", "max"].map((id) => {
          const offer = PAID_PLANS[id][period];
          const style = PLAN_STYLE[id];
          const isCurrent = plan === id;
          const features = t(`pricing.${id}.features`);
          const action = isCurrent ? t("sub.action.renew") : t("sub.action.upgrade", { plan: t(`pricing.${id}.name`) });
          return (
            <article
              key={id}
              className={`relative flex flex-col rounded-2xl border bg-white p-5 shadow-sm sm:p-6 ${isCurrent ? style.ring : "border-gray-200"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className={`text-xl font-bold ${style.accent}`}>{t(`pricing.${id}.name`)}</h3>
                  <p className="text-sm text-gray-500">{t(`pricing.${id}.tagline`)}</p>
                </div>
                {isCurrent ? (
                  <span className="rounded-full bg-gray-900 px-2.5 py-1 text-xs font-semibold text-white">{t("sub.badge.current")}</span>
                ) : id === "pro" ? (
                  <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">{t("sub.badge.popular")}</span>
                ) : null}
              </div>

              <div className="mt-4">
                <span className="text-3xl font-bold tabular-nums text-gray-900">{formatSom(offer.amount)}</span>
                <span className="ml-1 text-sm text-gray-500">
                  UZS {period === "yearly" ? t("sub.perYear") : t("sub.perMonth")}
                </span>
                {period === "yearly" && (
                  <p className="mt-0.5 text-xs text-emerald-700">
                    {t("sub.yearlyEquivalent", { amount: formatSom(offer.amount / 12) })} ·{" "}
                    {t("sub.billing.save", { percent: yearlySavingPercent(id) })}
                  </p>
                )}
              </div>

              <ul className="mt-5 flex-1 space-y-2">
                {(Array.isArray(features) ? features : []).map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-gray-700">
                    <Tick className={style.tick} />
                    {feature}
                  </li>
                ))}
              </ul>

              <div className="mt-6 space-y-2">
                {ONLINE_PAYMENT_ENABLED && (
                  <button
                    type="button"
                    onClick={() => pay(id)}
                    disabled={Boolean(busyPlan)}
                    aria-busy={busyPlan === id}
                    className={`w-full rounded-lg px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors disabled:cursor-wait disabled:opacity-70 ${style.button}`}
                  >
                    {busyPlan === id ? t("sub.action.redirecting") : `${action} — ${t("sub.action.payOnline")}`}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openManual(id, period)}
                  disabled={Boolean(busyPlan)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60"
                >
                  {t("sub.manual.button", { plan: t(`pricing.${id}.name`), period: periodLabel })}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <div className="space-y-1 text-xs text-gray-500">
        {ONLINE_PAYMENT_ENABLED && <p>{t("sub.note.verified")}</p>}
        {paid && daysLeft > 0 && <p>{t("sub.note.credit")}</p>}
        <p>
          <strong className="font-semibold text-gray-700">{t("sub.manual.title")}:</strong> {t("sub.manual.desc")}
        </p>
      </div>

      {dialogs}
    </div>
  );
}
