import { Suspense } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import LoadingState from "@/components/LoadingState";
import SubscriptionPage from "@/components/SubscriptionPage";

// Signed-in users only (DashboardLayout redirects anonymous visitors to /login).
export default function Subscription() {
  return (
    <DashboardLayout>
      <Suspense fallback={<LoadingState />}>
        <SubscriptionPage />
      </Suspense>
    </DashboardLayout>
  );
}
