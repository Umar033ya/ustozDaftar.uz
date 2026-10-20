"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/lib/useTranslation";

/**
 * Compact language dropdown.
 *
 * `variant` adapts the colours for light surfaces (default) and dark surfaces
 * (e.g. the landing footer). `align` controls which edge the menu opens from.
 * The menu automatically opens upward when there's insufficient space below.
 */
export default function LanguageSwitcher({ variant = "light", align = "right" }) {
  const { lang, languages, changeLanguage, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState("bottom");
  const rootRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    // Calculate available space and determine menu position
    const updatePosition = () => {
      if (rootRef.current && menuRef.current) {
        const triggerRect = rootRef.current.getBoundingClientRect();
        const menuHeight = menuRef.current.offsetHeight || 150; // Approximate height if not rendered
        const spaceBelow = window.innerHeight - triggerRect.bottom;
        const spaceAbove = triggerRect.top;

        // Open upward if there's less than menuHeight + 20px buffer below
        if (spaceBelow < menuHeight + 20 && spaceAbove > spaceBelow) {
          setMenuPosition("top");
        } else {
          setMenuPosition("bottom");
        }
      }
    };

    updatePosition();

    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open]);

  const current = languages[lang] || languages["uz-latin"];

  const triggerClass =
    variant === "dark"
      ? "border-gray-700 bg-gray-800 text-gray-200 hover:bg-gray-700"
      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50";

  const menuClass =
    variant === "dark"
      ? "border-gray-700 bg-gray-800 text-gray-200"
      : "border-gray-200 bg-white text-gray-700";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("lang.switcher")}
        title={t("lang.switcher")}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${triggerClass}`}
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 010 18M12 3a15 15 0 000 18M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>{current.label}</span>
        <svg
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <ul
          ref={menuRef}
          role="listbox"
          className={`absolute z-50 min-w-[11rem] overflow-hidden rounded-lg border shadow-lg ${menuClass} ${
            align === "right" ? "right-0" : "left-0"
          } ${
            menuPosition === "top"
              ? "bottom-full mb-1"
              : "top-full mt-1"
          }`}
        >
          {Object.values(languages).map((item) => {
            const active = item.code === lang;
            return (
              <li key={item.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    changeLanguage(item.code);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs font-medium transition-colors ${
                    active
                      ? variant === "dark"
                        ? "bg-blue-600/20 text-blue-300"
                        : "bg-blue-50 text-blue-700"
                      : variant === "dark"
                        ? "hover:bg-gray-700"
                        : "hover:bg-gray-50"
                  }`}
                >
                  <span>{item.name}</span>
                  {active && (
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
