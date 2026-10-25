"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/authContext";
import { useTranslation } from "@/lib/useTranslation";
import { fetchPaymentStatus } from "@/lib/onlinePayment";
import LoadingState from "./LoadingState";

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 40; // about two minutes, then the user re-checks manually
const FINAL = new Set(["success", "failed", "cancelled", "expired", "review"]);

const TONES = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  pending: "border-blue-200 bg-blue-50 text-blue-800",
  review: "border-amber-200 bg-amber-50 text-amber-800",
  error: "border-red-200 bg-red-50 text-red-800",
};

function formatDate(ms) {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export default function PaymentStatus() {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const pid = useSearchParams().get("pid") || "";
  const [payment, setPayment] = useState(null);
  const [phase, setPhase] = useState("checking"); // checking | polling | idle | error | notFound
  // Bumping the round restarts the polling loop (used by "check again").
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (!currentUser || !pid) return undefined;
    let cancelled = false;
    let timer = null;
    let polls = 0;

    const check = async () => {
      try {
        const { payment: next } = await fetchPaymentStatus(pid);
        if (cancelled) return;
        setPayment(next);
        if (!FINAL.has(next.status) && polls < MAX_POLLS) {
          polls += 1;
          setPhase("polling");
          timer = setTimeout(check, POLL_INTERVAL_MS);
        } else {
          setPhase("idle");
        }
      } catch (error) {
        if (!cancelled) setPhase(error?.status === 404 ? "notFound" : "error");
      }
    };

    timer = setTimeout(check, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [currentUser, pid, round]);

  const recheck = () => {
    setPhase("checking");
    setRound((n) => n + 1);
  };

  if (!pid || phase === "notFound") {
    return <Panel tone="error" title={t("inpay.status.title")} message={t("inpay.status.notFound")} actions={<BackLink t={t} />} />;
  }
  if (!payment && phase === "checking") return <LoadingState label={t("inpay.status.checking")} />;
  if (!payment && phase === "error") {
    return (
      <Panel tone="error" title={t("inpay.status.title")} message={t("inpay.status.checkError")} actions={<RetryButton t={t} onClick={recheck} />} />
    );
  }

  const status = payment.status;
  const planName = payment.plan === "max" ? t("subscription.max") : t("subscription.pro");
  let tone = "error";
  let message = t(`inpay.status.${status}`);
  let actions = <BackLink t={t} />;

  if (status === "success") {
    tone = "success";
    message = t("inpay.status.success", { plan: planName, date: payment.planExpiry ? formatDate(payment.planExpiry) : "—" });
  } else if (status === "pending" || status === "creating") {
    tone = "pending";
    message = phase === "polling" ? t("inpay.status.pending") : t("inpay.status.stillPending");
    actions = (
      <>
        {phase !== "polling" && <RetryButton t={t} onClick={recheck} />}
        {payment.payUrl && (
          <a href={payment.payUrl} className="rounded-lg border border-blue-200 bg-white px-4 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-50">
            {t("inpay.action.payAgain")}
          </a>
        )}
        <BackLink t={t} />
      </>
    );
  } else if (status === "review") {
    tone = "review";
  }

  return (
    <Panel
      tone={tone}
      title={t("inpay.status.title")}
      message={message}
      busy={phase === "polling"}
      details={`${planName} · ${payment.billingPeriod === "yearly" ? t("subscription.yearlyBilling") : t("subscription.monthlyBilling")} · ${Number(payment.amount).toLocaleString("ru-RU")} UZS`}
      actions={actions}
    />
  );
}

function Panel({ tone, title, message, details, actions, busy = false }) {
  return (
    <div className="mx-auto max-w-lg py-8">
      <h1 className="mb-4 text-2xl font-bold text-gray-900">{title}</h1>
      <div role="status" aria-live="polite" className={`rounded-xl border p-5 ${TONES[tone]}`}>
        <div className="flex items-start gap-3">
          {busy && (
            <svg className="mt-0.5 h-5 w-5 shrink-0 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          <p className="text-sm font-medium leading-relaxed">{message}</p>
        </div>
        {details && <p className="mt-3 text-xs opacity-80">{details}</p>}
      </div>
      <div className="mt-5 flex flex-wrap gap-3">{actions}</div>
    </div>
  );
}

function RetryButton({ t, onClick }) {
  return (
    <button type="button" onClick={onClick} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700">
      {t("inpay.action.retry")}
    </button>
  );
}

function BackLink({ t }) {
  return (
    <Link href="/dashboard/subscription" className="rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200">
      {t("inpay.action.toSubscription")}
    </Link>
  );
}
