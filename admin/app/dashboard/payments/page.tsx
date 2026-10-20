import { Card, ErrorBanner, PageHeader } from "@/components/ui";
import { PaymentsTable } from "@/components/payments-table";
import { getPayments } from "@/lib/data";
import type { PaymentRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  let payments: PaymentRequest[] = [];
  let error: string | null = null;

  try {
    payments = await getPayments();
  } catch (e) {
    error = e instanceof Error ? e.message : "Server xatosi";
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="To'lovlar"
        subtitle="Tasdiqlash / rad etish — obuna bir Firestore tranzaksiyasida yangilanadi"
      />
      {error ? (
        <ErrorBanner message={`Ma'lumotlarni yuklab bo'lmadi: ${error}`} />
      ) : (
        <Card>
          <PaymentsTable initialPayments={payments} />
        </Card>
      )}
    </div>
  );
}