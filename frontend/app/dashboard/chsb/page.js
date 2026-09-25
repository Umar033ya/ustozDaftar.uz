"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";

export default function ChSBList() {
  const [assessments, setAssessments] = useState([]);

  useEffect(() => {
    const assessmentsJson = localStorage.getItem("ustozdaftar_assessments");
    if (assessmentsJson) {
      const allAssessments = JSON.parse(assessmentsJson);
      const chsbAssessments = allAssessments.filter((a) => a.type === "ChSB");
      setAssessments(chsbAssessments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    }
  }, []);

  const handleDeleteAssessment = (id, e) => {
    e.stopPropagation();
    if (confirm("Ushbu ChSB baholash natijalarini o'chirmoqchimisiz?")) {
      const assessmentsJson = localStorage.getItem("ustozdaftar_assessments");
      if (assessmentsJson) {
        const allAssessments = JSON.parse(assessmentsJson);
        const updated = allAssessments.filter((a) => a.id !== id);
        localStorage.setItem("ustozdaftar_assessments", JSON.stringify(updated));
        setAssessments(updated.filter((a) => a.type === "ChSB"));
      }
    }
  };

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">ChSB Natijalari</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">Barcha ChSB baholash jadvallari va tarixi</p>
        </div>
        <Link
          href="/dashboard/chsb/create"
          className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2 text-sm sm:text-base transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Yangi ChSB
        </Link>
      </div>

      {/* Assessments List */}
      {assessments.length === 0 ? (
        <div className="bg-white rounded-xl shadow-xs p-8 sm:p-12 border border-gray-200 text-center">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">ChSB yo'q</h3>
          <p className="text-gray-600 mb-5 text-sm">Hali ChSB yaratmadingiz. Birinchi ChSBingizni yarating.</p>
          <Link
            href="/dashboard/chsb/create"
            className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 font-medium text-sm transition-colors inline-block"
          >
            ChSB yaratish
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    ChSB
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
                    O'quvchilar
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-center">
                    O'rtacha %
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-right">
                    Amallar
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {assessments.map((assessment) => {
                  const validResults = assessment.results.filter((r) => r.total !== "" && r.total > 0);
                  const avgPercentage = validResults.length > 0
                    ? (validResults.reduce((sum, r) => sum + r.percentage, 0) / validResults.length).toFixed(1)
                    : 0;

                  return (
                    <tr key={assessment.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3.5 whitespace-nowrap text-sm font-semibold text-gray-900">
                        ChSB {assessment.number}
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
                      <td className="px-4 py-3.5 whitespace-nowrap text-sm text-center text-gray-900">
                        {assessment.results.length}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-sm text-center font-bold text-gray-900">
                        {avgPercentage}%
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-sm text-right">
                        <div className="flex items-center justify-end gap-3">
                          <Link
                            href={`/dashboard/chsb/${assessment.id}`}
                            className="text-blue-600 hover:text-blue-800 font-semibold text-xs sm:text-sm transition-colors"
                          >
                            Ochish
                          </Link>
                          <button
                            onClick={(e) => handleDeleteAssessment(assessment.id, e)}
                            className="text-red-600 hover:text-red-800 font-semibold text-xs sm:text-sm transition-colors"
                          >
                            O'chirish
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
