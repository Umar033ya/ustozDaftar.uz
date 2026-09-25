"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";

export default function Register() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    emailOrPhone: "",
    password: "",
    confirmPassword: "",
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

    if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.emailOrPhone.trim() || !formData.password || !formData.confirmPassword) {
      setError("Barcha maydonlarni to'ldiring");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Parollar mos kelmaydi");
      return;
    }

    if (formData.password.length < 6) {
      setError("Parol kamida 6 belgidan iborat bo'lishi kerak");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\+?[0-9]{9,15}$/;
    
    if (!emailRegex.test(formData.emailOrPhone.trim()) && !phoneRegex.test(formData.emailOrPhone.trim())) {
      setError("To'g'ri email yoki telefon raqam kiriting");
      return;
    }

    // Get existing users
    const usersJson = localStorage.getItem("ustozdaftar_users");
    const users = usersJson ? JSON.parse(usersJson) : [];

    const exists = users.some(
      (u) => u.emailOrPhone.toLowerCase() === formData.emailOrPhone.trim().toLowerCase()
    );
    if (exists) {
      setError("Ushbu email yoki telefon bilan allaqachon ro'yxatdan o'tilgan");
      return;
    }

    const newUser = {
      id: Date.now().toString(),
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      emailOrPhone: formData.emailOrPhone.trim(),
      password: formData.password,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    localStorage.setItem("ustozdaftar_users", JSON.stringify(users));

    // Set active session user (without password)
    const { password, ...userSession } = newUser;
    localStorage.setItem("ustozdaftar_user", JSON.stringify(userSession));

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
            <Link href="/login" className="text-gray-700 hover:text-blue-600 font-medium text-sm">
              Kirish
            </Link>
          </div>
        </div>
      </nav>

      {/* Register Form */}
      <div className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-xs border border-gray-200">
          <div>
            <h2 className="text-center text-2xl sm:text-3xl font-bold text-gray-900">
              Ro'yxatdan o'tish
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              UstozDaftar.uz tizimida o'z shaxsiy hisobingizni yarating
            </p>
          </div>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm font-medium">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                  Ismingiz
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3.5 py-2.5 border border-gray-300 rounded-lg shadow-xs text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Masalan: Bekzod"
                />
              </div>

              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                  Familiyangiz
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3.5 py-2.5 border border-gray-300 rounded-lg shadow-xs text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Masalan: Karimov"
                />
              </div>

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
                  placeholder="Kamida 6 belgi"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                  Parolni tasdiqlash
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3.5 py-2.5 border border-gray-300 rounded-lg shadow-xs text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Parolni qayta kiriting"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-xs text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Ro'yxatdan o'tish
              </button>
            </div>

            <div className="text-center pt-2">
              <p className="text-sm text-gray-600">
                Allaqachon hisobingiz bormi?{" "}
                <Link href="/login" className="font-semibold text-blue-600 hover:text-blue-500">
                  Kirish
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
