"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getClientAuth } from "@/lib/firebaseClient";

function errorMessage(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";

  // Errors thrown by our own config guard (getFirebaseApp: missing/placeholder
  // NEXT_PUBLIC_FIREBASE_*) carry a clear, safe message. Surface it instead of
  // hiding it behind the generic text.
  if (!code) {
    const msg =
      typeof error === "object" && error !== null && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : "";
    if (msg.includes("NEXT_PUBLIC_FIREBASE")) {
      return "Firebase web konfiguratsiyasi to'ldirilmagan. /admin/.env.local faylida " +
        "NEXT_PUBLIC_FIREBASE_* qiymatlarini (frontend/.env.local dan) o'rnating.";
    }
  }

  if (
    code === "auth/user-not-found" ||
    code === "auth/wrong-password" ||
    code === "auth/invalid-credential"
  ) {
    return "Email yoki parol noto'g'ri.";
  }
  if (code === "auth/too-many-requests") {
    return "Juda ko'p muvaffaqiyatsiz urinish. Birozdan so'ng qayta urinib ko'ring.";
  }
  if (code === "auth/network-request-failed") {
    return "Tarmoq xatosi. Internet aloqasini tekshiring.";
  }
  if (code === "auth/operation-not-allowed") {
    return "Email/parol orqali kirish yoqilmagan. Firebase console -> Authentication -> " +
      "Email/Password (Sign-in method) ni yoqing.";
  }
  if (code === "auth/unauthorized-domain") {
    return "Bu domen ro'yxatga kiritilmagan. Firebase console -> Authentication -> Settings -> " +
      "Authorized domains ga ushbu hostni qo'shing.";
  }
  if (code === "auth/invalid-api-key" || code === "auth/api-key-not-valid-for-project") {
    return "Firebase web konfiguratsiyasi noto'g'ri. .env.example dagi NEXT_PUBLIC_FIREBASE_* " +
      "qiymatlarini frontend/.env.local dan ko'chirib o'rnating.";
  }
  if (code === "auth/configuration-not-found") {
    return "Firebase loyihasida autentifikatsiya sozlanmagan. Konsol sozlamalarini tekshiring.";
  }
  return "Tizimga kirishda xatolik yuz berdi.";
}

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setError("");

    if (!email.trim() || !password) {
      setError("Email va parolni kiriting.");
      return;
    }

    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(
        getClientAuth(),
        email.trim(),
        password
      );
      const idToken = await userCredential.user.getIdToken();

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!res.ok) {
        let message = "Kirish so'rovini qayta ishlashda xatolik yuz berdi.";
        try {
          const data = (await res.json()) as { message?: string; error?: string };
          if (res.status === 403) {
            message = "Bu hisob admin huquqiga ega emas. Sizga kirish taqiqlangan.";
            if (data.error === "NOT_ADMIN") {
              message =
                "Bu hisob admin (admin: true) huquqiga ega emas. Sizga kirish taqiqlangan.";
            }
          } else if (data.error === "ADMIN_CONFIG_MISSING") {
            message =
              "Admin server ma'lumotlari sozlanmagan. Ma'murga murojaat qiling (README ga qarang).";
          } else if (typeof data.message === "string") {
            message = data.message;
          }
        } catch {
          /* keep default message */
        }
        setError(message);
        await signOut(getClientAuth()).catch(() => {});
        return;
      }

      router.push(next);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 px-4 py-10 dark:from-gray-950 dark:via-gray-950 dark:to-gray-900">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-2xl font-bold text-white shadow-lg">
            U
          </div>
          <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-gray-100">
            UstozDaftar.uz Admin
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Boshqaruv paneliga kirish
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900"
        >
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              placeholder="admin@example.com"
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Parol
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                placeholder="••••••••"
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 pr-20 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                {showPassword ? "Yashirish" : "Ko'rsatish"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Kirilmoqda..." : "Kirish"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs leading-relaxed text-gray-400 dark:text-gray-500">
          Bu panel faqat admin huquqiga ega hisoblar uchun. Sessiya ma&apos;lumotlari
          xavfsiz cookie&apos;da saqlanadi. Ro&apos;yxatdan o&apos;tish ushbu panelda mavjud emas.
        </p>
      </div>
    </div>
  );
}