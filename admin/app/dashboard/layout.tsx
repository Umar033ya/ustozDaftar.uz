import { Sidebar } from "@/components/sidebar";
import { requireAdminUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Real security boundary: verify the httpOnly session cookie + admin claim in
  // Node.js before rendering any dashboard content.
  const admin = await requireAdminUser();

  return (
    <div className="min-h-screen">
      <div className="flex min-h-screen">
        <Sidebar user={{ email: admin.email, uid: admin.uid }} />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}