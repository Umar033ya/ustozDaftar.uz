"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";
import { useAuth } from "@/lib/authContext";

export default function Register() {
  const router = useRouter();
  const { register } = useAuth();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (
      !formData.firstName.trim() ||
      !formData.lastName.trim() ||
      !formData.email.trim() ||
      !formData.password ||
      !formData.confirmPassword
    ) {
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
    if (!emailRegex.test(formData.email.trim())) {
      setError("To'g'ri email manzil kiriting");
      return;
    }

    setSubmitting(true);

    try {
      await register(
        formData.email.trim(),
        formData.password,
        formData.firstName.trim(),
        formData.lastName.trim()
      );
      router.push("/dashboard");
    } catch (err) {
      console.error("Register error:", err);
      if (err.code === "auth/email-already-in-use") {
        setError("Ushbu email bilan allaqachon ro'yxatdan o'tilgan");
      } else if (err.code === "auth/invalid-email") {
        setError("Noto'g'ri email manzil kiritildi");
      } else if (err.code === "auth/weak-password") {
        setError("Parol juda zaif. Kamida 6 ta belgi kiritishingiz kerak.");
      } else if (err.message === "PROFILE_CREATE_FAILED") {
        setError(
          "Hisob yaratildi, lekin profil yozilmadi. Firebase'da Firestore Security Rules joriy etilganini tekshirib, qayta urinib ko'ring."
        );
      } else {
        setError("Ro'yxatdan o'tishda xatolik yuz berdi. Qayta urinib ko'ring.");
      }
    } finally {
      setSubmitting(false);
    }
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
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3.5 py-2.5 border border-gray-300 rounded-lg shadow-xs text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="email@example.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Parol
                </label>
                <div className="relative mt-1">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={formData.password}
                    onChange={handleChange}
                    className="block w-full px-3.5 py-2.5 pr-11 border border-gray-300 rounded-lg shadow-xs text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Kamida 6 belgi"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600 transition-colors"
                    title={showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
                    aria-label={showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18M10.58 10.58a2 2 0 002.83 2.83M9.9 4.24A9.12 9.12 0 0112 4c7 0 10 8 10 8a17.9 17.9 0 01-2.16 3.19M6.61 6.61A17.9 17.9 0 002 12s3 8 10 8a9.12 9.12 0 004.1-.9" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                  Parolni tasdiqlash
                </label>
                <div className="relative mt-1">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="block w-full px-3.5 py-2.5 pr-11 border border-gray-300 rounded-lg shadow-xs text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Parolni qayta kiriting"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600 transition-colors"
                    title={showConfirmPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
                    aria-label={showConfirmPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
                    aria-pressed={showConfirmPassword}
                  >
                    {showConfirmPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18M10.58 10.58a2 2 0 002.83 2.83M9.9 4.24A9.12 9.12 0 0112 4c7 0 10 8 10 8a17.9 17.9 0 01-2.16 3.19M6.61 6.61A17.9 17.9 0 002 12s3 8 10 8a9.12 9.12 0 004.1-.9" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-xs text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400"
              >
                {submitting ? "Ro'yxatdan o'tilmoqda..." : "Ro'yxatdan o'tish"}
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
