import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, CardHeader } from "@/components/ui";
import { hasAdminCredentials } from "@/lib/firebaseAdmin";
import { requireAdminUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sozlamalar",
};

export default async function SettingsPage() {
  const admin = await requireAdminUser();
  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "—";
  const adminCredentialsConfigured = hasAdminCredentials();
  const sessionDays = process.env.ADMIN_SESSION_MAX_AGE_SECONDS
    ? `${process.env.ADMIN_SESSION_MAX_AGE_SECONDS} s`
    : "7 kun (standart)";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Sozlamalar</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Ushbu panel faqat mavjud ilova tomonidan qo&apos;llab-quvvatlanadigan sozlamalarni
          ko&apos;rsatadi — qo&apos;llab-quvvatlanmaydigan funksiyalar qo&apos;shilmagan.
        </p>
      </div>

      <Card>
        <CardHeader title="Firebase loyihasi" subtitle="UstozDaftar.uz boshqaruvi qaysi loyihaga ulangan" />
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <InfoRow label="Loyiha ID" value={projectId} />
          <InfoRow
            label="Admin ma'lumotlari (server)"
            value={
              adminCredentialsConfigured ? (
                <Badge tone="green">Sozlangan</Badge>
              ) : (
                <Badge tone="red">Sozlanmagan</Badge>
              )
            }
          />
          <InfoRow label="Bu profil" value={admin.email ?? admin.uid} />
          <InfoRow label="Sessiya muddati" value={sessionDays} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Xavfsizlik qaydlari" subtitle="Muhim eslatmalar" />
        <ul className="list-disc space-y-2 px-5 py-4 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
          <li>
            Admin huquqi faqat server tomonda o&apos;rnatiladi (<code>admin: true</code> custom
            claim). Ushbu panel hech qachon claim bermaydi.
          </li>
          <li>
            Kirish sessiyasi httpOnly cookie&apos;da saqlanadi; har bir sahifa va API so&apos;rovi
            claimni serverda qayta tekshiradi.
          </li>
          <li>
            To&apos;lov tasdiqlash Firestore tranzaksiyasida bajariladi va o&apos;z so&apos;rovini
            tasdiqlash taqiqlangan.
          </li>
          <li>
            Ma&apos;lumotlarni o&apos;qish/yozish Firebase Admin SDK orqali amalga oshiriladi —
            Firestore qoidalari kuchsizlantirilmagan.
          </li>
        </ul>
      </Card>

      <Card>
        <CardHeader title="Foydali havolalar" subtitle="Boshqaruv uchun" />
        <div className="flex flex-wrap gap-2 p-5">
          <Link
            href="https://console.firebase.google.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Firebase Console
          </Link>
          <Link
            href="https://firebase.google.com/docs/auth/admin/custom-claims"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Custom claims hujjati
          </Link>
        </div>
      </Card>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-800/50">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  );
}