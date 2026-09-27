"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";
import { useAuth } from "@/lib/authContext";

export default function Login() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Barcha maydonlarni to'ldiring");
      return;
    }

    setSubmitting(true);

    try {
      await login(email.trim(), password);
      router.push("/dashboard");
    } catch (err) {
      console.error("Login error:", err);
      if (
        err.code === "auth/user-not-found" ||
        err.code === "auth/wrong-password" ||
        err.code === "auth/invalid-credential"
      ) {
        setError("Email yoki parol noto'g'ri");
      } else if (err.code === "auth/invalid-email") {
        setError("Noto'g'ri email adresi kiritildi");
      } else if (err.code === "auth/too-many-requests") {
        setError("Juda ko'p muvaffaqiyatsiz urinish. Birozdan so'ng qayta urinib ko'ring.");
      } else {
        setError("Tizimga kirishda xatolik yuz berdi. Qayta urinib ko'ring.");
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
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full px-3.5 py-2.5 pr-11 border border-gray-300 rounded-lg shadow-xs text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="******"
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
            </div>

            <div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-xs text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400"
              >
                {submitting ? "Kirilmoqda..." : "Kirish"}
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
