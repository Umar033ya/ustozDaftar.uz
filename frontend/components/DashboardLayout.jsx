"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Logo from "./Logo";
import LanguageSwitcher from "./LanguageSwitcher";
import PlanBadge from "./PlanBadge";
import { useSubscriptionFlow } from "./SubscriptionFlow";
import { useAuth } from "@/lib/authContext";
import { useSubscription } from "@/lib/subscriptionContext";
import { useTranslation } from "@/lib/useTranslation";

const NAV_ITEMS = [
  {
    key: "nav.dashboard",
    href: "/dashboard",
    icon: (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    key: "nav.classes",
    href: "/dashboard/classes",
    icon: (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    key: "nav.bsb",
    href: "/dashboard/bsb",
    icon: (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    key: "nav.chsb",
    href: "/dashboard/chsb",
    icon: (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    key: "nav.statistics",
    href: "/dashboard/statistics",
    icon: (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    key: "nav.settings",
    href: "/dashboard/settings",
    icon: (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

function initialsOf(profile) {
  const first = profile?.firstName?.trim()?.[0] || "";
  const last = profile?.lastName?.trim()?.[0] || "";
  return (first + last).toUpperCase() || "U";
}

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { currentUser, userProfile, loading, logout } = useAuth();
  const { plan } = useSubscription();
  const { t } = useTranslation();
  const { openPlanInfo, dialogs } = useSubscriptionFlow();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !currentUser) {
      router.push("/login");
    }
  }, [loading, currentUser, router]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/");
    } catch (e) {
      console.error("Logout error:", e);
    }
  };

  const isActive = (path) => {
    if (path === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(path);
  };

  if (loading || !currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500 font-medium text-sm">{t("loading")}</div>
      </div>
    );
  }

  const fullName = [userProfile?.firstName, userProfile?.lastName].filter(Boolean).join(" ") || currentUser?.email || "";

  const profileCard = (
    <div className="flex items-center gap-3 min-w-0">
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
        {initialsOf(userProfile)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-900">{fullName}</p>
        <div className="mt-0.5 flex items-center gap-1.5">
          <PlanBadge plan={plan} />
          <button
            type="button"
            onClick={openPlanInfo}
            className="rounded-full text-gray-400 transition-colors hover:text-blue-600"
            title={t("subscription.planInfo")}
            aria-label={t("subscription.planInfo")}
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Mobile top bar */}
      <header className="md:hidden bg-white shadow-xs border-b border-gray-200 sticky top-0 z-30 print:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Logo size="small" />
            <span className="text-base font-bold text-gray-900">UstozDaftar.uz</span>
          </Link>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 focus:outline-hidden"
            aria-label="Menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {mobileMenuOpen && (
          <nav className="px-4 pt-2 pb-4 border-t border-gray-100 bg-white space-y-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active ? "bg-blue-50 text-blue-600 font-semibold" : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {item.icon}
                  {t(item.key)}
                </Link>
              );
            })}

            <div className="pt-3 mt-2 border-t border-gray-100 space-y-3">
              {profileCard}
              <div className="flex items-center justify-between gap-3">
                <LanguageSwitcher align="left" />
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  {t("nav.logout")}
                </button>
              </div>
            </div>
          </nav>
        )}
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white shadow-lg fixed h-full z-20 print:hidden">
        <div className="p-5">
          <Link href="/dashboard" className="flex items-center gap-3">
            <Logo size="default" />
            <div>
              <h1 className="text-lg font-bold text-gray-900">UstozDaftar.uz</h1>
              <p className="text-xs text-gray-500">{t("nav.dashboard")}</p>
            </div>
          </Link>
        </div>

        <nav className="mt-2 flex-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors ${
                  active
                    ? "bg-blue-50 text-blue-600 border-r-4 border-blue-600 font-semibold"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                {item.icon}
                {t(item.key)}
              </Link>
            );
          })}
        </nav>

        {/* Profile + language + logout: keeps the switcher out of the content area */}
        <div className="p-4 border-t border-gray-100 space-y-3">
          <Link href="/dashboard/settings" className="block rounded-lg p-2 -m-2 hover:bg-gray-50 transition-colors">
            {profileCard}
          </Link>

          <div className="flex items-center justify-between gap-2">
            <LanguageSwitcher align="left" />
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              {t("nav.logout")}
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 md:ml-64 p-4 sm:p-6 lg:p-8 print:ml-0 print:p-0 min-w-0">
        <div className="max-w-7xl mx-auto w-full">{children}</div>
      </main>

      {dialogs}
    </div>
  );
}
