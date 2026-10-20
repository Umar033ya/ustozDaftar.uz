import { Card, ErrorBanner, PageHeader } from "@/components/ui";
import { SubscriptionsTable } from "@/components/subscriptions-table";
import { getUsers } from "@/lib/data";
import type { AdminUser } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SubscriptionsPage() {
  let users: AdminUser[] = [];
  let error: string | null = null;

  try {
    users = await getUsers();
  } catch (e) {
    error = e instanceof Error ? e.message : "Server xatosi";
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Obunalar"
        subtitle="Free/Pro/Max foydalanuvchilar va amal qilish muddatlari — xavfsiz boshqaruv"
      />
      {error ? (
        <ErrorBanner message={`Ma'lumotlarni yuklab bo'lmadi: ${error}`} />
      ) : (
        <Card>
          <SubscriptionsTable initialUsers={users} />
        </Card>
      )}
    </div>
  );
}