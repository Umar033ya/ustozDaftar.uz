"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "@/components/theme-provider";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Bosh sahifa", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { href: "/dashboard/analytics", label: "Analitika", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  { href: "/dashboard/users", label: "Foydalanuvchilar", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
  { href: "/dashboard/schools", label: "Maktablar", icon: "M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" },
  { href: "/dashboard/payments", label: "To'lovlar", icon: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" },
  { href: "/dashboard/chat", label: "Xabarlar", icon: "M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" },
  { href: "/dashboard/subscriptions", label: "Obunalar", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
  { href: "/dashboard/audit", label: "Audit jurnali", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
  { href: "/dashboard/settings", label: "Sozlamalar", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" },
];

export function Sidebar({ user }: { user: { email: string | null; uid: string } }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadChats, setUnreadChats] = useState(0);

  // Conversations with unread teacher messages (best effort, every 30 s).
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/admin/chats?count=1", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { unreadThreads?: number };
        if (!cancelled) setUnreadChats(Number(data.unreadThreads) || 0);
      } catch {
        /* keep the last value */
      }
    };
    load();
    const id = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pathname]);

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }, [router]);

  const nav = (
    <nav className="flex-1 space-y-1 px-3 py-4">
      {NAV_ITEMS.map((item) => {
        const active =
          item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100"
            }`}
          >
            <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={item.icon} />
            </svg>
            {item.label}
            {item.href === "/dashboard/chat" && unreadChats > 0 && (
              <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
                {unreadChats > 99 ? "99+" : unreadChats}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const userBlock = (
    <div className="border-t border-gray-200 p-4 space-y-3 dark:border-gray-800">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
          {(user.email?.[0] ?? "A").toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{user.email}</p>
          <p className="text-xs text-blue-600 dark:text-blue-400">Admin</p>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={toggleTheme}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          {theme === "dark" ? "☀️ Yoruq" : "🌙 Tun"}
        </button>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
        >
          {loggingOut ? "Chiqilmoqda..." : "Chiqish"}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900 md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          aria-label="Menyu"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
          UstozDaftar.uz <span className="text-blue-600 dark:text-blue-400">Admin</span>
        </span>
        <div className="w-6" />
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white dark:bg-gray-900">
            {nav}
            {userBlock}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 md:flex">
        <div className="border-b border-gray-200 px-5 py-5 dark:border-gray-800">
          <p className="text-base font-bold text-gray-900 dark:text-gray-100">
            UstozDaftar.uz <span className="text-blue-600 dark:text-blue-400">Admin</span>
          </p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Boshqaruv paneli</p>
        </div>
        {nav}
        {userBlock}
      </aside>
    </>
  );
}