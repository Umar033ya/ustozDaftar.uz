import Link from "next/link";
import { Card, EmptyState, ErrorBanner, PageHeader, StatCard, TableShell, Td, Th } from "@/components/ui";
import { getSchools } from "@/lib/schools";
import { formatNumber } from "@/lib/format";
import type { School } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SchoolsPage() {
  let schools: School[] = [];
  let withoutSchool = 0;
  let error: string | null = null;

  try {
    ({ schools, withoutSchool } = await getSchools());
  } catch (e) {
    error = e instanceof Error ? e.message : "Server xatosi";
  }

  const teachers = schools.reduce((sum, s) => sum + s.teachers.length, 0);
  const classes = schools.reduce((sum, s) => sum + s.classCount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Maktablar"
        subtitle="O'qituvchilar profilidagi maktab nomi bo'yicha guruhlangan"
      />
      {error ? (
        <ErrorBanner message={`Ma'lumotlarni yuklab bo'lmadi: ${error}`} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard label="Maktablar" value={formatNumber(schools.length)} />
            <StatCard label="O'qituvchilar (maktabli)" value={formatNumber(teachers)} />
            <StatCard label="Sinflar" value={formatNumber(classes)} />
            <StatCard label="Maktab ko'rsatmaganlar" value={formatNumber(withoutSchool)} />
          </div>

          <Card>
            {schools.length === 0 ? (
              <EmptyState
                title="Maktablar yo'q"
                description="Hali hech bir o'qituvchi profilida maktab nomini kiritmagan."
              />
            ) : (
              <TableShell>
                <thead>
                  <tr>
                    <Th>Maktab</Th>
                    <Th className="text-center">O&apos;qituvchilar</Th>
                    <Th className="text-center">Sinflar</Th>
                    <Th className="text-center">O&apos;quvchilar</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {schools.map((s) => (
                    <tr key={s.key} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <Td>
                        <Link
                          href={`/dashboard/schools/${encodeURIComponent(s.key)}`}
                          className="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                        >
                          {s.name}
                        </Link>
                      </Td>
                      <Td className="text-center tabular-nums">{formatNumber(s.teachers.length)}</Td>
                      <Td className="text-center tabular-nums">{formatNumber(s.classCount)}</Td>
                      <Td className="text-center tabular-nums">{formatNumber(s.studentCount)}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
