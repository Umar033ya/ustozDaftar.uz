"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";

export default function Login() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    emailOrPhone: "",
    password: "",
  });
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (!formData.emailOrPhone.trim() || !formData.password) {
      setError("Barcha maydonlarni to'ldiring");
      return;
    }

    const inputAccount = formData.emailOrPhone.trim().toLowerCase();

    // Check users array
    const usersJson = localStorage.getItem("ustozdaftar_users");
    const users = usersJson ? JSON.parse(usersJson) : [];

    let matchedUser = users.find(
      (u) => u.emailOrPhone.toLowerCase() === inputAccount && u.password === formData.password
    );

    // Fallback for legacy single-user storage
    if (!matchedUser) {
      const legacyUserJson = localStorage.getItem("ustozdaftar_user");
      if (legacyUserJson) {
        const legacyUser = JSON.parse(legacyUserJson);
        if (
          legacyUser.emailOrPhone &&
          legacyUser.emailOrPhone.toLowerCase() === inputAccount &&
          legacyUser.password === formData.password
        ) {
          matchedUser = legacyUser;
        }
      }
    }

    if (!matchedUser) {
      setError("Email/telefon yoki parol noto'g'ri");
      return;
    }

    // Save active logged-in user session
    const { password, ...sessionUser } = matchedUser;
    localStorage.setItem("ustozdaftar_user", JSON.stringify(sessionUser));

    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Navbar */}
      <nav className="bg-white shadow-xs border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center gap-3">
              <Logo size="default" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">UstozDaftar.uz</h1>
                <p className="text-xs text-gray-500">BSB & ChSB Avtomatlashtirish</p>
              </div>
            </Link>
            <Link href="/register" className="text-gray-700 hover:text-blue-600 font-medium text-sm">
              Ro'yxatdan o'tish
            </Link>
          </div>
        </div>
      </nav>

      {/* Login Form */}
      <div className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-xs border border-gray-200">
          <div>
            <h2 className="text-center text-2xl sm:text-3xl font-bold text-gray-900">
              Tizimga kirish
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              UstozDaftar.uz shaxsiy kabinetingizga kiring
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm font-medium">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="emailOrPhone" className="block text-sm font-medium text-gray-700">
                  Telefon yoki email
                </label>
                <input
                  id="emailOrPhone"
                  name="emailOrPhone"
                  type="text"
                  required
                  value={formData.emailOrPhone}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3.5 py-2.5 border border-gray-300 rounded-lg shadow-xs text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="email@example.com yoki +998901234567"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Parol
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3.5 py-2.5 border border-gray-300 rounded-lg shadow-xs text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="******"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-xs text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Kirish
              </button>
            </div>

            <div className="text-center pt-2">
              <p className="text-sm text-gray-600">
                Hisobingiz yo'qmi?{" "}
                <Link href="/register" className="font-semibold text-blue-600 hover:text-blue-500">
                  Ro'yxatdan o'ting
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
