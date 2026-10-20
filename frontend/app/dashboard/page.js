"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/lib/authContext";
import { getClasses, getAssessments } from "@/lib/firestoreService";
import { useTranslation } from "@/lib/useTranslation";

export default function Dashboard() {
  const { currentUser, userProfile } = useAuth();
  const { t } = useTranslation();
  const [classes, setClasses] = useState([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [bsbCount, setBsbCount] = useState(0);
  const [chsbCount, setChsbCount] = useState(0);

  useEffect(() => {
    if (!currentUser) return;

    async function loadDashboardData() {
      try {
        const [loadedClasses, loadedAssessments] = await Promise.all([
          getClasses(currentUser.uid),
          getAssessments(currentUser.uid),
        ]);

        setClasses(loadedClasses);
        setTotalStudents(loadedClasses.reduce((sum, cls) => sum + (cls.studentCount || 0), 0));
        setBsbCount(loadedAssessments.filter((a) => a.type === "BSB").length);
        setChsbCount(loadedAssessments.filter((a) => a.type === "ChSB").length);
      } catch (e) {
        console.error("Error loading dashboard data:", e);
      }
    }

    loadDashboardData();
  }, [currentUser]);

  const firstName = userProfile?.firstName || "";
  const lastName = userProfile?.lastName || "";

  const stats = [
    { key: "dashboard.stats.classes", value: classes.length, tone: "blue", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
    { key: "dashboard.stats.students", value: totalStudents, tone: "green", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
    { key: "dashboard.stats.bsb", value: bsbCount, tone: "blue", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
    { key: "dashboard.stats.chsb", value: chsbCount, tone: "green", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  ];

  return (
    <DashboardLayout>
      {/* Welcome header (plan badge lives in the sidebar profile block) */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          {t("dashboard.welcome")}
          {firstName ? `, ${firstName} ${lastName}` : ""}!
        </h1>
        <p className="text-gray-600 mt-1 text-sm sm:text-base">{t("dashboard.welcome.subtitle")}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
        {stats.map((stat) => (
          <div key={stat.key} className="bg-white rounded-xl shadow-xs p-5 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t(stat.key)}</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
              </div>
              <div
                className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  stat.tone === "blue" ? "bg-blue-100" : "bg-green-100"
                }`}
              >
                <svg
                  className={`w-6 h-6 ${stat.tone === "blue" ? "text-blue-600" : "text-green-600"}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={stat.icon} />
                </svg>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Class management */}
      <div className="bg-white rounded-xl shadow-xs p-5 sm:p-6 border border-gray-200 mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
              {t("dashboard.classManagement.title")}
            </h2>
            <p className="text-gray-600 mt-1 text-sm">{t("dashboard.classManagement.desc")}</p>
          </div>
          <Link
            href="/dashboard/classes"
            className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2 text-sm sm:text-base transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t("dashboard.createClass")}
          </Link>
        </div>
      </div>

      {/* Recent classes */}
      {classes.length > 0 && (
        <div>
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">{t("dashboard.recentClasses")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {classes.slice(0, 6).map((cls) => (
              <Link
                key={cls.id}
                href={`/dashboard/classes/${cls.id}`}
                className="bg-white rounded-xl shadow-xs p-5 border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all"
              >
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">{cls.name}</h3>
                <p className="text-gray-600 text-xs sm:text-sm mt-1">{cls.academicYear}</p>
                <p className="text-xs text-gray-500 mt-3 font-medium">
                  {cls.studentCount || 0} {t("dashboard.students.count")}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
