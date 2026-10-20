"use client";

import { useCallback, useState } from "react";
import PlanInfoModal from "./PlanInfoModal";
import PaymentModal from "./PaymentModal";
import PaymentRequestForm from "./PaymentRequestForm";

/**
 * Owns the manual subscription flow:
 *   plan info  ->  payment instructions  ->  payment request (admin review)
 *
 * Returns the trigger callbacks plus the dialog elements to render. Nothing here
 * activates a plan — a request simply lands as `pending` for an admin to review.
 */
export function useSubscriptionFlow() {
  const [stage, setStage] = useState(null); // null | "info" | "payment" | "request"
  const [selection, setSelection] = useState(null); // { plan, billingPeriod }

  const close = useCallback(() => setStage(null), []);
  const openPlanInfo = useCallback(() => setStage("info"), []);
  const openPurchase = useCallback((plan, billingPeriod = "monthly") => {
    setSelection({ plan, billingPeriod });
    setStage("payment");
  }, []);

  const dialogs = (
    <>
      <PlanInfoModal
        open={stage === "info"}
        onClose={close}
        onPurchase={(plan, billingPeriod) => openPurchase(plan, billingPeriod)}
      />
      <PaymentModal
        open={stage === "payment"}
        onClose={close}
        plan={selection?.plan}
        billingPeriod={selection?.billingPeriod}
        onContinue={() => setStage("request")}
      />
      <PaymentRequestForm
        open={stage === "request"}
        onClose={close}
        plan={selection?.plan}
        billingPeriod={selection?.billingPeriod}
      />
    </>
  );

  return { openPlanInfo, openPurchase, close, stage, selection, dialogs };
}
