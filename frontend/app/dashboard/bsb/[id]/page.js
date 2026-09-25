"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import StudentPercentageChart from "@/components/StudentPercentageChart";
import TaskAverageChart from "@/components/TaskAverageChart";
import { exportBSBToExcel } from "@/lib/excelExport";

export default function BSBResult() {
  const router = useRouter();
  const params = useParams();
  const assessmentId = params.id;
  
  const [assessment, setAssessment] = useState(null);
  const [results, setResults] = useState([]);
  const [saving, setSaving] = useState(false);
  const [schoolName, setSchoolName] = useState("");

  useEffect(() => {
    const schoolNameJson = localStorage.getItem("ustozdaftar_school_name");
    if (schoolNameJson) {
      setSchoolName(schoolNameJson);
    }

    const assessmentsJson = localStorage.getItem("ustozdaftar_assessments");
    if (assessmentsJson) {
      const assessments = JSON.parse(assessmentsJson);
      const foundAssessment = assessments.find((a) => a.id === assessmentId);
      if (foundAssessment) {
        setAssessment(foundAssessment);
        setResults(foundAssessment.results || []);
      } else {
        router.push("/dashboard/bsb");
      }
    }
  }, [assessmentId, router]);

  const handleScoreChange = (studentIndex, taskIndex, value) => {
    const newResults = [...results];
    const taskMaxScore = assessment.tasks[taskIndex].maxScore;
    const score = value === "" ? "" : parseInt(value, 10);
    
    // Validate score bound
    if (value !== "" && (isNaN(score) || score < 0 || score > taskMaxScore)) {
      return;
    }

    newResults[studentIndex].scores[taskIndex] = score;
    
    // Calculate total and percentage
    const total = newResults[studentIndex].scores.reduce((sum, s) => sum + (s === "" || isNaN(s) ? 0 : s), 0);
    newResults[studentIndex].total = total;
    newResults[studentIndex].percentage = assessment.maxTotal > 0 ? (total / assessment.maxTotal) * 100 : 0;
    
    setResults(newResults);
    saveResults(newResults);
  };

  const saveResults = (newResults) => {
    setSaving(true);
    const assessmentsJson = localStorage.getItem("ustozdaftar_assessments");
    if (assessmentsJson) {
      const assessments = JSON.parse(assessmentsJson);
      const updatedAssessments = assessments.map((a) =>
        a.id === assessmentId ? { ...a, results: newResults } : a
      );
      localStorage.setItem("ustozdaftar_assessments", JSON.stringify(updatedAssessments));
      setAssessment((prev) => (prev ? { ...prev, results: newResults } : null));
    }
    setTimeout(() => setSaving(false), 400);
  };

  const handleExport = () => {
    exportBSBToExcel(assessment, results, stats, schoolName);
  };

  const handlePrint = () => {
    window.print();
  };

  const calculateStatistics = () => {
    if (!results || results.length === 0) return null;
    
    const validResults = results.filter((r) => r.total > 0 || r.scores.some((s) => s !== "" && s > 0));
    const totals = (validResults.length > 0 ? validResults : results).map((r) => r.total || 0);
    const percentages = (validResults.length > 0 ? validResults : results).map((r) => r.percentage || 0);

    const activeList = validResults.length > 0 ? validResults : results;

    // Calculate task averages
    const taskAverages = assessment.tasks.map((task, taskIndex) => {
      const taskScores = activeList
        .map((r) => r.scores[taskIndex])
        .filter((s) => s !== "" && s !== undefined && !isNaN(s));

      if (taskScores.length === 0) return "0.0";
      const avgScore = taskScores.reduce((a, b) => a + b, 0) / taskScores.length;
      return ((avgScore / task.maxScore) * 100).toFixed(1);
    });

    const avgScore = (totals.reduce((a, b) => a + b, 0) / totals.length).toFixed(1);
    const avgPct = (percentages.reduce((a, b) => a + b, 0) / percentages.length).toFixed(1);

    return {
      maxTotal: assessment.maxTotal,
      studentCount: results.length,
      completedCount: validResults.length,
      averageScore: avgScore,
      averagePercentage: avgPct,
      highestScore: totals.length > 0 ? Math.max(...totals) : 0,
      lowestScore: totals.length > 0 ? Math.min(...totals) : 0,
      taskAverages,
    };
  };

  const stats = calculateStatistics();

  if (!assessment) {
    return null;
  }

  return (
    <DashboardLayout>
      {/* Top Controls & Navigation */}
      <div className="mb-4 sm:mb-6 print:hidden">
        <Link href="/dashboard/bsb" className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-2 inline-block">
          ← BSB ro'yxatiga qaytish
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
              className="bg-emerald-600 text-white px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg hover:bg-emerald-700 font-medium text-xs sm:text-sm flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Excelga yuklash
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
      </div>

      {/* Official Result Document Wrapper */}
      <div className="bg-white border border-gray-300 shadow-sm rounded-lg mb-6 p-4 sm:p-6 print:border-none print:shadow-none print:p-0 print:mb-0">
        
        {/* Official School Title Header */}
        <div className="mb-4 sm:mb-6 text-center border-b-2 border-gray-900 pb-3">
          <h2 className="text-base sm:text-lg md:text-xl font-extrabold text-gray-900 tracking-tight leading-snug">
            {schoolName || "Maktab"}ning {assessment.className}-sinf o'quvchilarining {assessment.subject} fanidan {assessment.academicYear}-o'quv yili {assessment.number}-BSB natijalari ({assessment.date})
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
              <p className="text-xs text-gray-500 font-medium">O'quvchilar</p>
              <p className="text-lg font-bold text-gray-900 mt-0.5">{stats.studentCount}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="text-xs text-gray-500 font-medium">O'rtacha ball</p>
              <p className="text-lg font-bold text-gray-900 mt-0.5">{stats.averageScore}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="text-xs text-gray-500 font-medium">O'rtacha %</p>
              <p className="text-lg font-bold text-gray-900 mt-0.5">{stats.averagePercentage}%</p>
            </div>
            <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
              <p className="text-xs text-emerald-700 font-medium">Eng yuqori</p>
              <p className="text-lg font-bold text-emerald-700 mt-0.5">{stats.highestScore}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3 border border-red-200">
              <p className="text-xs text-red-700 font-medium">Eng past</p>
              <p className="text-lg font-bold text-red-700 mt-0.5">{stats.lowestScore}</p>
            </div>
          </div>
        )}

        {/* Charts Section (Hidden in Print) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 print:hidden mb-6">
          <StudentPercentageChart results={results} title="O'quvchilar BSB ko'rsatkichi (%)" />
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
                <th className="px-3 py-2 border border-gray-300 text-left min-w-[160px] sm:min-w-[200px]">
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

              {/* Dynamic Student Rows (EXACTLY N students, no blank rows!) */}
              {results.map((result, studentIndex) => (
                <tr key={result.studentId} className="hover:bg-gray-50/80 transition-colors">
                  <td className="px-3 py-2 border border-gray-300 text-center font-medium text-gray-700">
                    {studentIndex + 1}
                  </td>
                  <td className="px-3 py-2 border border-gray-300 font-semibold text-gray-900 whitespace-nowrap">
                    {result.studentName}
                  </td>
                  {assessment.tasks.map((task, taskIndex) => (
                    <td key={taskIndex} className="p-1 border border-gray-300 text-center">
                      <input
                        type="number"
                        min="0"
                        max={task.maxScore}
                        value={result.scores[taskIndex] === "" || result.scores[taskIndex] === undefined ? "" : result.scores[taskIndex]}
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
                        className="w-12 sm:w-14 h-8 px-1 text-center font-semibold border border-gray-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
                        placeholder="0"
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2 border border-gray-300 text-center font-bold text-gray-900 bg-gray-50">
                    {result.total || 0}
                  </td>
                  <td className="px-3 py-2 border border-gray-300 text-center font-bold text-gray-900 bg-gray-50">
                    {(result.percentage || 0).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>

            {/* Summary / Task Averages Footer */}
            {stats && (
              <tfoot className="bg-gray-100 font-bold border-t-2 border-gray-400 text-gray-900">
                <tr>
                  <td colSpan={2} className="px-3 py-2.5 border border-gray-300 text-center text-xs sm:text-sm font-extrabold uppercase">
                    O'rtacha ko'rsatkich (%)
                  </td>
                  {stats.taskAverages.map((avg, idx) => (
                    <td key={idx} className="px-2 py-2.5 border border-gray-300 text-center font-extrabold text-blue-700">
                      {avg}%
                    </td>
                  ))}
                  <td className="px-3 py-2.5 border border-gray-300 text-center font-extrabold text-gray-900 bg-gray-200">
                    {stats.averageScore}
                  </td>
                  <td className="px-3 py-2.5 border border-gray-300 text-center font-extrabold text-blue-800 bg-gray-200">
                    {stats.averagePercentage}%
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {saving && (
        <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg text-xs font-semibold z-50 print:hidden">
          Saqlanmoqda...
        </div>
      )}
    </DashboardLayout>
  );
}
