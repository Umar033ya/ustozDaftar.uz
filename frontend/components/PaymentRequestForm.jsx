"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/useTranslation";
import { useAuth } from "@/lib/authContext";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

const PLAN_AMOUNTS = {
  pro: { monthly: "20,000", yearly: "180,000" },
  max: { monthly: "45,000", yearly: "480,000" },
};

export default function PaymentRequestForm({ open, onClose, plan, billingPeriod, onSuccess }) {
  const { t } = useTranslation();
  const { currentUser, userProfile } = useAuth();
  const [cardLastFour, setCardLastFour] = useState("");
  const [cardholderName, setCardholderName] = useState("");
  const [paymentDateTime, setPaymentDateTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  if (!open || !plan || !billingPeriod) return null;

  const amount = PLAN_AMOUNTS[plan]?.[billingPeriod] || "";
  const planName = plan === "max" ? t("subscription.max") : t("subscription.pro");
  const periodName =
    billingPeriod === "yearly" ? t("subscription.yearlyBilling") : t("subscription.monthlyBilling");

  const close = () => {
    setCardLastFour("");
    setCardholderName("");
    setPaymentDateTime("");
    setError("");
    setSuccess(false);
    onClose?.();
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!cardLastFour.trim()) {
      setError(t("paymentRequest.cardLastFourError"));
      return;
    }
    if (cardLastFour.length !== 4 || !/^[0-9]+$/.test(cardLastFour)) {
      setError(t("paymentRequest.cardLastFourInvalid"));
      return;
    }
    if (!cardholderName.trim()) {
      setError(t("paymentRequest.cardholderNameError"));
      return;
    }
    if (!paymentDateTime.trim()) {
      setError(t("paymentRequest.paymentDateTimeError"));
      return;
    }
    if (!currentUser) {
      setError(t("paymentRequest.authError"));
      return;
    }

    setSubmitting(true);
    
    try {
      // Create payment request in Firestore
      await addDoc(collection(db, "paymentRequests"), {
        uid: currentUser.uid,
        userName: userProfile ? `${userProfile.firstName || ""} ${userProfile.lastName || ""}`.trim() : "",
        userEmail: currentUser.email || "",
        plan,
        billingPeriod,
        amount,
        cardLastFour: cardLastFour.trim(),
        cardholderName: cardholderName.trim(),
        paymentDateTime: paymentDateTime.trim(),
        status: "pending",
        createdAt: serverTimestamp(),
      });

      setSuccess(true);
      onSuccess?.();
    } catch (err) {
      console.error("Error submitting payment request:", err);
      setError(err.message || t("paymentRequest.submitError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-black/50 px-4 py-6" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("paymentRequest.title")}
        className="my-auto w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 p-5">
          <h2 className="text-lg font-bold text-gray-900">{t("paymentRequest.title")}</h2>
          <button
            onClick={close}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label={t("general.close")}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5">
          <div className="mb-5 grid grid-cols-2 gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div>
              <p className="text-xs font-medium text-blue-700">{t("paymentRequest.plan")}</p>
              <p className="mt-0.5 text-sm font-semibold text-blue-900">
                {planName} · {periodName}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-blue-700">{t("paymentRequest.amount")}</p>
              <p className="mt-0.5 text-sm font-semibold text-blue-900">{amount} UZS</p>
            </div>
          </div>

          {success ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-medium text-emerald-700">
              {t("paymentRequest.success")}
            </div>
          ) : !currentUser ? (
            // Sending a request needs an account so the admin can match it to a user.
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs text-amber-800">{t("paymentRequest.signInRequired")}</p>
              </div>
              <Link
                href="/login"
                className="block w-full rounded-lg bg-blue-600 py-3 text-center text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                {t("nav.login")}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="cardLastFour" className="mb-1.5 block text-sm font-medium text-gray-700">
                  {t("paymentRequest.cardLastFourLabel")}
                </label>
                <input
                  id="cardLastFour"
                  type="text"
                  value={cardLastFour}
                  onChange={(e) => setCardLastFour(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
                  disabled={submitting}
                  maxLength={4}
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:border-transparent focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder={t("paymentRequest.cardLastFour.placeholder")}
                />
              </div>

              <div>
                <label htmlFor="cardholderName" className="mb-1.5 block text-sm font-medium text-gray-700">
                  {t("paymentRequest.cardholderNameLabel")}
                </label>
                <input
                  id="cardholderName"
                  type="text"
                  value={cardholderName}
                  onChange={(e) => setCardholderName(e.target.value)}
                  disabled={submitting}
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:border-transparent focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder={t("paymentRequest.cardholderName.placeholder")}
                />
              </div>

              <div>
                <label htmlFor="paymentDateTime" className="mb-1.5 block text-sm font-medium text-gray-700">
                  {t("paymentRequest.paymentDateTimeLabel")}
                </label>
                <input
                  id="paymentDateTime"
                  type="datetime-local"
                  value={paymentDateTime}
                  onChange={(e) => setPaymentDateTime(e.target.value)}
                  disabled={submitting}
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:border-transparent focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs text-amber-800">{t("paymentRequest.pending")}</p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-blue-600 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {submitting ? t("paymentRequest.submitting") : t("paymentRequest.submit")}
              </button>
            </form>
          )}
        </div>

        {!success && (
          <div className="flex justify-end border-t border-gray-200 p-5">
            <button
              type="button"
              onClick={close}
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
            >
              {t("general.cancel")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
