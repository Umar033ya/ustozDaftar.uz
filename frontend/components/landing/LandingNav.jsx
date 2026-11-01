"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useAuth } from "@/lib/authContext";
import { useTranslation } from "@/lib/useTranslation";

const SECTION_LINKS = [
  { href: "#features", key: "nav.features" },
  { href: "#how-it-works", key: "nav.howItWorks" },
];

export default function LandingNav() {
  const { currentUser } = useAuth();
  const { t } = useTranslation();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const primary = currentUser
    ? { href: "/dashboard", label: t("nav.dashboard") }
    : { href: "/register", label: t("nav.register") };

  return (
    <nav
      className={`sticky top-0 z-40 transition-all duration-300 ${
        scrolled || open ? "bg-white/90 backdrop-blur-md shadow-sm" : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-3">
          <Link href="/" className="flex min-w-0 items-center gap-2.5" onClick={() => setOpen(false)}>
            <Logo size="default" className="shrink-0" />
            <div className="min-w-0">
              <p className="truncate text-lg sm:text-xl font-bold text-gray-900 leading-tight">UstozDaftar.uz</p>
              <p className="hidden sm:block truncate text-xs text-gray-500">{t("app.tagline")}</p>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-7">
            {SECTION_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">
                {t(l.key)}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSwitcher />
            <div className="hidden sm:flex items-center gap-3">
              {!currentUser && (
                <Link href="/login" className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors">
                  {t("nav.login")}
                </Link>
              )}
              <Link
                href={primary.href}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-600/30 transition-all hover:bg-blue-700 hover:-translate-y-0.5"
              >
                {primary.label}
              </Link>
            </div>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="sm:hidden -mr-1 rounded-lg p-2 text-gray-700 hover:bg-gray-100"
              aria-label={t("landing.nav.menu")}
              aria-expanded={open}
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {open ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 12h16M4 17h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={`sm:hidden overflow-hidden border-t border-gray-100 bg-white transition-[max-height] duration-300 ${
          open ? "max-h-80" : "max-h-0 border-transparent"
        }`}
      >
        <div className="space-y-1 px-4 py-3">
          {SECTION_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {t(l.key)}
            </a>
          ))}
          <div className="grid grid-cols-2 gap-2 pt-2">
            {!currentUser && (
              <Link
                href="/login"
                className="rounded-lg border border-gray-300 px-3 py-2.5 text-center text-sm font-semibold text-gray-700"
              >
                {t("nav.login")}
              </Link>
            )}
            <Link
              href={primary.href}
              className={`rounded-lg bg-blue-600 px-3 py-2.5 text-center text-sm font-semibold text-white ${
                currentUser ? "col-span-2" : ""
              }`}
            >
              {primary.label}
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
