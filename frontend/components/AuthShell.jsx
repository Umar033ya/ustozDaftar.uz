"use client";

import Link from "next/link";
import Logo from "@/components/Logo";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useTranslation } from "@/lib/useTranslation";

const POINTS = ["landing.hero.point1", "landing.hero.point2", "landing.hero.point3"];

/** Split-screen frame for the login and register pages (brand panel on large screens). */
export default function AuthShell({ title, subtitle, switchText, switchHref, switchLabel, children }) {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen bg-white">
      {/* Brand panel */}
      <aside className="relative hidden w-[44%] max-w-xl flex-col justify-between overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-emerald-600 p-10 text-white lg:flex">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl animate-drift" />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-emerald-300/25 blur-3xl animate-drift"
          style={{ animationDelay: "-8s" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "repeating-linear-gradient(180deg, transparent 0 31px, #fff 31px 32px)" }}
        />

        <Link href="/" className="relative flex items-center gap-3">
          <span className="rounded-xl bg-white p-1.5 shadow-lg">
            <Logo size="default" />
          </span>
          <span className="text-xl font-bold">UstozDaftar.uz</span>
        </Link>

        <div className="relative">
          <h2 className="text-3xl xl:text-4xl font-bold leading-tight animate-fade-up">{t("landing.auth.panelTitle")}</h2>
          <p className="mt-4 max-w-md text-blue-50/90 animate-fade-up" style={{ animationDelay: "100ms" }}>
            {t("landing.auth.panelText")}
          </p>
          <ul className="mt-8 space-y-3">
            {POINTS.map((key, i) => (
              <li
                key={key}
                className="flex items-center gap-3 animate-fade-up"
                style={{ animationDelay: `${200 + i * 100}ms` }}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/25">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                <span className="font-medium">{t(key)}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-blue-100/80">{t("app.tagline")}</p>
      </aside>

      {/* Form side */}
      <div className="flex flex-1 flex-col bg-gray-50 lg:bg-white">
        <header className="flex h-16 items-center justify-between gap-3 px-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2 lg:hidden">
            <Logo size="small" />
            <span className="text-lg font-bold text-gray-900">UstozDaftar.uz</span>
          </Link>
          <Link
            href="/"
            className="hidden items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-blue-600 lg:inline-flex"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t("landing.auth.back")}
          </Link>
          <LanguageSwitcher />
        </header>

        <main className="flex flex-1 items-start justify-center px-4 pb-10 pt-4 sm:items-center sm:px-8">
          <div className="w-full max-w-md animate-fade-up">
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 sm:p-8 lg:p-0 lg:shadow-none lg:ring-0">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">{title}</h1>
              <p className="mt-1.5 text-sm text-gray-600">{subtitle}</p>
              <div className="mt-7">{children}</div>
            </div>
            <p className="mt-6 text-center text-sm text-gray-600">
              {switchText}{" "}
              <Link href={switchHref} className="font-semibold text-blue-600 hover:text-blue-500">
                {switchLabel}
              </Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

/** Shared input with a leading icon; pass `trailing` for e.g. a show-password button. */
export function AuthField({ id, label, icon, trailing, className = "", ...inputProps }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="group relative">
        {icon && (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400 transition-colors group-focus-within:text-blue-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={icon} />
            </svg>
          </span>
        )}
        <input
          id={id}
          name={id}
          {...inputProps}
          className={`block w-full rounded-xl border border-gray-300 bg-white py-3 text-base sm:text-sm shadow-xs transition-all placeholder:text-gray-400 focus:border-blue-500 focus:outline-hidden focus:ring-4 focus:ring-blue-500/15 ${
            icon ? "pl-11" : "pl-3.5"
          } ${trailing ? "pr-11" : "pr-3.5"}`}
        />
        {trailing}
      </div>
    </div>
  );
}

export function PasswordToggle({ shown, onToggle, showLabel, hideLabel }) {
  const label = shown ? hideLabel : showLabel;
  return (
    <button
      type="button"
      onClick={onToggle}
      className="absolute inset-y-0 right-0 flex items-center px-3.5 text-gray-400 transition-colors hover:text-gray-600"
      title={label}
      aria-label={label}
      aria-pressed={shown}
    >
      {shown ? (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18M10.58 10.58a2 2 0 002.83 2.83M9.9 4.24A9.12 9.12 0 0112 4c7 0 10 8 10 8a17.9 17.9 0 01-2.16 3.19M6.61 6.61A17.9 17.9 0 002 12s3 8 10 8a9.12 9.12 0 004.1-.9" />
        </svg>
      ) : (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  );
}

export function AuthError({ message }) {
  if (!message) return null;
  return (
    <div
      key={message}
      role="alert"
      className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 animate-shake"
    >
      <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {message}
    </div>
  );
}

export function AuthSubmit({ submitting, label, submittingLabel }) {
  return (
    <button
      type="submit"
      disabled={submitting}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:-translate-y-0.5 hover:bg-blue-700 focus:outline-hidden focus:ring-4 focus:ring-blue-500/30 disabled:translate-y-0 disabled:cursor-wait disabled:bg-blue-400 disabled:shadow-none"
    >
      {submitting && (
        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      )}
      {submitting ? submittingLabel : label}
    </button>
  );
}

export const AUTH_ICONS = {
  email: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
  lock: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
  user: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
};
