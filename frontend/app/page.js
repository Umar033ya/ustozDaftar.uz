"use client";

import Link from "next/link";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import Logo from "@/components/Logo";
import LandingNav from "@/components/landing/LandingNav";
import HeroMockup from "@/components/landing/HeroMockup";
import Reveal from "@/components/landing/Reveal";
import { useAuth } from "@/lib/authContext";
import { useTranslation } from "@/lib/useTranslation";

const DOC_ICON = "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z";

const FEATURE_CARDS = [
  { key: "feature.bsb", tone: "blue", icon: DOC_ICON },
  { key: "feature.chsb", tone: "green", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
  { key: "feature.autoCalc", tone: "amber", icon: "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" },
  { key: "feature.excelExport", tone: "green", icon: "M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  { key: "feature.charts", tone: "violet", icon: "M11 3.055A9.001 9.001 0 1020.945 13H11V3.055zM20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" },
  { key: "feature.printReady", tone: "blue", icon: "M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" },
];

const TONES = {
  blue: "bg-blue-50 text-blue-600 ring-blue-100 group-hover:bg-blue-600",
  green: "bg-emerald-50 text-emerald-600 ring-emerald-100 group-hover:bg-emerald-600",
  amber: "bg-amber-50 text-amber-600 ring-amber-100 group-hover:bg-amber-500",
  violet: "bg-violet-50 text-violet-600 ring-violet-100 group-hover:bg-violet-600",
};

const STEPS = ["steps.step1", "steps.step2", "steps.step3"];
const HERO_POINTS = ["landing.hero.point1", "landing.hero.point2", "landing.hero.point3"];
const PAIN_ROWS = [1, 2, 3, 4];

function Check({ className = "" }) {
  return (
    <svg className={`h-4 w-4 shrink-0 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function SectionHeading({ title, subtitle }) {
  return (
    <Reveal className="mx-auto mb-10 sm:mb-14 max-w-2xl text-center">
      <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-gray-900">{title}</h2>
      {subtitle && <p className="mt-3 text-base sm:text-lg text-gray-600">{subtitle}</p>}
    </Reveal>
  );
}

export default function Home() {
  const { currentUser } = useAuth();
  const { t } = useTranslation();
  const startHref = currentUser ? "/dashboard" : "/register";

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <LandingNav />

      {/* Hero — slides under the transparent sticky nav */}
      <div className="relative -mt-16 overflow-hidden pt-16 notebook-paper">
        <div aria-hidden className="pointer-events-none absolute -top-32 -right-24 h-96 w-96 rounded-full bg-blue-300/30 blur-3xl animate-drift" />
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/2 -left-32 h-80 w-80 rounded-full bg-emerald-300/25 blur-3xl animate-drift"
          style={{ animationDelay: "-9s" }}
        />

        <section className="relative">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-8 sm:px-6 sm:pb-24 sm:pt-14 lg:grid-cols-2 lg:gap-8 lg:px-8">
            <div className="text-center lg:text-left">
              <h1
                className="text-[2rem] leading-[1.15] sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-900 animate-fade-up"
                style={{ animationDelay: "80ms" }}
              >
                {t("landing.hero.title")}{" "}
                <span className="relative whitespace-nowrap text-blue-600">
                  {t("landing.hero.titleAccent")}
                  <svg aria-hidden viewBox="0 0 300 12" className="absolute -bottom-2 left-0 h-3 w-full text-emerald-400" preserveAspectRatio="none">
                    <path d="M2 9 C 80 2, 200 2, 298 8" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" />
                  </svg>
                </span>
              </h1>

              <p
                className="mx-auto mt-6 max-w-xl text-base sm:text-lg text-gray-600 lg:mx-0 animate-fade-up"
                style={{ animationDelay: "160ms" }}
              >
                {t("landing.hero.subtitle")}
              </p>

              <div
                className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start animate-fade-up"
                style={{ animationDelay: "240ms" }}
              >
                <Link
                  href={startHref}
                  className="group inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-600/30 transition-all hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-xl"
                >
                  {currentUser ? t("nav.dashboard") : t("home.hero.start")}
                  <svg className="h-5 w-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
                {!currentUser && (
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center rounded-xl bg-white px-7 py-3.5 text-base font-semibold text-gray-800 shadow-sm ring-1 ring-gray-200 transition-all hover:-translate-y-0.5 hover:ring-blue-300"
                  >
                    {t("home.hero.login")}
                  </Link>
                )}
              </div>

              <ul
                className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-gray-600 lg:justify-start animate-fade-up"
                style={{ animationDelay: "320ms" }}
              >
                {HERO_POINTS.map((key) => (
                  <li key={key} className="flex items-center gap-1.5">
                    <Check className="text-emerald-500" />
                    {t(key)}
                  </li>
                ))}
              </ul>
            </div>

            <div className="animate-fade-up px-2 sm:px-6" style={{ animationDelay: "200ms" }}>
              <HeroMockup />
            </div>
          </div>
        </section>
      </div>

      {/* Before / after */}
      <section className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <SectionHeading title={t("landing.pain.title")} subtitle={t("landing.pain.subtitle")} />
          <div className="grid gap-5 md:grid-cols-2">
            <Reveal className="rounded-2xl border border-gray-200 bg-gray-50 p-6 sm:p-7">
              <p className="mb-5 inline-flex rounded-full bg-gray-200 px-3 py-1 text-xs font-bold uppercase tracking-wide text-gray-600">
                {t("landing.pain.before")}
              </p>
              <ul className="space-y-3.5">
                {PAIN_ROWS.map((n) => (
                  <li key={n} className="flex gap-3 text-sm sm:text-base text-gray-500">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-500">
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </span>
                    <span className="line-through decoration-gray-300">{t(`landing.pain.before${n}`)}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={120} className="relative rounded-2xl bg-gradient-to-br from-blue-600 to-emerald-600 p-6 sm:p-7 text-white shadow-xl shadow-blue-600/20">
              <p className="mb-5 inline-flex rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wide">
                {t("landing.pain.after")}
              </p>
              <ul className="space-y-3.5">
                {PAIN_ROWS.map((n) => (
                  <li key={n} className="flex gap-3 text-sm sm:text-base">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-emerald-600">
                      <Check className="h-3 w-3" />
                    </span>
                    {t(`landing.pain.after${n}`)}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-20 bg-gray-50 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading title={t("home.features.title")} subtitle={t("landing.features.subtitle")} />
          <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURE_CARDS.map((card, i) => (
              <Reveal
                key={card.key}
                delay={(i % 3) * 90}
                className="group rounded-2xl border border-gray-200 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-transparent hover:shadow-xl hover:shadow-gray-200/70"
              >
                <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ring-1 transition-colors duration-300 group-hover:text-white ${TONES[card.tone]}`}>
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={card.icon} />
                  </svg>
                </div>
                <h3 className="mb-1.5 text-lg font-semibold text-gray-900">{t(card.key)}</h3>
                <p className="text-sm sm:text-base text-gray-600">{t(`${card.key}.desc`)}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-20 bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHeading title={t("home.howItWorks.title")} subtitle={t("landing.steps.subtitle")} />
          <div className="relative grid gap-10 md:grid-cols-3 md:gap-8">
            <div aria-hidden className="absolute left-[16.6%] right-[16.6%] top-8 hidden border-t-2 border-dashed border-blue-200 md:block" />
            {STEPS.map((step, index) => (
              <Reveal key={step} delay={index * 140} className="relative text-center">
                <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-2xl font-bold text-white shadow-lg shadow-blue-600/30 rotate-3 transition-transform hover:rotate-0">
                  {index + 1}
                </div>
                <h3 className="mb-2 text-lg sm:text-xl font-semibold text-gray-900">{t(`${step}.title`)}</h3>
                <p className="mx-auto max-w-xs text-sm sm:text-base text-gray-600">{t(`${step}.desc`)}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-16 sm:px-6 sm:pb-24 lg:px-8">
        <Reveal className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-blue-700 to-emerald-600 px-6 py-12 text-center shadow-2xl shadow-blue-700/25 sm:px-12 sm:py-16">
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl animate-drift" />
          <div aria-hidden className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-emerald-300/20 blur-2xl animate-drift" style={{ animationDelay: "-7s" }} />
          <h2 className="relative text-2xl sm:text-4xl font-bold text-white">{t("home.cta.title")}</h2>
          <p className="relative mx-auto mt-3 max-w-2xl text-base sm:text-lg text-blue-50">{t("home.cta.subtitle")}</p>
          <p className="relative mx-auto mt-2 max-w-2xl text-sm text-blue-100/90">{t("home.plans.note")}</p>
          <Link
            href={startHref}
            className="relative mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-base font-semibold text-blue-700 shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"
          >
            {currentUser ? t("nav.dashboard") : t("home.cta.button")}
          </Link>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-gray-800 bg-gray-900 py-8 text-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <Logo size="small" />
            <p className="text-center text-sm text-gray-400 sm:text-left">{t("home.footer")}</p>
          </div>
          <LanguageSwitcher variant="dark" />
        </div>
      </footer>
    </div>
  );
}
