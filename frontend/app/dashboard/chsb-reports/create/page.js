"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/lib/authContext";
import { createChsbReport, getClasses, getStudents } from "@/lib/firestoreService";
import {
  CHSB_MAX_QUESTIONS,
  CHSB_MAX_TOTAL,
  formatScore,
  sumPoints,
  validateQuestionPoints,
} from "@/lib/chsbReport";

const INPUT_CLASS =
  "block w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-base sm:text-sm shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white";

export default function CreateChsbReport() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const [classes, setClasses] = useState([]);
  const [formData, setFormData] = useState({ classId: "", subject: "", number: "", date: "", questionCount: "" });
  // Kept longer than the count, so lowering and raising the count does not lose typed points
  const [pointInputs, setPointInputs] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    getClasses(currentUser.uid)
      .then(setClasses)
      .catch((err) => console.error("Error loading classes:", err));
  }, [currentUser]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const count = Math.min(CHSB_MAX_QUESTIONS, Math.max(0, parseInt(formData.questionCount, 10) || 0));
  const points = Array.from({ length: count }, (_, i) => pointInputs[i] ?? "");
  const total = sumPoints(points);
  const overLimit = total > CHSB_MAX_TOTAL;
  const allFilled = count > 0 && points.every((p) => String(p).trim() !== "");

  const handlePointChange = (index, value) => {
    const next = [...pointInputs];
    while (next.length <= index) next.push("");
    next[index] = value;
    setPointInputs(next);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.classId || !formData.subject.trim() || !formData.number || !formData.date || count === 0) {
      setError("Barcha maydonlarni to'ldiring");
      return;
    }

    const validated = validateQuestionPoints(points);
    if (validated.error) {
      setError(validated.error);
      return;
    }

    const selectedClass = classes.find((cls) => cls.id === formData.classId);
    if (!selectedClass) {
      setError("Sinf topilmadi");
      return;
    }

    setSubmitting(true);
    try {
      const students = await getStudents(currentUser.uid, formData.classId);
      if (!students || students.length === 0) {
        setError("Tanlangan sinfda o'quvchilar yo'q. Avval o'quvchilarni sinfga qo'shing.");
        setSubmitting(false);
        return;
      }

      const newId = await createChsbReport(
        currentUser.uid,
        {
          classId: formData.classId,
          className: selectedClass.name,
          academicYear: selectedClass.academicYear,
          subject: formData.subject.trim(),
          number: formData.number,
          date: formData.date,
          questions: validated.points,
        },
        students
      );
      router.push(`/dashboard/chsb-reports/${newId}`);
    } catch (err) {
      console.error("Error creating ChSB report:", err);
      setError("Hisobotni yaratishda xatolik yuz berdi");
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-6 sm:mb-8">
        <Link href="/dashboard/chsb-reports" className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-2 inline-block">
          ← ChSB hisobotiga qaytish
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Yangi ChSB hisoboti</h1>
        <p className="text-gray-600 mt-1 text-sm sm:text-base">Hisobot ma&apos;lumotlarini va har bir savol balini kiriting</p>
      </div>

      <div className="bg-white rounded-xl shadow-xs p-5 sm:p-6 border border-gray-200">
        <form onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6">
            <div>
              <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">Fan nomi</label>
              <input id="subject" name="subject" type="text" value={formData.subject} onChange={handleChange} className={INPUT_CLASS} placeholder="Masalan: Matematika" />
            </div>
            <div>
              <label htmlFor="number" className="block text-sm font-medium text-gray-700 mb-1">Nechinchi ChSB</label>
              <input id="number" name="number" type="number" min="1" value={formData.number} onChange={handleChange} className={INPUT_CLASS} placeholder="Masalan: 1" />
            </div>
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">O&apos;tkazilgan sana</label>
              <input id="date" name="date" type="date" value={formData.date} onChange={handleChange} className={INPUT_CLASS} />
            </div>
            <div>
              <label htmlFor="classId" className="block text-sm font-medium text-gray-700 mb-1">Sinf</label>
              <select id="classId" name="classId" value={formData.classId} onChange={handleChange} className={INPUT_CLASS}>
                <option value="">Sinfni tanlang</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name} ({cls.academicYear}) - {cls.studentCount || 0} o&apos;quvchi
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="questionCount" className="block text-sm font-medium text-gray-700 mb-1">Savollar soni</label>
              <input
                id="questionCount"
                name="questionCount"
                type="number"
                min="1"
                max={CHSB_MAX_QUESTIONS}
                value={formData.questionCount}
                onChange={handleChange}
                className={INPUT_CLASS}
                placeholder="Masalan: 16"
              />
            </div>
          </div>

          {count > 0 && (
            <fieldset className="mb-6 border-t border-gray-200 pt-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <legend className="text-sm font-semibold text-gray-900">Har bir savol bali</legend>
                <p className={`text-sm font-bold tabular-nums ${overLimit ? "text-red-700" : "text-gray-900"}`}>
                  Jami: {formatScore(total)} / {CHSB_MAX_TOTAL}
                </p>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-3">
                {points.map((value, index) => (
                  <div key={index}>
                    <label htmlFor={`point-${index}`} className="block text-xs font-medium text-gray-600 mb-1">{index + 1}-savol</label>
                    <input
                      id={`point-${index}`}
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      value={value}
                      onChange={(e) => handlePointChange(index, e.target.value)}
                      className="block w-full h-11 sm:h-10 px-2 text-center text-base sm:text-sm font-semibold border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                      placeholder="2,5"
                    />
                  </div>
                ))}
              </div>
              {overLimit && (
                <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
                  ChSB maksimal {CHSB_MAX_TOTAL} ballik. Savollar bali jami {formatScore(total)} bo&apos;ldi, {formatScore(total - CHSB_MAX_TOTAL)} ball kamaytiring.
                </p>
              )}
              {!overLimit && allFilled && total < CHSB_MAX_TOTAL && (
                <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
                  Jami {CHSB_MAX_TOTAL} balldan kam: bu hisobotda maksimal ball {formatScore(total)} bo&apos;ladi.
                </p>
              )}
            </fieldset>
          )}

          {error && (
            <p role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="submit"
              disabled={submitting || overLimit}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium text-sm sm:text-base transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {submitting ? "Yaratilmoqda..." : "Hisobotni yaratish"}
            </button>
            <Link
              href="/dashboard/chsb-reports"
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
