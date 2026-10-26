import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, CardHeader, EmptyState, ErrorBanner, PlanBadge, StatCard, TableShell, Td, Th } from "@/components/ui";
import { getUserWorkspace } from "@/lib/data";
import { formatDate, formatName, formatNumber } from "@/lib/format";
import type { AdminUser, UserWorkspace, WorkspaceAssessment, WorkspaceClass } from "@/lib/types";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ uid: string }>;
}

export default async function UserWorkspacePage({ params }: PageProps) {
  const { uid } = await params;

  let data: { user: AdminUser; workspace: UserWorkspace } | null;
  try {
    data = await getUserWorkspace(decodeURIComponent(uid));
  } catch (e) {
    return (
      <div className="space-y-4">
        <BackLink />
        <ErrorBanner message={`Ma'lumotlarni yuklab bo'lmadi: ${e instanceof Error ? e.message : "Server xatosi"}`} />
      </div>
    );
  }
  if (!data) notFound();

  const { user, workspace } = data;

  return (
    <div className="space-y-6">
      <BackLink />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatName(user)}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {[user.email, user.schoolName].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <PlanBadge plan={user.plan} />
          Ro&apos;yxatdan o&apos;tgan: {formatDate(user.createdAt)}
          <Link
            href={`/dashboard/chat?uid=${encodeURIComponent(user.uid)}`}
            className="ml-2 rounded-lg bg-blue-600 px-3 py-1.5 font-semibold text-white hover:bg-blue-700"
          >
            Xabar yozish
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Sinflar" value={formatNumber(user.classCount)} />
        <StatCard label="O'quvchilar" value={formatNumber(user.studentCount)} />
        <StatCard label="BSB" value={formatNumber(user.bsbCount)} />
        <StatCard label="ChSB" value={formatNumber(user.chsbCount)} />
      </div>

      <Card>
        <CardHeader
          title="Sinflar"
          subtitle="O'quvchilar ro'yxatini ko'rish uchun sinfni bosing"
        />
        {workspace.classes.length === 0 ? (
          <EmptyState title="Sinflar yo'q" description="Bu foydalanuvchi hali sinf yaratmagan." />
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {workspace.classes.map((c) => (
              <ClassRow key={c.id} cls={c} assessments={workspace.assessments.filter((a) => a.classId === c.id)} />
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title="BSB va ChSB"
          subtitle="Natijalarni ko'rish uchun baholashni bosing"
        />
        {workspace.assessments.length === 0 ? (
          <EmptyState title="Baholashlar yo'q" description="Bu foydalanuvchi hali BSB yoki ChSB yaratmagan." />
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {workspace.assessments.map((a) => (
              <AssessmentRow key={a.id} assessment={a} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/dashboard/users"
      className="inline-flex text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
    >
      ← Foydalanuvchilar
    </Link>
  );
}

function Summary({ children }: { children: React.ReactNode }) {
  return (
    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/40 [&::-webkit-details-marker]:hidden">
      {children}
    </summary>
  );
}

function ClassRow({ cls, assessments }: { cls: WorkspaceClass; assessments: WorkspaceAssessment[] }) {
  const bsb = assessments.filter((a) => a.type === "BSB").length;
  const chsb = assessments.length - bsb;
  return (
    <details className="group">
      <Summary>
        <span className="text-gray-400 transition-transform group-open:rotate-90">▸</span>
        <span className="font-semibold text-gray-900 dark:text-gray-100">{cls.name || "Nomsiz sinf"}</span>
        {cls.academicYear && <span className="text-xs text-gray-500 dark:text-gray-400">{cls.academicYear}</span>}
        <span className="ml-auto flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
          <Badge tone="blue">{formatNumber(cls.students.length)} o&apos;quvchi</Badge>
          <Badge tone="green">{formatNumber(bsb)} BSB</Badge>
          <Badge tone="amber">{formatNumber(chsb)} ChSB</Badge>
          <span>Yaratilgan: {formatDate(cls.createdAt)}</span>
        </span>
      </Summary>
      <div className="px-5 pb-4">
        {cls.students.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Sinfda o&apos;quvchi yo&apos;q.</p>
        ) : (
          <ol className="grid list-decimal grid-cols-1 gap-x-8 gap-y-1 pl-6 text-sm text-gray-700 sm:grid-cols-2 lg:grid-cols-3 dark:text-gray-200">
            {cls.students.map((s) => (
              <li key={s.id}>{s.name || "—"}</li>
            ))}
          </ol>
        )}
      </div>
    </details>
  );
}

function pct(value: number | null): string {
  return value === null ? "—" : `${value}%`;
}

function AssessmentRow({ assessment: a }: { assessment: WorkspaceAssessment }) {
  const isBsb = a.type === "BSB";
  return (
    <details className="group">
      <Summary>
        <span className="text-gray-400 transition-transform group-open:rotate-90">▸</span>
        <Badge tone={isBsb ? "green" : "amber"}>{a.type}</Badge>
        <span className="font-semibold text-gray-900 dark:text-gray-100">
          {a.number ? `${a.number}-${a.type}` : a.type} · {a.subject || "Fan ko'rsatilmagan"}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {a.className || "—"} sinf{a.date ? ` · ${a.date}` : ""}
        </span>
        <span className="ml-auto flex flex-wrap items-center gap-3 text-xs text-gray-600 dark:text-gray-300">
          <span>
            Kiritilgan: <b>{formatNumber(a.enteredCount)}</b> / {formatNumber(a.results.length)}
          </span>
          <span>
            O&apos;rtacha: <b>{pct(a.averagePercentage)}</b>
          </span>
          {a.maxScore !== null && <span>Maks: {formatNumber(a.maxScore)}</span>}
        </span>
      </Summary>
      <div className="pb-4">
        {a.results.length === 0 ? (
          <p className="px-5 text-sm text-gray-500 dark:text-gray-400">Natijalar yo&apos;q.</p>
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th>T/r</Th>
                <Th>F.I.Sh</Th>
                {isBsb &&
                  a.taskMaxScores.map((max, i) => (
                    <Th key={i} className="text-center">
                      {i + 1}-top.{max !== null ? ` (${max})` : ""}
                    </Th>
                  ))}
                <Th className="text-center">Jami</Th>
                <Th className="text-center">%</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {a.results.map((r, idx) => (
                <tr key={r.studentId}>
                  <Td className="text-gray-500">{idx + 1}</Td>
                  <Td className="text-gray-900 dark:text-gray-100">{r.studentName || "—"}</Td>
                  {isBsb &&
                    a.taskMaxScores.map((_, i) => (
                      <Td key={i} className="text-center tabular-nums text-gray-700 dark:text-gray-200">
                        {r.scores[i] ?? "—"}
                      </Td>
                    ))}
                  <Td className="text-center font-medium tabular-nums">{r.total ?? "—"}</Td>
                  <Td className="text-center font-medium tabular-nums">{pct(r.percentage)}</Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </div>
    </details>
  );
}
