"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";

export default function Classes() {
  const [classes, setClasses] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    academicYear: "",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    const classesJson = localStorage.getItem("ustozdaftar_classes");
    if (classesJson) {
      setClasses(JSON.parse(classesJson));
    }
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleCreateClass = (e) => {
    e.preventDefault();
    setError("");

    if (!formData.name.trim() || !formData.academicYear.trim()) {
      setError("Barcha maydonlarni to'ldiring");
      return;
    }

    // Check for duplicate class name
    const exists = classes.some(
      (c) => c.name.toLowerCase() === formData.name.trim().toLowerCase()
    );
    if (exists) {
      setError("Bunday nomli sinf allaqachon mavjud");
      return;
    }

    const newClass = {
      id: Date.now().toString(),
      name: formData.name.trim(),
      academicYear: formData.academicYear.trim(),
      students: [],
      bsbResults: [],
      chsbResults: [],
      createdAt: new Date().toISOString(),
    };

    const updatedClasses = [...classes, newClass];
    setClasses(updatedClasses);
    localStorage.setItem("ustozdaftar_classes", JSON.stringify(updatedClasses));

    setFormData({ name: "", academicYear: "" });
    setShowCreateForm(false);
  };

  const handleDeleteClass = (classId) => {
    if (confirm("Sinfni o'chirmoqchimisiz? Tizimdagi tegishli o'quvchi ma'lumotlari ham tozalanadi.")) {
      const updatedClasses = classes.filter((cls) => cls.id !== classId);
      setClasses(updatedClasses);
      localStorage.setItem("ustozdaftar_classes", JSON.stringify(updatedClasses));
    }
  };

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Sinflar</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">Sinflaringizni va o'quvchilar ro'yxatini boshqaring</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2 text-sm sm:text-base transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Sinf yaratish
        </button>
      </div>

      {/* Create Class Form */}
      {showCreateForm && (
        <div className="bg-white rounded-xl shadow-xs p-5 sm:p-6 border border-gray-200 mb-6 sm:mb-8">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">Yangi sinf yaratish</h2>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleCreateClass}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Sinf nomi
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="block w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Masalan: 10-A"
                />
              </div>
              <div>
                <label htmlFor="academicYear" className="block text-sm font-medium text-gray-700 mb-1">
                  O'quv yili
                </label>
                <input
                  id="academicYear"
                  name="academicYear"
                  type="text"
                  required
                  value={formData.academicYear}
                  onChange={handleChange}
                  className="block w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Masalan: 2025-2026"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                type="submit"
                className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 font-medium text-sm transition-colors"
              >
                Yaratish
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="bg-gray-100 text-gray-700 px-5 py-2.5 rounded-lg hover:bg-gray-200 font-medium text-sm transition-colors"
              >
                Bekor qilish
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Classes Grid */}
      {classes.length === 0 ? (
        <div className="bg-white rounded-xl shadow-xs p-8 sm:p-12 border border-gray-200 text-center">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Sinf yo'q</h3>
          <p className="text-gray-600 mb-5 text-sm">Hali sinf yaratmadingiz. Birinchi sinfingizni yarating.</p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 font-medium text-sm transition-colors"
          >
            Sinf yaratish
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {classes.map((cls) => (
            <div key={cls.id} className="bg-white rounded-xl shadow-xs p-5 border border-gray-200 hover:border-blue-300 transition-colors flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">{cls.name}</h3>
                    <p className="text-gray-600 text-sm mt-0.5">{cls.academicYear}</p>
                    <p className="text-xs text-gray-500 mt-2">{cls.students?.length || 0} o'quvchi</p>
                  </div>
                  <button
                    onClick={() => handleDeleteClass(cls.id)}
                    className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50"
                    title="O'chirish"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
              <Link
                href={`/dashboard/classes/${cls.id}`}
                className="mt-4 block text-center bg-blue-50 text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-100 font-medium text-sm transition-colors"
              >
                Batafsil
              </Link>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
