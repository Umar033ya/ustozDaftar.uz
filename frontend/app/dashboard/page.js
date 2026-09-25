"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [classes, setClasses] = useState([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [bsbCount, setBsbCount] = useState(0);
  const [chsbCount, setChsbCount] = useState(0);

  useEffect(() => {
    const userJson = localStorage.getItem("ustozdaftar_user");
    if (userJson) {
      setUser(JSON.parse(userJson));
    }

    const classesJson = localStorage.getItem("ustozdaftar_classes");
    if (classesJson) {
      const loadedClasses = JSON.parse(classesJson);
      setClasses(loadedClasses);
      const total = loadedClasses.reduce((sum, cls) => sum + (cls.students?.length || 0), 0);
      setTotalStudents(total);
    }

    const assessmentsJson = localStorage.getItem("ustozdaftar_assessments");
    if (assessmentsJson) {
      const assessments = JSON.parse(assessmentsJson);
      setBsbCount(assessments.filter((a) => a.type === "BSB").length);
      setChsbCount(assessments.filter((a) => a.type === "ChSB").length);
    }
  }, []);

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout>
      {/* Welcome Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          Xush kelibsiz, {user.firstName} {user.lastName}!
        </h1>
        <p className="text-gray-600 mt-1 text-sm sm:text-base">
          UstozDaftar.uz boshqaruv paneliga xush kelibsiz
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <div className="bg-white rounded-xl shadow-xs p-5 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Sinflar soni</p>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">{classes.length}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-xs p-5 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">O'quvchilar soni</p>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">{totalStudents}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-xs p-5 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">BSB natijalari</p>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">{bsbCount}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-xs p-5 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">ChSB natijalari</p>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">{chsbCount}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Class Management CTA */}
      <div className="bg-white rounded-xl shadow-xs p-5 sm:p-6 border border-gray-200 mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Sinf boshqaruvi</h2>
            <p className="text-gray-600 mt-1 text-sm">Yangi sinf yarating va o'quvchilarni boshqaring</p>
          </div>
          <Link
            href="/dashboard/classes"
            className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2 text-sm sm:text-base transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Sinf yaratish
          </Link>
        </div>
      </div>

      {/* Recent Classes */}
      {classes.length > 0 && (
        <div>
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">So'nggi sinflar</h2>
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
                  {cls.students?.length || 0} o'quvchi
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
