"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import {
  DEFAULT_LANG,
  STORAGE_KEY,
  SUPPORTED_LANGS,
  interpolate,
  languages,
  persistLang,
  readStoredLang,
  translate,
} from "./i18n";

/**
 * localStorage is the external store. `useSyncExternalStore` gives every
 * consumer the same value and re-renders them all on change, while the
 * server snapshot keeps SSR and the hydration render deterministic.
 */
const listeners = new Set();

function subscribe(listener) {
  listeners.add(listener);
  const onStorage = (event) => {
    if (!event.key || event.key === STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function emit() {
  for (const listener of listeners) listener();
}

function getSnapshot() {
  return readStoredLang() || DEFAULT_LANG;
}

function getServerSnapshot() {
  return DEFAULT_LANG;
}

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const lang = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Keep the document language attribute in sync (pure DOM sync, no state).
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = languages[lang]?.htmlLang || "uz";
    }
  }, [lang]);

  const changeLanguage = useCallback((next) => {
    if (!SUPPORTED_LANGS.includes(next)) return;
    persistLang(next);
    emit();
  }, []);

  const t = useCallback((key, vars) => interpolate(translate(lang, key), vars), [lang]);

  const value = useMemo(
    () => ({ lang, t, changeLanguage, languages, supportedLangs: SUPPORTED_LANGS }),
    [lang, t, changeLanguage]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Access the active language and translator. Falls back to a standalone
 * translator outside a provider so isolated rendering never crashes.
 */
export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;

  return {
    lang: DEFAULT_LANG,
    t: (key, vars) => interpolate(translate(DEFAULT_LANG, key), vars),
    changeLanguage: () => {},
    languages,
    supportedLangs: SUPPORTED_LANGS,
  };
}
