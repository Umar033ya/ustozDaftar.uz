/**
 * Student name handling, shared by the /api/extract-students route and the
 * AI import review step.
 *
 * This module is deliberately free of any secret or server-only dependency: it
 * is pure string handling, so the client bundle can use it too. That keeps the
 * review list and the saved records identical — the teacher sees exactly the
 * string that will be written to Firestore.
 *
 * Rules:
 * - The script is never changed. Cyrillic stays Cyrillic, Latin stays Latin.
 *   Transliteration is used only to build comparison keys, never for output.
 * - Keep SURNAME + FIRST NAME and drop the patronymic, recognising markers in
 *   both scripts (`o'g'li`, `qizi`, `ўғли`, `қизи`, -ovich/-ович, -ovna/-овна).
 * - Never delete a third word blindly: "Karimov Muhammad Ali" is preserved.
 * - Nothing is dropped silently. Duplicates, suspicious entries and names that
 *   were shortened are returned with a status so the teacher can decide.
 */

/** Upper bound on one extraction; large enough for any real class list. */
export const MAX_STUDENTS = 60;

// Uzbek Cyrillic -> Uzbek Latin following the official alphabet (Ў -> Oʻ,
// Ғ -> Gʻ, Ҳ -> H, Х -> X). Only used for comparison keys.
const CYRILLIC_TO_LATIN = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "x", ц: "ts", ч: "ch", ш: "sh", щ: "sh",
  ъ: "'", ы: "i", ь: "", э: "e", ю: "yu", я: "ya",
  қ: "q", ғ: "g'", ҳ: "h", ў: "o'",
};

for (const [cyrillic, latin] of Object.entries(CYRILLIC_TO_LATIN)) {
  CYRILLIC_TO_LATIN[cyrillic.toUpperCase()] = latin.charAt(0).toUpperCase() + latin.slice(1);
}

const CYRILLIC_LETTER = /[Ѐ-ӿ]/;
// A separate global copy is used for replacement: `.test()` on a /g regex keeps
// `lastIndex` between calls.
const CYRILLIC_LETTER_GLOBAL = /[Ѐ-ӿ]/g;
const LATIN_LETTER = /[A-Za-zÀ-ɏ]/;

// Uzbek and typographic apostrophes, all compared as one.
const APOSTROPHE_VARIANTS = /['ʻʼ‘’´`]/g;

/** Explicit patronymic words, compared after apostrophe unification. */
const PATRONYMIC_MARKERS = new Set([
  "o'g'li", "o'g'lim", "o'g'lisi", "og'li", "ogli", "ugli", "u'g'li", "g'li",
  "qizi", "qizim", "kizi", "gizi",
  "ўғли", "угли", "ўгли", "оғли", "қизи", "кизи",
]);

/** Slavic patronymic endings in both scripts. */
const PATRONYMIC_SUFFIXES = [
  "ovich", "ovna", "yevich", "yevna", "evich", "evna",
  "ович", "овна", "евич", "евна",
];

/** @returns {boolean} true when the text contains any Cyrillic letter */
export function hasCyrillic(value) {
  return CYRILLIC_LETTER.test(value);
}

/** "cyrillic" | "latin" | "mixed" | "none" */
export function detectScript(value) {
  const cyr = CYRILLIC_LETTER.test(value);
  const lat = LATIN_LETTER.test(value);
  if (cyr && lat) return "mixed";
  if (cyr) return "cyrillic";
  if (lat) return "latin";
  return "none";
}

/** Transliterate Uzbek Cyrillic to Uzbek Latin. Used only for comparison keys. */
export function transliterateUzbekCyrillic(value) {
  if (!hasCyrillic(value)) return value;
  return value.replace(CYRILLIC_LETTER_GLOBAL, (char) => CYRILLIC_TO_LATIN[char] ?? char);
}

/**
 * Whitespace/numbering cleanup that keeps every letter as written.
 * Unicode NFC folds decomposed letters (e.g. "й" typed as и + breve) so equal
 * names are stored identically.
 */
export function cleanStudentName(value) {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFC")
    .replace(/[​-‍﻿]/g, "")
    .replace(/\s+/g, " ")
    // leading list numbering the model may echo: "1.", "12)", "3 -", "•"
    .replace(/^\s*(?:\d{1,3}\s*[.)\-–—:]?\s+|[•*·\-–—]\s*)/, "")
    .replace(/[\s,;•*·.\-–—]+$/, "")
    .replace(/^[\s,;]+/, "")
    .trim();
}

function markerKey(token) {
  return token.replace(APOSTROPHE_VARIANTS, "'").toLowerCase();
}

function isPatronymicMarker(token) {
  const key = markerKey(token);
  return PATRONYMIC_MARKERS.has(key) || PATRONYMIC_SUFFIXES.includes(key);
}

function isPatronymicEnding(token) {
  const key = markerKey(token);
  return PATRONYMIC_SUFFIXES.some((suffix) => key.length > suffix.length + 1 && key.endsWith(suffix));
}

/**
 * Reduce one name to `Surname FirstName` without changing its script.
 *
 * @param {unknown} value raw name
 * @returns {string} normalized name, or "" when nothing usable is left
 */
export function normalizeStudentName(value) {
  const cleaned = cleanStudentName(value);
  if (!cleaned) return "";

  const tokens = cleaned.split(" ").filter(Boolean);
  if (tokens.length <= 2) return tokens.join(" ");

  // "... Umarjon o'g'li" / "... Умаржон ўғли": the token before the marker is
  // the father's name, so it goes too. Surname + first name are always kept.
  const markerIndex = tokens.findIndex(isPatronymicMarker);
  if (markerIndex !== -1) {
    return tokens.slice(0, Math.max(2, markerIndex - 1)).join(" ");
  }

  // Otherwise cut only at a real patronymic ending, so "Muhammad Ali" survives.
  const patronymicIndex = tokens.findIndex((token, index) => index >= 2 && isPatronymicEnding(token));
  const end = patronymicIndex === -1 ? tokens.length : patronymicIndex;
  return tokens.slice(0, end).join(" ");
}

/**
 * Same-script comparison key: case, spacing and apostrophe style are ignored.
 * "O‘tkir Karimov" == "o'tkir  karimov", but "Ўткир" != "O‘tkir".
 */
export function nameKey(value) {
  return normalizeStudentName(value)
    .replace(APOSTROPHE_VARIANTS, "'")
    .toLocaleLowerCase("uz");
}

/**
 * Cross-script key, used only to *warn* about a probable duplicate written in
 * the other alphabet ("Ўткир Каримов" vs "O‘tkir Karimov", "Шаҳзода" vs
 * "Shaxzoda"). Lenient on purpose; it never decides anything on its own.
 */
export function looseNameKey(value) {
  return transliterateUzbekCyrillic(normalizeStudentName(value))
    .toLowerCase()
    .replace(APOSTROPHE_VARIANTS, "")
    .replace(/x/g, "h")
    .replace(/ye/g, "e")
    .replace(/[^a-z\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** A name that is worth a second look before saving. */
function suspicionReason(name) {
  if (/\d/.test(name)) return "digits";
  if (detectScript(name) === "mixed") return "mixed_script";
  if (name.split(" ").length < 2) return "single_word";
  if (/[^\p{L}\p{M}\s'ʻʼ‘’\-.]/u.test(name)) return "symbols";
  return null;
}

/**
 * Turn raw extracted names into review entries. Order is preserved and no
 * entry is removed: every input line produces exactly one entry, so the
 * teacher always sees what the model returned.
 *
 * @param {unknown[]} values strings or `{ name | fullName, uncertain }`
 * @returns {{
 *   entries: { fullName: string, original: string, status: "ok" | "duplicate" | "empty",
 *              warnings: string[], uncertain: boolean }[],
 *   truncated: number
 * }}
 */
export function analyzeStudentNames(values) {
  const list = Array.isArray(values) ? values : [];
  const entries = [];
  const firstByKey = new Map();
  const firstByLooseKey = new Map();

  for (const value of list.slice(0, MAX_STUDENTS)) {
    const raw =
      typeof value === "string"
        ? value
        : typeof value?.name === "string"
          ? value.name
          : typeof value?.fullName === "string"
            ? value.fullName
            : "";
    const uncertain = Boolean(value && typeof value === "object" && value.uncertain);
    const original = cleanStudentName(raw);
    const fullName = normalizeStudentName(raw);
    const warnings = [];

    if (!fullName) {
      entries.push({ fullName: "", original, status: "empty", warnings: ["empty"], uncertain });
      continue;
    }

    if (fullName !== original) warnings.push("shortened");
    if (uncertain) warnings.push("uncertain");
    const reason = suspicionReason(fullName);
    if (reason) warnings.push(reason);

    const key = nameKey(fullName);
    const looseKey = looseNameKey(fullName);
    let status = "ok";
    if (firstByKey.has(key)) {
      status = "duplicate";
    } else if (looseKey && firstByLooseKey.has(looseKey)) {
      warnings.push("possible_duplicate");
    }
    if (!firstByKey.has(key)) firstByKey.set(key, entries.length);
    if (looseKey && !firstByLooseKey.has(looseKey)) firstByLooseKey.set(looseKey, entries.length);

    entries.push({ fullName, original, status, warnings, uncertain });
  }

  return { entries, truncated: Math.max(0, list.length - MAX_STUDENTS) };
}

/**
 * Backwards-compatible helper: normalized, de-duplicated names in order.
 * Prefer analyzeStudentNames, which never hides anything.
 */
export function normalizeStudentNames(values) {
  return analyzeStudentNames(values)
    .entries.filter((entry) => entry.status === "ok")
    .map((entry) => entry.fullName);
}
