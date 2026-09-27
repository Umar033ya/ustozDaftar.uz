"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/lib/authContext";
import {
  getClassById,
  getStudents,
  addStudent,
  deleteStudent,
  updateStudentName,
  syncStudentNameInAssessments,
  syncNewStudentToAssessments,
  setClassStudentCount,
} from "@/lib/firestoreService";

export default function ClassDetail() {
  const router = useRouter();
  const params = useParams();
  const classId = params.id;
  const { currentUser } = useAuth();
  
  const [classData, setClassData] = useState(null);
  const [students, setStudents] = useState([]);
  const [showAddStudentForm, setShowAddStudentForm] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [error, setError] = useState("");
  const [editingStudentId, setEditingStudentId] = useState(null);
  const [editStudentName, setEditStudentName] = useState("");
  const [editError, setEditError] = useState("");
  const [savingStudent, setSavingStudent] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser || !classId) return;

    async function loadClassAndStudents() {
      try {
        const loadedClass = await getClassById(currentUser.uid, classId);
        if (loadedClass) {
          setClassData(loadedClass);
          const loadedStudents = await getStudents(currentUser.uid, classId);
          setStudents(loadedStudents);
          // Repair a drifted class counter (legacy import / interrupted write)
          if ((loadedClass.studentCount || 0) !== loadedStudents.length) {
            setClassStudentCount(currentUser.uid, classId, loadedStudents.length).catch((err) =>
              console.error("Error repairing class student count:", err)
            );
            setClassData({ ...loadedClass, studentCount: loadedStudents.length });
          }
        } else {
          router.push("/dashboard/classes");
        }
      } catch (err) {
        console.error("Error loading class details:", err);
      } finally {
        setLoading(false);
      }
    }

    loadClassAndStudents();
  }, [currentUser, classId, router]);

  const handleAddStudent = async (e, keepOpen = false) => {
    e.preventDefault();
    if (savingStudent) return;
    setError("");

    const trimmedName = studentName.trim();

    if (!trimmedName) {
      setError("O'quvchi ismini kiriting");
      return;
    }

    const exists = students.some(
      (s) => s.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (exists) {
      setError("Bunday ismli o'quvchi bu sinfda allaqachon mavjud");
      return;
    }

    try {
      setSavingStudent(true);
      const newStudent = await addStudent(currentUser.uid, classId, trimmedName);
      await syncNewStudentToAssessments(currentUser.uid, classId, newStudent);

      const updatedStudents = [...students, newStudent];
      // Keep the cached class counter exactly in sync with the roster
      setClassStudentCount(currentUser.uid, classId, updatedStudents.length).catch((err) =>
        console.error("Error updating class student count:", err)
      );

      setStudents(updatedStudents);
      setClassData((prev) => (prev ? { ...prev, studentCount: updatedStudents.length } : prev));
      setStudentName("");
      setError("");
      // "Yana qo'shish" keeps the form open so the next name can be typed right away
      if (!keepOpen) {
        setShowAddStudentForm(false);
      }
    } catch (err) {
      console.error("Error adding student:", err);
      setError("O'quvchi qo'shishda xatolik yuz berdi");
    } finally {
      setSavingStudent(false);
    }
  };

  const handleDeleteStudent = async (studentId) => {
    if (confirm("O'quvchini o'chirmoqchimisiz?")) {
      try {
        await deleteStudent(currentUser.uid, classId, studentId);

        const updatedStudents = students.filter((student) => student.id !== studentId);
        setClassStudentCount(currentUser.uid, classId, updatedStudents.length).catch((err) =>
          console.error("Error updating class student count:", err)
        );

        setStudents(updatedStudents);
        setClassData((prev) =>
          prev ? { ...prev, studentCount: updatedStudents.length } : prev
        );
      } catch (err) {
        console.error("Error deleting student:", err);
        alert("O'quvchini o'chirishda xatolik yuz berdi");
      }
    }
  };

  const handleEditStudent = (student) => {
    setEditingStudentId(student.id);
    setEditStudentName(student.name);
    setEditError("");
  };

  const handleCancelEdit = () => {
    setEditingStudentId(null);
    setEditStudentName("");
    setEditError("");
  };

  const handleSaveEdit = async () => {
    setEditError("");
    const trimmedName = editStudentName.trim();

    if (!trimmedName) {
      setEditError("O'quvchi ismini kiriting");
      return;
    }

    const exists = students.some(
      (s) => s.id !== editingStudentId && s.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (exists) {
      setEditError("Bunday ismli o'quvchi bu sinfda allaqachon mavjud");
      return;
    }

    try {
      await updateStudentName(currentUser.uid, classId, editingStudentId, trimmedName);
      await syncStudentNameInAssessments(currentUser.uid, classId, editingStudentId, trimmedName);

      setStudents(
        students.map((student) =>
          student.id === editingStudentId ? { ...student, name: trimmedName } : student
        )
      );

      setEditingStudentId(null);
      setEditStudentName("");
      setEditError("");
    } catch (err) {
      console.error("Error editing student:", err);
      setEditError("O'quvchi ismini tahrirlashda xatolik yuz berdi");
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center text-gray-500 py-12">Yuklanmoqda...</div>
      </DashboardLayout>
    );
  }

  if (!classData) {
    return null;
  }

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <Link href="/dashboard/classes" className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-2 inline-block">
            ← Sinflarga qaytish
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{classData.name}</h1>
          <p className="text-gray-600 mt-0.5 text-sm sm:text-base">{classData.academicYear}</p>
        </div>
        <button
          onClick={() => setShowAddStudentForm(!showAddStudentForm)}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2 text-sm sm:text-base transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          O'quvchi qo'shish
        </button>
      </div>

      {/* Add Student Form */}
      {showAddStudentForm && (
        <div className="bg-white rounded-xl shadow-xs p-5 sm:p-6 border border-gray-200 mb-6 sm:mb-8">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">Yangi o'quvchi qo'shish</h2>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}
          <form onSubmit={(e) => handleAddStudent(e, false)}>
            <div>
              <label htmlFor="studentName" className="block text-sm font-medium text-gray-700 mb-1">
                F.I.Sh. (Familiya, Ism, Sharif)
              </label>
              <input
                id="studentName"
                name="studentName"
                type="text"
                required
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="block w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Masalan: Karimov Abdulla Bekzod o'g'li"
              />
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button
                type="submit"
                disabled={savingStudent}
                className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 font-medium text-sm transition-colors disabled:bg-gray-400"
              >
                Qo&apos;shish
              </button>
              <button
                type="button"
                disabled={savingStudent}
                onClick={(e) => handleAddStudent(e, true)}
                className="bg-white text-blue-600 border border-blue-200 px-5 py-2.5 rounded-lg hover:bg-blue-50 font-medium text-sm transition-colors disabled:bg-gray-100 disabled:text-gray-400"
              >
                Yana qo&apos;shish
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddStudentForm(false);
                  setError("");
                }}
                className="bg-gray-100 text-gray-700 px-5 py-2.5 rounded-lg hover:bg-gray-200 font-medium text-sm transition-colors"
              >
                Bekor qilish
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              &laquo;Yana qo&apos;shish&raquo; formani yopmaydi — keyingi o&apos;quvchini darhol kiritishingiz mumkin.
            </p>
          </form>
        </div>
      )}

      {/* Edit Error Notification */}
      {editError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {editError}
        </div>
      )}

      {/* Students Table */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
            O'quvchilar ro'yxati ({students.length})
          </h2>
        </div>
        
        {students.length === 0 ? (
          <div className="p-8 sm:p-12 text-center">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">O'quvchi yo'q</h3>
            <p className="text-gray-600 mb-5 text-sm">Hali o'quvchi qo'shmadingiz. Birinchi o'quvchingizni qo'shing.</p>
            <button
              onClick={() => setShowAddStudentForm(true)}
              className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 font-medium text-sm transition-colors"
            >
              O'quvchi qo'shish
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider w-12 text-center">
                    №
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    F.I.Sh.
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-right w-44">
                    Amallar
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {students.map((student, index) => (
                  <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-900 text-center font-medium">
                      {index + 1}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {editingStudentId === student.id ? (
                        <div className="flex flex-col gap-1">
                          <input
                            type="text"
                            value={editStudentName}
                            onChange={(e) => setEditStudentName(e.target.value)}
                            className="block w-full px-3 py-1.5 border border-blue-500 rounded-md shadow-xs text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveEdit();
                              if (e.key === "Escape") handleCancelEdit();
                            }}
                          />
                        </div>
                      ) : (
                        <span className="font-medium">{student.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {editingStudentId === student.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={handleSaveEdit}
                            className="bg-green-600 text-white px-3 py-1.5 rounded-md hover:bg-green-700 text-xs font-semibold transition-colors"
                          >
                            Saqlash
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="bg-gray-200 text-gray-700 px-3 py-1.5 rounded-md hover:bg-gray-300 text-xs font-semibold transition-colors"
                          >
                            Bekor qilish
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => handleEditStudent(student)}
                            className="text-blue-600 hover:text-blue-800 text-xs sm:text-sm font-semibold transition-colors"
                          >
                            Tahrirlash
                          </button>
                          <button
                            onClick={() => handleDeleteStudent(student.id)}
                            className="text-red-600 hover:text-red-800 text-xs sm:text-sm font-semibold transition-colors"
                          >
                            O'chirish
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
