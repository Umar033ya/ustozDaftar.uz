"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import LoadingState from "@/components/LoadingState";
import StudentPercentageChart from "@/components/StudentPercentageChart";
import TaskAverageChart from "@/components/TaskAverageChart";
import { useAuth } from "@/lib/authContext";
import { getWorkspace } from "@/lib/firestoreService";
import { isResultEntered, summarizeAssessment } from "@/lib/resultStats";
import { computeClassStats, filterOptions } from "@/lib/classStats";

const SELECT_CLASS =
  "block w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white";

const ICONS = {
  classes:
    "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
  students:
    "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
  doc: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
};

function OverviewCard({ label, value, icon, tone }) {
  const tones = { blue: "bg-blue-100 text-blue-600", green: "bg-green-100 text-green-600" };
  return (
    <div className="bg-white rounded-xl shadow-xs p-5 border border-gray-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs sm:text-sm font-medium text-gray-600">{label}</p>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center ${tones[tone]}`}>
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block min-w-0">
      <span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>
      {children}
    </label>
  );
}

export default function Statistics() {
  const { currentUser } = useAuth();
  const [workspace, setWorkspace] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [year, setYear] = useState("");
  const [classChoice, setClassChoice] = useState("");
  const [type, setType] = useState("");
  const [subject, setSubject] = useState("");
  const [assessmentId, setAssessmentId] = useState("");

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    getWorkspace(currentUser.uid)
      .then((data) => !cancelled && setWorkspace(data))
      .catch((err) => {
        console.error("Error loading statistics data:", err);
        if (!cancelled) setLoadError("Ma'lumotlarni yuklab bo'lmadi. Sahifani yangilang.");
      });
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  // Derived on every render; the React Compiler memoizes these.
  const classes = workspace?.classes ?? [];
  const assessments = workspace?.assessments ?? [];
  const years = [...new Set(classes.map((c) => c.academicYear).filter(Boolean))].sort().reverse();
  const visibleClasses = classes.filter((c) => !year || c.academicYear === year);

  // Default: the first class (of the chosen year) that has assessments, so a
  // chart is visible right away instead of an empty "choose a class" box.
  const selectedClass =
    visibleClasses.find((c) => c.id === classChoice) ||
    visibleClasses.find((c) => assessments.some((a) => a.classId === c.id)) ||
    visibleClasses[0] ||
    null;

  const classAssessments = selectedClass ? assessments.filter((a) => a.classId === selectedClass.id) : [];
  const options = filterOptions(classAssessments);
  const stats = selectedClass
    ? computeClassStats({
        assessments: classAssessments,
        students: workspace?.studentsByClass?.[selectedClass.id] ?? [],
        filters: { type, subject, assessmentId },
      })
    : null;
  const singleBsb = stats?.assessments.length === 1 && stats.assessments[0].type === "BSB" ? stats.assessments[0] : null;
  const singleBsbStats = singleBsb ? summarizeAssessment(singleBsb, singleBsb.results) : null;

  const changeClass = (id) => {
    setClassChoice(id);
    setType("");
    setSubject("");
    setAssessmentId("");
  };

  if (!workspace && !loadError) {
    return (
      <DashboardLayout>
        <LoadingState />
      </DashboardLayout>
    );
  }

  const totalStudents = classes.reduce((sum, cls) => sum + (cls.studentCount || 0), 0);
  const summary = stats?.summary;

  return (
    <DashboardLayout>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Statistika</h1>
        <p className="text-gray-600 mt-1 text-sm sm:text-base">Umumiy statistika va sinflar bo&apos;yicha tahlil</p>
      </div>

      {loadError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">{loadError}</div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <OverviewCard label="Sinflar" value={classes.length} icon={ICONS.classes} tone="blue" />
        <OverviewCard label="O'quvchilar" value={totalStudents} icon={ICONS.students} tone="green" />
        <OverviewCard label="BSB baholashlar" value={assessments.filter((a) => a.type === "BSB").length} icon={ICONS.doc} tone="blue" />
        <OverviewCard label="ChSB baholashlar" value={assessments.filter((a) => a.type === "ChSB").length} icon={ICONS.doc} tone="green" />
      </div>

      <div className="bg-white rounded-xl shadow-xs p-5 sm:p-6 border border-gray-200 mb-6 sm:mb-8 min-w-0">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">Sinf statistikasi</h2>

        {classes.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-600 mb-4">Statistika uchun avval sinf yarating va baholash natijalarini kiriting.</p>
            <Link href="/dashboard/classes" className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 font-medium text-sm">
              Sinflarga o&apos;tish
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
              <Field label="O'quv yili">
                <select value={year} onChange={(e) => { setYear(e.target.value); changeClass(""); }} className={SELECT_CLASS}>
                  <option value="">Barchasi</option>
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </Field>
              <Field label="Sinf">
                <select value={selectedClass?.id || ""} onChange={(e) => changeClass(e.target.value)} className={SELECT_CLASS}>
                  {visibleClasses.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} ({cls.academicYear})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Turi">
                <select value={type} onChange={(e) => { setType(e.target.value); setAssessmentId(""); }} className={SELECT_CLASS}>
                  <option value="">BSB va ChSB</option>
                  {options.types.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="Fan">
                <select value={subject} onChange={(e) => { setSubject(e.target.value); setAssessmentId(""); }} className={SELECT_CLASS}>
                  <option value="">Barcha fanlar</option>
                  {options.subjects.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="Baholash">
                <select value={assessmentId} onChange={(e) => setAssessmentId(e.target.value)} className={SELECT_CLASS}>
                  <option value="">Barchasi</option>
                  {classAssessments
                    .filter((a) => (!type || a.type === type) && (!subject || a.subject === subject))
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.type} {a.number} · {a.subject} ({a.date})
                      </option>
                    ))}
                </select>
              </Field>
            </div>

            {classAssessments.length === 0 ? (
              <p className="text-sm text-gray-600 py-6 text-center">
                Bu sinf uchun hali BSB yoki ChSB yaratilmagan. Baholash yarating va natijalarni kiriting — grafiklar shu yerda paydo bo&apos;ladi.
              </p>
            ) : (
              summary && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <p className="text-xs text-gray-500 font-medium">Baholashlar soni</p>
                      <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{summary.assessmentCount}</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <p className="text-xs text-blue-700 font-medium">O&apos;rtacha %</p>
                      <p className="text-xl sm:text-2xl font-bold text-blue-700 mt-1">
                        {summary.averagePercentage === null ? "—" : `${summary.averagePercentage}%`}
                      </p>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                      <p className="text-xs text-emerald-700 font-medium">A&apos;lo (80%+)</p>
                      <p className="text-xl sm:text-2xl font-bold text-emerald-700 mt-1">{summary.highPerformers}</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                      <p className="text-xs text-red-700 font-medium">Yaxshilash kerak (&lt;60%)</p>
                      <p className="text-xl sm:text-2xl font-bold text-red-700 mt-1">{summary.needsImprovement}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">
                    Natijasi bor o&apos;quvchilar: {summary.studentsWithResults} / {summary.studentCount} · kiritilgan natijalar: {summary.resultCount}
                  </p>

                  <div className="grid grid-cols-1 xl:grid-cols-2 items-start gap-4">
                    <StudentPercentageChart results={stats.studentRows} title="O'quvchilarning o'rtacha ko'rsatkichi (%)" />
                    {singleBsb ? (
                      <TaskAverageChart tasks={singleBsb.tasks} taskAverages={singleBsbStats?.taskAverages || []} />
                    ) : (
                      <StudentPercentageChart results={stats.assessmentRows} title="Baholashlar bo'yicha o'rtacha (%)" />
                    )}
                  </div>
                </>
              )
            )}
          </>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900">So&apos;nggi baholashlar</h2>
        </div>
        {assessments.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-gray-500 text-sm">Hali baholashlar mavjud emas</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["Turi", "Fan", "Sinf", "Sana"].map((h) => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">{h}</th>
                  ))}
                  <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-center">O&apos;rtacha %</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {assessments.slice(0, 10).map((assessment) => {
                  const valid = (assessment.results || []).filter((r) => isResultEntered(r, assessment.type));
                  const avg = valid.length
                    ? `${(valid.reduce((sum, r) => sum + (Number(r.percentage) || 0), 0) / valid.length).toFixed(1)}%`
                    : "—";
                  return (
                    <tr key={assessment.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3.5 whitespace-nowrap text-sm font-semibold text-gray-900">
                        <Link href={`/dashboard/${assessment.type === "BSB" ? "bsb" : "chsb"}/${assessment.id}`} className="hover:text-blue-600">
                          {assessment.type} {assessment.number}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-900">{assessment.subject}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-900">{assessment.className}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-600">{assessment.date}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-sm text-center font-bold text-gray-900">{avg}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
