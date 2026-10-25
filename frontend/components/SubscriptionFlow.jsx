"use client";

import { useCallback, useState } from "react";
import PaymentModal from "./PaymentModal";
import PaymentRequestForm from "./PaymentRequestForm";

/**
 * Manual card-transfer flow, kept separate from inPAY:
 *   transfer instructions  ->  payment request (admin review)
 *
 * Returns the trigger callback plus the dialog elements to render. Nothing here
 * activates a plan — a request simply lands as `pending` for an admin to review.
 * Online (inPAY) payment lives on /dashboard/subscription.
 */
export function useSubscriptionFlow() {
  const [stage, setStage] = useState(null); // null | "payment" | "request"
  const [selection, setSelection] = useState(null); // { plan, billingPeriod }

  const close = useCallback(() => setStage(null), []);
  const openManual = useCallback((plan, billingPeriod = "monthly") => {
    setSelection({ plan, billingPeriod });
    setStage("payment");
  }, []);

  const dialogs = (
    <>
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

  return { openManual, close, stage, selection, dialogs };
}
