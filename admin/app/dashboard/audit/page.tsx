import { Card, EmptyState, ErrorBanner, PageHeader } from "@/components/ui";
import { AuditTable } from "@/components/audit-table";
import { getAuditLogs } from "@/lib/data";
import type { AuditLog } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  let logs: AuditLog[] = [];
  let error: string | null = null;

  try {
    logs = await getAuditLogs();
  } catch (e) {
    error = e instanceof Error ? e.message : "Server xatosi";
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Audit jurnali"
        subtitle="Muhim admin amallari qayd etiladi: to'lovni tasdiqlash/rad etish va tarif o'zgarishlari"
      />
      {error ? (
        <ErrorBanner message={`Ma'lumotlarni yuklab bo'lmadi: ${error}`} />
      ) : logs.length === 0 ? (
        <Card>
          <EmptyState
            title="Audit yozuvlari yo'q"
            description="Admin amallari bajarilganda yozuvlar shu yerda paydo bo'ladi."
          />
        </Card>
      ) : (
        <Card>
          <AuditTable initialLogs={logs} />
        </Card>
      )}
    </div>
  );
}

export const metadata = {
  title: "Audit jurnali",
};