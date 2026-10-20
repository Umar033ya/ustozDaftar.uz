import { Card, EmptyState, ErrorBanner, PageHeader, TableShell, Td, Th } from "@/components/ui";
import { UsersTable } from "@/components/users-table";
import { getUsers } from "@/lib/data";
import type { AdminUser } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
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
        title="Foydalanuvchilar"
        subtitle="Real ro'yxat — qidirish, filtrlash va profil ma'lumotlari"
      />
      {error ? (
        <ErrorBanner message={`Ma'lumotlarni yuklab bo'lmadi: ${error}`} />
      ) : (
        <Card>
          <UsersTable initialUsers={users} />
        </Card>
      )}
    </div>
  );
}