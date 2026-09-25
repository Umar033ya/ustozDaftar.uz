"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";

export default function CreateChSB() {
  const router = useRouter();
  const [classes, setClasses] = useState([]);
  const [formData, setFormData] = useState({
    classId: "",
    subject: "",
    chsbNumber: "",
    date: "",
    maxScore: 40,
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

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (!formData.classId || !formData.subject.trim() || !formData.chsbNumber || !formData.date || !formData.maxScore) {
      setError("Barcha maydonlarni to'ldiring");
      return;
    }

    const selectedClass = classes.find((cls) => cls.id === formData.classId);
    if (!selectedClass || !selectedClass.students || selectedClass.students.length === 0) {
      setError("Tanlangan sinfda o'quvchilar yo'q. Avval o'quvchilarni sinfga qo'shing.");
      return;
    }

    const maxScore = Math.max(1, parseInt(formData.maxScore) || 1);

    const assessment = {
      id: Date.now().toString(),
      type: "ChSB",
      classId: formData.classId,
      className: selectedClass.name,
      academicYear: selectedClass.academicYear,
      subject: formData.subject.trim(),
      number: formData.chsbNumber,
      date: formData.date,
      maxScore: maxScore,
      results: selectedClass.students.map((student) => ({
        studentId: student.id,
        studentName: student.name,
        total: "",
        percentage: 0,
      })),
      createdAt: new Date().toISOString(),
    };

    const assessmentsJson = localStorage.getItem("ustozdaftar_assessments");
    const assessments = assessmentsJson ? JSON.parse(assessmentsJson) : [];
    assessments.push(assessment);
    localStorage.setItem("ustozdaftar_assessments", JSON.stringify(assessments));

    router.push(`/dashboard/chsb/${assessment.id}`);
  };

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <Link href="/dashboard/chsb" className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-2 inline-block">
          ← ChSB ga qaytish
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Yangi ChSB yaratish</h1>
        <p className="text-gray-600 mt-1 text-sm sm:text-base">ChSB ma'lumotlarini va maksimal ballni kiriting</p>
      </div>

      {/* Form Card */}
      <div className="bg-white rounded-xl shadow-xs p-5 sm:p-6 border border-gray-200">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6">
            <div>
              <label htmlFor="classId" className="block text-sm font-medium text-gray-700 mb-1">
                Sinfni tanlang
              </label>
              <select
                id="classId"
                name="classId"
                required
                value={formData.classId}
                onChange={handleChange}
                className="block w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="">Sinfni tanlang</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name} ({cls.academicYear}) - {cls.students?.length || 0} o'quvchi
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
                Fan nomi
              </label>
              <input
                id="subject"
                name="subject"
                type="text"
                required
                value={formData.subject}
                onChange={handleChange}
                className="block w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Masalan: Geometriya"
              />
            </div>

            <div>
              <label htmlFor="chsbNumber" className="block text-sm font-medium text-gray-700 mb-1">
                ChSB raqami / Chorak
              </label>
              <input
                id="chsbNumber"
                name="chsbNumber"
                type="number"
                required
                min="1"
                value={formData.chsbNumber}
                onChange={handleChange}
                className="block w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Masalan: 1"
              />
            </div>

            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                O'tkazilgan sana
              </label>
              <input
                id="date"
                name="date"
                type="date"
                required
                value={formData.date}
                onChange={handleChange}
                className="block w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="maxScore" className="block text-sm font-medium text-gray-700 mb-1">
                Maksimal ball (ChSB umumiy bali)
              </label>
              <input
                id="maxScore"
                name="maxScore"
                type="number"
                required
                min="1"
                value={formData.maxScore}
                onChange={handleChange}
                className="block w-full sm:w-1/2 px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Masalan: 40"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="submit"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium text-sm sm:text-base transition-colors"
            >
              Yaratish va ballarni kiritish
            </button>
            <Link
              href="/dashboard/chsb"
              className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 font-medium text-sm sm:text-base text-center transition-colors"
            >
              Bekor qilish
            </Link>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
