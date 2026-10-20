"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useAuth } from "@/lib/authContext";
import { useTranslation } from "@/lib/useTranslation";

const AUTH_ERRORS = {
  "auth/email-already-in-use": "register.error.emailInUse",
  "auth/invalid-email": "register.error.invalidEmail",
  "auth/weak-password": "register.error.weakPassword",
};

function getErrorMessage(err) {
  return AUTH_ERRORS[err?.code] || "register.error.system";
}

export default function Register() {
  const router = useRouter();
  const { register } = useAuth();
  const { t } = useTranslation();
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
    setError("");      if (
      !formData.firstName.trim() ||
      !formData.lastName.trim() ||
      !formData.email.trim() ||
      !formData.password ||
      !formData.confirmPassword
    ) {
      setError(t("register.error.allFields"));
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError(t("register.error.passwordMismatch"));
      return;
    }

    if (formData.password.length < 6) {
      setError(t("register.error.shortPassword"));
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      setError(t("register.error.invalidEmail"));
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
      const errorKey = getErrorMessage(err);
      if (err.message === "PROFILE_CREATE_FAILED") {
        setError(t("register.error.profileFailed"));
      } else {
        setError(t(errorKey));
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
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-2">
                <Logo size="default" />
                <div>
                  <h1 className="text-xl font-bold text-gray-900">UstozDaftar.uz</h1>
                  <p className="text-xs text-gray-500">{t("app.tagline")}</p>
                </div>
              </Link>
              <LanguageSwitcher />
            </div>
            <Link href="/login" className="text-gray-700 hover:text-blue-600 font-medium text-sm">
              {t("nav.login")}
            </Link>
          </div>
        </div>
      </nav>

      {/* Register Form */}
      <div className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-xs border border-gray-200">
          <div>
            <h2 className="text-center text-2xl sm:text-3xl font-bold text-gray-900">
              {t("register.title")}
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              {t("register.subtitle")}
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
                  {t("register.firstName")}
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3.5 py-2.5 border border-gray-300 rounded-lg shadow-xs text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={t("register.firstName.placeholder")}
                />
              </div>

              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                  {t("register.lastName")}
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3.5 py-2.5 border border-gray-300 rounded-lg shadow-xs text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={t("register.lastName.placeholder")}
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  {t("register.email")}
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3.5 py-2.5 border border-gray-300 rounded-lg shadow-xs text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={t("register.email.placeholder")}
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  {t("register.password")}
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
                    placeholder={t("register.password.placeholder")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600 transition-colors"
                    title={showPassword ? t("register.hidePassword") : t("register.showPassword")}
                    aria-label={showPassword ? t("register.hidePassword") : t("register.showPassword")}
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
                  {t("register.confirmPassword")}
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
                    placeholder={t("register.confirmPassword.placeholder")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600 transition-colors"
                    title={showConfirmPassword ? t("register.hidePassword") : t("register.showPassword")}
                    aria-label={showConfirmPassword ? t("register.hidePassword") : t("register.showPassword")}
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
                {submitting ? t("register.submitting") : t("register.submit")}
              </button>
            </div>

            <div className="text-center pt-2">
              <p className="text-sm text-gray-600">
                {t("register.loginLink")} {" "}
                <Link href="/login" className="font-semibold text-blue-600 hover:text-blue-500">
                  {t("nav.login")}
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
