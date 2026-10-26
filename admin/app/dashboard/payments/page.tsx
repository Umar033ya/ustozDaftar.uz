import { Card, CardHeader, ErrorBanner, PageHeader } from "@/components/ui";
import { PaymentsTable } from "@/components/payments-table";
import { InpayTable } from "@/components/inpay-table";
import { getInpayPayments, getPayments } from "@/lib/data";
import type { InpayPayment, PaymentRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  let payments: PaymentRequest[] = [];
  let inpay: InpayPayment[] = [];
  let error: string | null = null;

  try {
    [payments, inpay] = await Promise.all([getPayments(), getInpayPayments()]);
  } catch (e) {
    error = e instanceof Error ? e.message : "Server xatosi";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="To'lovlar"
        subtitle="inPAY onlayn to'lovlari va karta o'tkazmasi so'rovlari"
      />
      {error ? (
        <ErrorBanner message={`Ma'lumotlarni yuklab bo'lmadi: ${error}`} />
      ) : (
        <>
          <Card>
            <CardHeader
              title="inPAY to'lovlari"
              subtitle="Holat inPAY serveridan tekshiriladi; to'langanda tarif avtomatik faollashadi"
            />
            <InpayTable payments={inpay} />
          </Card>
          <Card>
            <CardHeader
              title="Karta o'tkazmasi so'rovlari"
              subtitle="Tasdiqlash / rad etish — obuna bir Firestore tranzaksiyasida yangilanadi"
            />
            <PaymentsTable initialPayments={payments} />
          </Card>
        </>
      )}
    </div>
  );
}
