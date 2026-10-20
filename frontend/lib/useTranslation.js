"use client";

// Backwards-compatible re-export. The reactive implementation now lives in
// `./i18nContext`, backed by the shared I18nProvider.
export { useTranslation, I18nProvider } from "./i18nContext";
