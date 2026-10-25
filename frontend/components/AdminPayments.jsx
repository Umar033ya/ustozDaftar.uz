"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/useTranslation";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { authorizedFetch, useIsAdmin } from "@/lib/apiClient";
import LoadingState from "./LoadingState";

export default function AdminPayments() {
  const { t } = useTranslation();
  const { isAdmin, checking } = useIsAdmin();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [processing, setProcessing] = useState(null);

  useEffect(() => {
    if (!isAdmin) return;

    // Reading is allowed to admins by the security rules; every change goes
    // through the server (/api/admin/payments).
    const q = query(collection(db, "paymentRequests"), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const requestsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || new Date(),
        }));
        setRequests(requestsData);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching payment requests:", err?.code || err);
        setError(t("adminPayments.fetchError"));
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isAdmin, t]);

  // Approval runs on the server: it re-checks the admin claim, reads the
  // user's current plan, applies the prorated upgrade policy exactly once and
  // writes an audit log entry.
  const runAction = async (request, action) => {
    setProcessing(request.id);
    setError("");
    setNotice("");
    try {
      const result = await authorizedFetch("/api/admin/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, source: "manual", id: request.id }),
      });
      if (action === "approve" && result.planExpiry) {
        setNotice(`Tasdiqlandi. Tarif ${new Date(result.planExpiry).toLocaleDateString("uz-UZ", { timeZone: "Asia/Tashkent" })} gacha faol.`);
      }
    } catch (err) {
      setError(err.message || t(action === "approve" ? "adminPayments.approveError" : "adminPayments.rejectError"));
    } finally {
      setProcessing(null);
    }
  };

  const handleApprove = (request) => runAction(request, "approve");
  const handleReject = (request) => runAction(request, "reject");

  if (checking) return <LoadingState />;

  if (!isAdmin) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm font-medium text-red-700">{t("adminPayments.notAdmin")}</p>
      </div>
    );
  }

  if (loading) return <LoadingState label={t("loading")} />;

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const processedRequests = requests.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("adminPayments.title")}</h1>
          <p className="mt-1 text-sm text-gray-600">{t("adminPayments.subtitle")}</p>
        </div>
        <Link href="/dashboard/admin" className="text-sm font-medium text-blue-600 hover:text-blue-800">
          Moliyaviy hisobot →
        </Link>
      </div>

      {notice && (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-800">
          {notice}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {/* Pending Requests */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {t("adminPayments.pending")} ({pendingRequests.length})
          </h2>
        </div>
        {pendingRequests.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500">
            {t("adminPayments.noPending")}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {pendingRequests.map((request) => (
              <PaymentRequestRow
                key={request.id}
                request={request}
                onApprove={() => handleApprove(request)}
                onReject={() => handleReject(request)}
                processing={processing === request.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Processed Requests */}
      {processedRequests.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {t("adminPayments.processed")} ({processedRequests.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-200">
            {processedRequests.map((request) => (
              <PaymentRequestRow
                key={request.id}
                request={request}
                onApprove={null}
                onReject={null}
                processing={false}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PaymentRequestRow({ request, onApprove, onReject, processing }) {
  const { t } = useTranslation();

  const statusColors = {
    pending: "bg-amber-100 text-amber-800",
    approved: "bg-emerald-100 text-emerald-800",
    rejected: "bg-red-100 text-red-800",
    refunded: "bg-gray-200 text-gray-800",
  };

  const planNames = {
    pro: t("subscription.pro"),
    max: t("subscription.max"),
  };

  const periodNames = {
    monthly: t("subscription.monthlyBilling"),
    yearly: t("subscription.yearlyBilling"),
  };

  return (
    <div className="px-6 py-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">{request.userName || request.userEmail}</span>
            <span className="text-xs text-gray-500">{request.userEmail}</span>
            <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${statusColors[request.status]}`}>
              {t("adminPayments.status")?.[request.status] || request.status}
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <div>
              <span className="text-gray-500">{t("adminPayments.plan")}: </span>
              <span className="font-medium text-gray-900">{planNames[request.plan]}</span>
            </div>
            <div>
              <span className="text-gray-500">{t("adminPayments.billingPeriod")}: </span>
              <span className="font-medium text-gray-900">{periodNames[request.billingPeriod]}</span>
            </div>
            <div>
              <span className="text-gray-500">{t("adminPayments.amount")}: </span>
              <span className="font-medium text-gray-900">{request.amount} UZS</span>
            </div>
            <div>
              <span className="text-gray-500">{t("adminPayments.cardLastFour")}: </span>
              <span className="font-medium text-gray-900">****{request.cardLastFour}</span>
            </div>
            <div>
              <span className="text-gray-500">{t("adminPayments.cardholderName")}: </span>
              <span className="font-medium text-gray-900">{request.cardholderName}</span>
            </div>
            <div>
              <span className="text-gray-500">{t("adminPayments.paymentDateTime")}: </span>
              <span className="font-medium text-gray-900">{new Date(request.paymentDateTime).toLocaleString()}</span>
            </div>
            <div className="col-span-2">
              <span className="text-gray-500">{t("adminPayments.submittedAt")}: </span>
              <span className="font-medium text-gray-900">{request.createdAt.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {onApprove && onReject && (
          <div className="flex gap-2">
            <button
              onClick={onApprove}
              disabled={processing}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {processing ? t("adminPayments.processing") : t("adminPayments.approve")}
            </button>
            <button
              onClick={onReject}
              disabled={processing}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {processing ? t("adminPayments.processing") : t("adminPayments.reject")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
