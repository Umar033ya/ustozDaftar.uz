import DashboardLayout from "@/components/DashboardLayout";
import AdminFinance from "@/components/admin/AdminFinance";

// /dashboard/admin — the protected admin dashboard (financial report).
// The page itself only renders; every number comes from /api/admin/finance,
// which verifies the server-assigned admin claim. Regular users get a 403
// from the API and an "admins only" notice here.
export default function AdminFinancePage() {
  return (
    <DashboardLayout>
      <AdminFinance />
    </DashboardLayout>
  );
}
