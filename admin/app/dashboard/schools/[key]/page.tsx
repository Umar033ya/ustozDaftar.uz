import Link from "next/link";
import { notFound } from "next/navigation";
import { CreateClassForm } from "@/components/class-tools";
import { Badge, Card, CardHeader, EmptyState, ErrorBanner, PlanBadge, StatCard } from "@/components/ui";
import { getSchool } from "@/lib/schools";
import { formatNumber } from "@/lib/format";
import type { School } from "@/lib/types";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ key: string }>;
}

/** Distinct classes of the school (same name + year), with the teachers that have them. */
function groupClasses(school: School) {
  const groups = new Map<string, { name: string; academicYear: string; teachers: string[]; students: number }>();
  for (const teacher of school.teachers) {
    for (const c of teacher.classes) {
      const id = `${c.name.trim().toLowerCase()}|${c.academicYear.trim()}`;
      const group = groups.get(id) ?? { name: c.name, academicYear: c.academicYear, teachers: [], students: 0 };
      group.teachers.push(teacher.name);
      group.students = Math.max(group.students, c.studentCount);
      groups.set(id, group);
    }
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, "uz", { numeric: true }));
}

export default async function SchoolPage({ params }: PageProps) {
  const { key } = await params;

  let school: School | null;
  try {
    school = await getSchool(decodeURIComponent(key));
  } catch (e) {
    return (
      <div className="space-y-4">
        <BackLink />
        <ErrorBanner message={`Ma'lumotlarni yuklab bo'lmadi: ${e instanceof Error ? e.message : "Server xatosi"}`} />
      </div>
    );
  }
  if (!school) notFound();

  const classes = groupClasses(school);
  const active = school.teachers.filter((t) => !t.blocked).length;

  return (
    <div className="space-y-6">
      <BackLink />
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{school.name}</h1>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="O'qituvchilar" value={formatNumber(school.teachers.length)} />
        <StatCard label="Turli sinflar" value={formatNumber(classes.length)} />
        <StatCard label="Jami sinflar" value={formatNumber(school.classCount)} />
        <StatCard label="O'quvchilar" value={formatNumber(school.studentCount)} />
      </div>

      <Card>
        <CardHeader title="Maktab uchun sinf yaratish" />
        <div className="p-5">
          <CreateClassForm
            endpoint={`/api/admin/schools/${encodeURIComponent(school.key)}/classes`}
            hint={`Sinf shu maktabning ${active} ta o'qituvchisi kabinetiga qo'shiladi (bloklanganlardan tashqari). Har bir o'qituvchi o'z nusxasida BSB/ChSB yarata oladi.`}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Sinflar" subtitle="Bir xil nom va o'quv yilidagi sinflar birlashtirilgan" />
        {classes.length === 0 ? (
          <EmptyState title="Sinflar yo'q" description="Bu maktab o'qituvchilari hali sinf yaratmagan." />
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {classes.map((c) => (
              <div key={`${c.name}|${c.academicYear}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
                <span className="font-semibold text-gray-900 dark:text-gray-100">{c.name || "Nomsiz sinf"}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{c.academicYear}</span>
                <span className="ml-auto flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                  <Badge tone="blue">{formatNumber(c.students)} o&apos;quvchi</Badge>
                  <span>{c.teachers.join(", ")}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="O'qituvchilar" subtitle="Sinfiga o'quvchi qo'shish uchun o'qituvchini oching" />
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {school.teachers.map((t) => (
            <div key={t.uid} className="space-y-2 px-5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/dashboard/users/${encodeURIComponent(t.uid)}`}
                  className="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  {t.name}
                </Link>
                {t.email && <span className="text-xs text-gray-500 dark:text-gray-400">{t.email}</span>}
                <PlanBadge plan={t.plan} />
                {t.blocked && <Badge tone="red">Bloklangan</Badge>}
              </div>
              {t.classes.length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-gray-400">Sinf yo&apos;q</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {t.classes.map((c) => (
                    <Badge key={c.id} tone={c.createdByAdmin ? "purple" : "gray"}>
                      {c.name} · {c.studentCount}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/dashboard/schools"
      className="inline-flex text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
    >
      ← Maktablar
    </Link>
  );
}
