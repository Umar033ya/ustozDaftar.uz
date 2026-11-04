"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import LoadingState from "@/components/LoadingState";
import AssessmentFilters, { filterAssessments } from "@/components/AssessmentFilters";
import AssessmentCards from "@/components/AssessmentCards";
import { useAuth } from "@/lib/authContext";
import { deleteChsbReport, getChsbReports, getClasses } from "@/lib/firestoreService";
import { summarizeChsbReport } from "@/lib/chsbReport";

export default function ChsbReportList() {
  const { currentUser } = useAuth();
  const [reports, setReports] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState("");

  useEffect(() => {
    if (!currentUser) return;
    Promise.all([getChsbReports(currentUser.uid), getClasses(currentUser.uid).catch(() => [])])
      .then(([loadedReports, loadedClasses]) => {
        setClasses(loadedClasses);
        setReports(
          loadedReports.map((report) => {
            const summary = summarizeChsbReport(report, report.students);
            return {
              ...report,
              studentCount: summary.studentCount,
              avgPercentage: summary.averagePercentage ?? 0,
            };
          })
        );
      })
      .catch((err) => {
        console.error("Error loading ChSB reports:", err);
        setLoadError("Hisobotlarni yuklab bo'lmadi. Sahifani yangilab ko'ring.");
      })
      .finally(() => setLoading(false));
  }, [currentUser]);

  const visibleReports = useMemo(
    () => filterAssessments(reports, { search, classId, className: classes.find((c) => c.id === classId)?.name }),
    [reports, search, classId, classes]
  );

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!confirm("Ushbu ChSB hisobotini o'chirmoqchimisiz?")) return;
    try {
      await deleteChsbReport(currentUser.uid, id);
      setReports(reports.filter((report) => report.id !== id));
    } catch (err) {
      console.error("Error deleting ChSB report:", err);
      alert("Hisobotni o'chirishda xatolik yuz berdi");
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">ChSB hisoboti</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">Har bir savol bo&apos;yicha o&apos;quvchilar natijasi</p>
        </div>
        <Link
          href="/dashboard/chsb-reports/create"
          className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2 text-sm sm:text-base transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Yangi hisobot
        </Link>
      </div>

      {loading ? (
        <LoadingState />
      ) : loadError ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</p>
      ) : reports.length === 0 ? (
        <div className="bg-white rounded-xl shadow-xs p-8 sm:p-12 border border-gray-200 text-center">
          <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Hisobot yo&apos;q</h3>
          <p className="text-gray-600 mb-5 text-sm">Birinchi ChSB hisobotingizni yarating.</p>
          <Link
            href="/dashboard/chsb-reports/create"
            className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 font-medium text-sm transition-colors inline-block"
          >
            Hisobot yaratish
          </Link>
        </div>
      ) : (
        <>
          <AssessmentFilters
            search={search}
            onSearchChange={setSearch}
            classId={classId}
            onClassChange={setClassId}
            classes={classes}
          />
          <AssessmentCards
            assessments={visibleReports}
            label="ChSB"
            basePath="/dashboard/chsb-reports"
            onDelete={handleDelete}
          />
          <div className="hidden md:block bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {["ChSB", "Fan", "Sinf", "Sana"].map((label) => (
                      <th key={label} className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">{label}</th>
                    ))}
                    <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-center">Savollar</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-center">O&apos;quvchilar</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-center">O&apos;rtacha %</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-right">Amallar</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {visibleReports.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">Hech narsa topilmadi</td>
                    </tr>
                  )}
                  {visibleReports.map((report) => (
                    <tr key={report.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3.5 whitespace-nowrap text-sm font-semibold text-gray-900">ChSB {report.number}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-900">{report.subject}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-900">{report.className}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-600">{report.date}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-sm text-center text-gray-900">{report.questions.length}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-sm text-center text-gray-900">{report.studentCount}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-sm text-center font-bold text-gray-900">{report.avgPercentage}%</td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-sm text-right">
                        <div className="flex items-center justify-end gap-3">
                          <Link href={`/dashboard/chsb-reports/${report.id}`} className="text-blue-600 hover:text-blue-800 font-semibold text-xs sm:text-sm transition-colors">
                            Ochish
                          </Link>
                          <button onClick={(e) => handleDelete(report.id, e)} className="text-red-600 hover:text-red-800 font-semibold text-xs sm:text-sm transition-colors">
                            O&apos;chirish
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
