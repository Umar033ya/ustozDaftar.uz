"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import LoadingState from "@/components/LoadingState";
import StudentPercentageChart from "@/components/StudentPercentageChart";
import TaskAverageChart from "@/components/TaskAverageChart";
import { exportBSBToExcel } from "@/lib/excelExport";
import { isResultEntered, summarizeAssessment } from "@/lib/resultStats";
import SaveStatus from "@/components/SaveStatus";
import { useAuth } from "@/lib/authContext";
import {
  getAssessmentById,
  getResults,
  getStudents,
  reconcileResultsWithStudents,
  updateResult,
  getUserProfile,
} from "@/lib/firestoreService";

export default function BSBResult() {
  const router = useRouter();
  const params = useParams();
  const assessmentId = params.id;
  const { currentUser } = useAuth();
  
  const [assessment, setAssessment] = useState(null);
  const [results, setResults] = useState([]);
  const [saving, setSaving] = useState(false);
  const [schoolName, setSchoolName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const saveTimers = useRef({});
  const pendingSaves = useRef({});
  const failedSaves = useRef(new Set());

  useEffect(() => {
    if (!currentUser || !assessmentId) return;

    async function loadData() {
      try {
        const [loadedAssessment, profile, loadedResults] = await Promise.all([
          getAssessmentById(currentUser.uid, assessmentId),
          getUserProfile(currentUser.uid),
          getResults(currentUser.uid, assessmentId),
        ]);

        if (loadedAssessment) {
          setAssessment(loadedAssessment);
          setSchoolName(profile?.schoolName || "");

          // One row per student of the class, no more, no less
          let students = [];
          if (loadedAssessment.classId) {
            students = await getStudents(currentUser.uid, loadedAssessment.classId);
          }
          const reconciled = await reconcileResultsWithStudents(
            currentUser.uid,
            loadedAssessment,
            students,
            loadedResults
          );
          setResults(reconciled);
        } else {
          router.push("/dashboard/bsb");
        }
      } catch (err) {
        console.error("Error loading BSB assessment:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [currentUser, assessmentId, router]);

  const flushSave = useCallback(
    async (studentId) => {
      const pending = pendingSaves.current[studentId];
      if (!pending) return;
      delete pendingSaves.current[studentId];
      try {
        await updateResult(currentUser.uid, assessmentId, studentId, pending);
        failedSaves.current.delete(studentId);
      } catch (e) {
        console.error("Error updating result:", e?.code || e);
        // Keep the unsaved scores (unless newer ones are already queued) so a retry can send them.
        if (!pendingSaves.current[studentId]) pendingSaves.current[studentId] = pending;
        failedSaves.current.add(studentId);
      } finally {
        setSaveError(failedSaves.current.size > 0);
        setSaving(false);
      }
    },
    [currentUser, assessmentId]
  );

  const debouncedSave = useCallback(
    (studentId, updatedData) => {
      pendingSaves.current[studentId] = updatedData;
      if (saveTimers.current[studentId]) {
        clearTimeout(saveTimers.current[studentId]);
      }
      setSaving(true);
      saveTimers.current[studentId] = setTimeout(() => {
        delete saveTimers.current[studentId];
        flushSave(studentId);
      }, 600);
    },
    [flushSave]
  );

  // Never lose the last edits: flush pending scores on navigation, tab switch or reload
  useEffect(() => {
    const flushAll = () => {
      Object.keys(saveTimers.current).forEach((studentId) => {
        clearTimeout(saveTimers.current[studentId]);
        delete saveTimers.current[studentId];
      });
      const pendingIds = Object.keys(pendingSaves.current);
      pendingIds.forEach((studentId) => {
        const data = pendingSaves.current[studentId];
        delete pendingSaves.current[studentId];
        updateResult(currentUser.uid, assessmentId, studentId, data).catch((e) =>
          console.error("Error updating result:", e)
        );
      });
    };

    window.addEventListener("pagehide", flushAll);
    document.addEventListener("visibilitychange", flushAll);
    return () => {
      window.removeEventListener("pagehide", flushAll);
      document.removeEventListener("visibilitychange", flushAll);
      flushAll();
    };
  }, [currentUser, assessmentId]);

  const handleScoreChange = (studentIndex, taskIndex, value) => {
    const newResults = [...results];
    const taskMaxScore = assessment.tasks[taskIndex].maxScore;
    const score = value === "" ? "" : parseInt(value, 10);
    
    // Validate score bound
    if (value !== "" && (isNaN(score) || score < 0 || score > taskMaxScore)) {
      return;
    }

    const updatedResult = { ...newResults[studentIndex] };
    updatedResult.scores = [...(updatedResult.scores || [])];
    updatedResult.scores[taskIndex] = score;
    
    // Calculate total and percentage
    const total = updatedResult.scores.reduce((sum, s) => sum + (s === "" || isNaN(s) ? 0 : s), 0);
    updatedResult.total = total;
    updatedResult.percentage = assessment.maxTotal > 0 ? (total / assessment.maxTotal) * 100 : 0;
    
    newResults[studentIndex] = updatedResult;
    setResults(newResults);

    debouncedSave(updatedResult.id || updatedResult.studentId, {
      scores: updatedResult.scores,
      total: updatedResult.total,
      percentage: updatedResult.percentage,
    });
  };

  const retryFailedSaves = () => {
    setSaving(true);
    [...failedSaves.current].forEach((studentId) => flushSave(studentId));
  };

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    setExportError("");
    try {
      await exportBSBToExcel(assessment, results, stats, schoolName);
    } catch (e) {
      console.error("Excel export failed:", e);
      setExportError("Excel faylini yaratib bo'lmadi. Sahifani yangilab, qayta urinib ko'ring.");
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Only entered results count; a real 0 is a result, an empty cell is not.
  const stats = summarizeAssessment(assessment, results);

  if (loading) {
    return (
      <DashboardLayout>
        <LoadingState />
      </DashboardLayout>
    );
  }

  if (!assessment) {
    return null;
  }

  return (
    <DashboardLayout>
      {/* Top Controls & Navigation */}
      <div className="mb-4 sm:mb-6 print:hidden">
        <Link href="/dashboard/bsb" className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-2 inline-block">
          ← BSB ro&apos;yxatiga qaytish
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              BSB {assessment.number} - {assessment.subject}
            </h1>
            <p className="text-gray-600 mt-0.5 text-xs sm:text-sm">
              {assessment.className} ({assessment.academicYear}) • {assessment.date}
            </p>
          </div>
          <div className="flex gap-2 sm:gap-3">
            <button
              onClick={handleExport}
              disabled={exporting}
              aria-busy={exporting}
              className="bg-emerald-600 text-white px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg hover:bg-emerald-700 font-medium text-xs sm:text-sm flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-70 disabled:cursor-wait"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {exporting ? "Tayyorlanmoqda..." : "Excelga yuklash"}
            </button>
            <button
              onClick={handlePrint}
              className="bg-blue-600 text-white px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg hover:bg-blue-700 font-medium text-xs sm:text-sm flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Chop etish (A4)
            </button>
          </div>
        </div>
        {exportError && (
          <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
            {exportError}
          </p>
        )}
      </div>

      {/* Official Result Document Wrapper */}
      <div className="bg-white border border-gray-300 shadow-sm rounded-lg mb-6 p-4 sm:p-6 print:border-none print:shadow-none print:p-0 print:mb-0">
        
        {/* Official School Title Header */}
        <div className="mb-4 sm:mb-6 text-center border-b-2 border-gray-900 pb-3">
          <h2 className="text-base sm:text-lg md:text-xl font-extrabold text-gray-900 tracking-tight leading-snug">
            {schoolName || "Maktab"}ning {assessment.className}-sinf o&apos;quvchilarining {assessment.subject} fanidan {assessment.academicYear}-o&apos;quv yili {assessment.number}-BSB natijalari ({assessment.date})
          </h2>
        </div>

        {/* Quick Stats Grid (Hidden in Print) */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-6 print:hidden">
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="text-xs text-gray-500 font-medium">Maksimal ball</p>
              <p className="text-lg font-bold text-gray-900 mt-0.5">{stats.maxTotal}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="text-xs text-gray-500 font-medium">O&apos;quvchilar</p>
              <p className="text-lg font-bold text-gray-900 mt-0.5">
                {stats.studentCount}
                {stats.completedCount < stats.studentCount && (
                  <span className="ml-1 text-xs font-medium text-amber-700">({stats.completedCount} kiritilgan)</span>
                )}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="text-xs text-gray-500 font-medium">O&apos;rtacha ball</p>
              <p className="text-lg font-bold text-gray-900 mt-0.5">{stats.averageScore ?? "—"}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="text-xs text-gray-500 font-medium">O&apos;rtacha %</p>
              <p className="text-lg font-bold text-gray-900 mt-0.5">{stats.averagePercentage === null ? "—" : `${stats.averagePercentage}%`}</p>
            </div>
            <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
              <p className="text-xs text-emerald-700 font-medium">Eng yuqori</p>
              <p className="text-lg font-bold text-emerald-700 mt-0.5">{stats.highestScore ?? "—"}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3 border border-red-200">
              <p className="text-xs text-red-700 font-medium">Eng past</p>
              <p className="text-lg font-bold text-red-700 mt-0.5">{stats.lowestScore ?? "—"}</p>
            </div>
          </div>
        )}

        {/* Charts Section (Hidden in Print) */}
        <div className="grid grid-cols-1 xl:grid-cols-2 items-start gap-4 print:hidden mb-6">
          <StudentPercentageChart results={results} type="BSB" title="O'quvchilar BSB ko'rsatkichi (%)" />
          {stats && <TaskAverageChart tasks={assessment.tasks} taskAverages={stats.taskAverages} />}
        </div>

        {/* Official Printable Result Table */}
        <div className="overflow-x-auto rounded-lg border border-gray-300">
          <table className="w-full border-collapse text-xs sm:text-sm">
            <thead className="bg-gray-100 text-gray-900 font-bold border-b-2 border-gray-400">
              <tr>
                <th className="px-3 py-2 border border-gray-300 text-center w-12">
                  T/r
                </th>
                <th className="px-3 py-2 border border-gray-300 text-left min-w-[160px] sm:min-w-[200px] sticky left-0 z-10 bg-gray-100 print:static">
                  F.I.Sh
                </th>
                {assessment.tasks.map((task) => (
                  <th key={task.number} className="px-2 py-2 border border-gray-300 text-center min-w-[60px]">
                    {task.number}-t
                  </th>
                ))}
                <th className="px-3 py-2 border border-gray-300 text-center w-16 bg-gray-200">
                  Jami
                </th>
                <th className="px-3 py-2 border border-gray-300 text-center w-16 bg-gray-200">
                  %
                </th>
              </tr>
            </thead>

            <tbody>
              {/* Maximum Scores Row */}
              <tr className="bg-blue-50/70 font-bold text-gray-900">
                <td className="px-3 py-2 border border-gray-300 text-center text-xs text-blue-900">
                  Maks
                </td>
                <td className="px-3 py-2 border border-gray-300 text-center text-xs text-blue-900">
                  -
                </td>
                {assessment.tasks.map((task) => (
                  <td key={task.number} className="px-2 py-2 border border-gray-300 text-center text-blue-900 font-extrabold">
                    {task.maxScore}
                  </td>
                ))}
                <td className="px-3 py-2 border border-gray-300 text-center font-extrabold text-blue-900 bg-blue-100/50">
                  {assessment.maxTotal}
                </td>
                <td className="px-3 py-2 border border-gray-300 text-center font-extrabold text-blue-900 bg-blue-100/50">
                  100%
                </td>
              </tr>

              {/* Dynamic Student Rows */}
              {results.map((result, studentIndex) => (
                <tr key={result.studentId} className="hover:bg-gray-50/80 transition-colors">
                  <td className="px-3 py-2 border border-gray-300 text-center font-medium text-gray-700">
                    {studentIndex + 1}
                  </td>
                  <td className="px-3 py-2 border border-gray-300 font-semibold text-gray-900 whitespace-nowrap sticky left-0 z-[1] bg-white print:static">
                    {result.studentName}
                  </td>
                  {assessment.tasks.map((task, taskIndex) => (
                    <td key={taskIndex} className="p-1 border border-gray-300 text-center">
                      <input
                        type="number"
                        min="0"
                        max={task.maxScore}
                        value={(result.scores && result.scores[taskIndex] !== undefined && result.scores[taskIndex] !== "") ? result.scores[taskIndex] : ""}
                        onChange={(e) => handleScoreChange(studentIndex, taskIndex, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const inputs = Array.from(document.querySelectorAll("table input[type='number']"));
                            const currentIndex = inputs.indexOf(e.target);
                            if (currentIndex >= 0 && inputs[currentIndex + 1]) {
                              inputs[currentIndex + 1].focus();
                            }
                          }
                        }}
                        className="w-12 sm:w-14 h-8 px-1 text-center font-semibold border border-gray-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white placeholder:text-gray-300"
                        placeholder="–"
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2 border border-gray-300 text-center font-bold text-gray-900 bg-gray-50">
                    {isResultEntered(result, "BSB") ? Number(result.total) || 0 : "—"}
                  </td>
                  <td className="px-3 py-2 border border-gray-300 text-center font-bold text-gray-900 bg-gray-50">
                    {isResultEntered(result, "BSB") ? `${(Number(result.percentage) || 0).toFixed(1)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>

            {/* Summary / Task Averages Footer */}
            {stats && (
              <tfoot className="bg-gray-100 font-bold border-t-2 border-gray-400 text-gray-900">
                <tr>
                  <td colSpan={2} className="px-3 py-2.5 border border-gray-300 text-center text-xs sm:text-sm font-extrabold uppercase">
                    O&apos;rtacha ko&apos;rsatkich (%)
                  </td>
                  {stats.taskAverages.map((avg, idx) => (
                    <td key={idx} className="px-2 py-2.5 border border-gray-300 text-center font-extrabold text-blue-700">
                      {avg === null ? "—" : `${avg}%`}
                    </td>
                  ))}
                  <td className="px-3 py-2.5 border border-gray-300 text-center font-extrabold text-gray-900 bg-gray-200">
                    {stats.averageScore ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 border border-gray-300 text-center font-extrabold text-blue-800 bg-gray-200">
                    {stats.averagePercentage === null ? "—" : `${stats.averagePercentage}%`}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <SaveStatus saving={saving} saveError={saveError} onRetry={retryFailedSaves} />
    </DashboardLayout>
  );
}
