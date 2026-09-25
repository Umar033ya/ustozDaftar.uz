"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";

export default function CreateBSB() {
  const router = useRouter();
  const [classes, setClasses] = useState([]);
  const [formData, setFormData] = useState({
    classId: "",
    subject: "",
    bsbNumber: "",
    date: "",
    numberOfTasks: 5,
  });
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const classesJson = localStorage.getItem("ustozdaftar_classes");
    if (classesJson) {
      setClasses(JSON.parse(classesJson));
    }
  }, []);

  useEffect(() => {
    const num = Math.min(20, Math.max(1, parseInt(formData.numberOfTasks) || 1));
    const newTasks = [];
    for (let i = 1; i <= num; i++) {
      newTasks.push({
        number: i,
        maxScore: tasks[i - 1]?.maxScore !== undefined ? tasks[i - 1].maxScore : 3,
      });
    }
    setTasks(newTasks);
  }, [formData.numberOfTasks]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleTaskChange = (taskNumber, maxScore) => {
    setTasks(
      tasks.map((task) =>
        task.number === taskNumber ? { ...task, maxScore: Math.max(0, parseInt(maxScore) || 0) } : task
      )
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (!formData.classId || !formData.subject.trim() || !formData.bsbNumber || !formData.date) {
      setError("Barcha kerakli maydonlarni to'ldiring");
      return;
    }

    const selectedClass = classes.find((cls) => cls.id === formData.classId);
    if (!selectedClass || !selectedClass.students || selectedClass.students.length === 0) {
      setError("Tanlangan sinfda o'quvchilar yo'q. Avval o'quvchilarni sinfga qo'shing.");
      return;
    }

    const maxTotal = tasks.reduce((sum, task) => sum + task.maxScore, 0);

    const assessment = {
      id: Date.now().toString(),
      type: "BSB",
      classId: formData.classId,
      className: selectedClass.name,
      academicYear: selectedClass.academicYear,
      subject: formData.subject.trim(),
      number: formData.bsbNumber,
      date: formData.date,
      tasks: tasks,
      maxTotal: maxTotal,
      results: selectedClass.students.map((student) => ({
        studentId: student.id,
        studentName: student.name,
        scores: tasks.map(() => ""),
        total: 0,
        percentage: 0,
      })),
      createdAt: new Date().toISOString(),
    };

    const assessmentsJson = localStorage.getItem("ustozdaftar_assessments");
    const assessments = assessmentsJson ? JSON.parse(assessmentsJson) : [];
    assessments.push(assessment);
    localStorage.setItem("ustozdaftar_assessments", JSON.stringify(assessments));

    router.push(`/dashboard/bsb/${assessment.id}`);
  };

  const maxTotal = tasks.reduce((sum, task) => sum + task.maxScore, 0);

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <Link href="/dashboard/bsb" className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-2 inline-block">
          ← BSB ga qaytish
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Yangi BSB yaratish</h1>
        <p className="text-gray-600 mt-1 text-sm sm:text-base">BSB ma'lumotlarini kiriting va topshiriqlarni sozlang</p>
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
                placeholder="Masalan: Algebra"
              />
            </div>

            <div>
              <label htmlFor="bsbNumber" className="block text-sm font-medium text-gray-700 mb-1">
                BSB raqami
              </label>
              <input
                id="bsbNumber"
                name="bsbNumber"
                type="number"
                required
                min="1"
                value={formData.bsbNumber}
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
              <label htmlFor="numberOfTasks" className="block text-sm font-medium text-gray-700 mb-1">
                Topshiriqlar soni
              </label>
              <input
                id="numberOfTasks"
                name="numberOfTasks"
                type="number"
                required
                min="1"
                max="20"
                value={formData.numberOfTasks}
                onChange={handleChange}
                className="block w-full sm:w-1/2 px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Task Configuration Grid */}
          <div className="border-t border-gray-200 pt-6 mb-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">
              Har bir topshiriq uchun maksimal ball:
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
              {tasks.map((task) => (
                <div key={task.number} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <label className="block text-xs font-semibold text-gray-700 mb-1 text-center">
                    {task.number}-topshiriq
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={task.maxScore}
                    onChange={(e) => handleTaskChange(task.number, e.target.value)}
                    className="block w-full px-2 py-1.5 border border-gray-300 rounded-md text-center text-sm font-bold shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    placeholder="Max ball"
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 p-4 bg-blue-50 rounded-lg flex items-center justify-between">
              <span className="text-sm font-semibold text-blue-900">
                Jami maksimal ball:
              </span>
              <span className="text-2xl font-extrabold text-blue-700">{maxTotal}</span>
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
              href="/dashboard/bsb"
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
