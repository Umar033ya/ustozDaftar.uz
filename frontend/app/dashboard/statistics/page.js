"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import StudentPercentageChart from "@/components/StudentPercentageChart";

export default function Statistics() {
  const [classes, setClasses] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");

  useEffect(() => {
    const classesJson = localStorage.getItem("ustozdaftar_classes");
    if (classesJson) {
      setClasses(JSON.parse(classesJson));
    }

    const assessmentsJson = localStorage.getItem("ustozdaftar_assessments");
    if (assessmentsJson) {
      setAssessments(JSON.parse(assessmentsJson));
    }
  }, []);

  const getClassStatistics = (classId) => {
    const classAssessments = assessments.filter((a) => a.classId === classId);
    const totalAssessments = classAssessments.length;
    
    if (totalAssessments === 0) {
      return {
        totalAssessments: 0,
        averagePercentage: 0,
        highPerformers: 0,
        needsImprovement: 0,
        classResults: [],
      };
    }

    const allPercentages = classAssessments.flatMap((a) =>
      a.results.map((r) => r.percentage)
    );
    const validPercentages = allPercentages.filter((p) => p > 0);

    const averagePercentage = validPercentages.length > 0
      ? (validPercentages.reduce((a, b) => a + b, 0) / validPercentages.length).toFixed(1)
      : 0;

    const highPerformers = validPercentages.filter((p) => p >= 80).length;
    const needsImprovement = validPercentages.filter((p) => p < 60).length;

    // Build aggregated per-student average for selected class
    const foundClass = classes.find((c) => c.id === classId);
    const classResults = (foundClass?.students || []).map((student) => {
      const studentScores = classAssessments.flatMap((a) =>
        a.results.filter((r) => r.studentId === student.id).map((r) => r.percentage)
      ).filter((p) => p > 0);

      const avgPct = studentScores.length > 0
        ? studentScores.reduce((a, b) => a + b, 0) / studentScores.length
        : 0;

      return {
        studentName: student.name,
        percentage: avgPct,
        total: studentScores.length,
      };
    });

    return {
      totalAssessments,
      averagePercentage,
      highPerformers,
      needsImprovement,
      classResults,
    };
  };

  const overallStats = {
    totalClasses: classes.length,
    totalAssessments: assessments.length,
    totalStudents: classes.reduce((sum, cls) => sum + (cls.students?.length || 0), 0),
    bsbCount: assessments.filter((a) => a.type === "BSB").length,
    chsbCount: assessments.filter((a) => a.type === "ChSB").length,
  };

  const selectedClassStats = selectedClass ? getClassStatistics(selectedClass) : null;

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Statistika</h1>
        <p className="text-gray-600 mt-1 text-sm sm:text-base">Umumiy statistika va sinflar bo'yicha tahlil</p>
      </div>

      {/* Overall Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <div className="bg-white rounded-xl shadow-xs p-5 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-600">Sinflar</p>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">{overallStats.totalClasses}</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-xs p-5 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-600">O'quvchilar</p>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">{overallStats.totalStudents}</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-xs p-5 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-600">BSB baholashlar</p>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">{overallStats.bsbCount}</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-xs p-5 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-600">ChSB baholashlar</p>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">{overallStats.chsbCount}</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Class Selection & Detailed Stats */}
      <div className="bg-white rounded-xl shadow-xs p-5 sm:p-6 border border-gray-200 mb-6 sm:mb-8">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3">Sinf statistikasi</h2>
        <div className="max-w-md">
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="block w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            <option value="">Sinfni tanlang</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name} ({cls.academicYear})
              </option>
            ))}
          </select>
        </div>

        {selectedClassStats && (
          <div className="mt-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-xs text-gray-500 font-medium">Baholashlar soni</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{selectedClassStats.totalAssessments}</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <p className="text-xs text-blue-700 font-medium">O'rtacha %</p>
                <p className="text-xl sm:text-2xl font-bold text-blue-700 mt-1">{selectedClassStats.averagePercentage}%</p>
              </div>
              <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                <p className="text-xs text-emerald-700 font-medium">A'lo (80%+)</p>
                <p className="text-xl sm:text-2xl font-bold text-emerald-700 mt-1">{selectedClassStats.highPerformers}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                <p className="text-xs text-red-700 font-medium">Yaxshilash kerak (&lt;60%)</p>
                <p className="text-xl sm:text-2xl font-bold text-red-700 mt-1">{selectedClassStats.needsImprovement}</p>
              </div>
            </div>

            {selectedClassStats.classResults && selectedClassStats.classResults.length > 0 && (
              <StudentPercentageChart
                results={selectedClassStats.classResults}
                title="Sinf o'quvchilarining umumiy o'rtacha ko'rsatkichi (%)"
              />
            )}
          </div>
        )}
      </div>

      {/* Recent Assessments Table */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900">So'nggi baholashlar</h2>
        </div>
        {assessments.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-gray-500 text-sm">
            Hali baholashlar mavjud emas
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Turi
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Fan
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Sinf
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Sana
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-center">
                    O'rtacha %
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {assessments.slice(0, 10).map((assessment) => {
                  const validResults = assessment.results.filter((r) => r.percentage > 0 || r.total > 0);
                  const avgPercentage = validResults.length > 0
                    ? (validResults.reduce((sum, r) => sum + r.percentage, 0) / validResults.length).toFixed(1)
                    : 0;
                  return (
                    <tr key={assessment.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3.5 whitespace-nowrap text-sm font-semibold text-gray-900">
                        {assessment.type} {assessment.number}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-900">
                        {assessment.subject}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-900">
                        {assessment.className}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-600">
                        {assessment.date}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-sm text-center font-bold text-gray-900">
                        {avgPercentage}%
                      </td>
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
