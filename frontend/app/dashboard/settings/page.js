"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";

export default function Settings() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [schoolName, setSchoolName] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    const userJson = localStorage.getItem("ustozdaftar_user");
    if (userJson) {
      setUser(JSON.parse(userJson));
    }

    const schoolNameJson = localStorage.getItem("ustozdaftar_school_name");
    if (schoolNameJson) {
      setSchoolName(schoolNameJson);
    }
  }, []);

  const handleClearData = () => {
    if (confirm("Barcha ma'lumotlarni (sinflar, o'quvchilar, BSB, ChSB) o'chirmoqchimisiz? Bu amalni qaytarib bo'lmaydi.")) {
      localStorage.clear();
      router.push("/");
    }
  };

  const handleSaveSchoolName = () => {
    setSaving(true);
    localStorage.setItem("ustozdaftar_school_name", schoolName.trim());
    setTimeout(() => {
      setSaving(false);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    }, 400);
  };

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Sozlamalar</h1>
        <p className="text-gray-600 mt-1 text-sm sm:text-base">Hisob, maktab ma'lumotlari va ma'lumotlarni boshqarish</p>
      </div>

      <div className="max-w-3xl space-y-6">
        {/* User Info */}
        <div className="bg-white rounded-xl shadow-xs p-5 sm:p-6 border border-gray-200">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">Hisob ma'lumotlari</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-500 font-medium">Ism</p>
              <p className="text-gray-900 font-semibold mt-0.5">{user.firstName}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Familiya</p>
              <p className="text-gray-900 font-semibold mt-0.5">{user.lastName}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Telefon / Email</p>
              <p className="text-gray-900 font-semibold mt-0.5">{user.emailOrPhone}</p>
            </div>
          </div>
        </div>

        {/* School Settings */}
        <div className="bg-white rounded-xl shadow-xs p-5 sm:p-6 border border-gray-200">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">Maktab ma'lumotlari</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="schoolName" className="block text-sm font-medium text-gray-700 mb-1">
                Maktab nomi (Rasmiy jadvallar uchun)
              </label>
              <input
                id="schoolName"
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className="block w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Masalan: 317-sonli umumta'lim maktabi"
              />
              <p className="text-xs text-gray-500 mt-1.5">
                Ushbu nom barcha BSB va ChSB rasmiy natijalar huquqiy sarlavhasida chop etiladi
              </p>
            </div>

            {savedSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2.5 rounded-lg text-sm font-medium">
                Maktab nomi muvaffaqiyatli saqlandi!
              </div>
            )}

            <button
              onClick={handleSaveSchoolName}
              disabled={saving}
              className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 font-medium text-sm transition-colors disabled:bg-gray-400"
            >
              {saving ? "Saqlanmoqda..." : "Saqlash"}
            </button>
          </div>
        </div>

        {/* Data Management */}
        <div className="bg-white rounded-xl shadow-xs p-5 sm:p-6 border border-gray-200">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Ma'lumotlarni boshqarish</h2>
          <p className="text-gray-600 text-sm mb-4">
            Barcha lokal ma'lumotlarni (sinflar, o'quvchilar, BSB va ChSB baholashlar) tozalash.
          </p>
          <button
            onClick={handleClearData}
            className="bg-red-600 text-white px-5 py-2.5 rounded-lg hover:bg-red-700 font-medium text-sm transition-colors"
          >
            Barcha ma'lumotlarni o'chirish
          </button>
        </div>

        {/* App Info */}
        <div className="bg-white rounded-xl shadow-xs p-5 sm:p-6 border border-gray-200">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3">Dastur haqida</h2>
          <div className="space-y-1.5 text-xs sm:text-sm text-gray-600">
            <p><strong>Nomi:</strong> UstozDaftar.uz</p>
            <p><strong>Tavsif:</strong> BSB va ChSB Natijalarini Avtomatlashtirish Tizimi</p>
            <p><strong>Versiya:</strong> 1.1.0</p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
