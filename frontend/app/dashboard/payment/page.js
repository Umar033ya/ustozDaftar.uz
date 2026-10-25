import { Suspense } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import LoadingState from "@/components/LoadingState";
import PaymentStatus from "@/components/PaymentStatus";

// inPAY sends the payer back here (return_url = /dashboard/payment?pid=<id>).
// The status shown is always the server-verified one, never the URL's.
export default function PaymentReturnPage() {
  return (
    <DashboardLayout>
      <Suspense fallback={<LoadingState />}>
        <PaymentStatus />
      </Suspense>
    </DashboardLayout>
  );
}
