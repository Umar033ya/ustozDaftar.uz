/**
 * Student name normalization, shared by the /api/extract-students route and the
 * AI import review step.
 *
 * This module is deliberately free of any secret or server-only dependency: it
 * is pure string handling, so the client bundle can use it too. That keeps the
 * review list and the saved records identical — the teacher sees exactly the
 * `Surname FirstName` string that will be written to Firestore.
 *
 * Rules:
 * - Keep only SURNAME + FIRST NAME, dropping the patronymic / father's name.
 * - Recognize explicit patronymic markers (`o'g'li`, `O‘g‘li`, `Ўғли`, `Qizi`,
 *   `Қизи`, ...) and the common Slavic endings (-ovich, -ovna, -yevich, -yevna).
 * - Never delete a third word blindly: a legitimate two-part first name such as
 *   "Karimov Muhammad Ali" is preserved.
 * - Transliterate Uzbek Cyrillic to Latin, keeping the Uzbek special letters
 *   (q, g, h, u from Ў/ў) correct.
 * - Names that are already correct Latin are left untouched.
 * - Original order is preserved, duplicates are removed after normalization.
 */

/** Hard cap on how many students one extraction may return. */
export const MAX_STUDENTS = 20;

// Uzbek Cyrillic -> Uzbek Latin, following the official Uzbek Latin alphabet:
// Cyrillic "х" becomes "x" while "ҳ" becomes "h" (so Холматов -> Xolmatov and
// Шаҳноза -> Shahnoza), and "ў" becomes "u".
//
// Multi-character values are applied in a single left-to-right pass over the
// string (see transliterateUzbekCyrillic), never by sequential per-character
// substitution, so "ц" -> "ts" and "ю" -> "yu" stay correct.
const CYRILLIC_TO_LATIN = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "x", ц: "ts", ч: "ch", ш: "sh", щ: "sh",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  қ: "q", ғ: "g", ҳ: "h", ў: "u",
};

// Mirror the map for uppercase Cyrillic, preserving the capitalised multi-char
// forms ("Ц" -> "Ts", "Ё" -> "Yo").
for (const [cyrillic, latin] of Object.entries(CYRILLIC_TO_LATIN)) {
  CYRILLIC_TO_LATIN[cyrillic.toUpperCase()] =
    latin.charAt(0).toUpperCase() + latin.slice(1);
}

const CYRILLIC_LETTER = /[\u0400-\u04ff]/;
// A separate global copy is used for replacement: `.test()` on a /g regex keeps
// `lastIndex` between calls, which would make `hasCyrillic` unreliable.
const CYRILLIC_LETTER_GLOBAL = /[\u0400-\u04ff]/g;

// Uzbek and typographic apostrophes all collapse to a plain one so that
// "o'g'li", "o‘g‘li" and "oʻgʻli" compare equal.
const APOSTROPHE_VARIANTS = /[\u0027\u02bb\u02bc\u2018\u2019\u00b4\u0060]/g;

/**
 * Explicit patronymic words. These appear after the father's first name, so a
 * hit means everything from the token before the marker on is patronymic.
 */
const PATRONYMIC_MARKERS = new Set([
  "o'g'li", "o'g'lim", "o'g'lisi", "og'li", "ugli", "u'g'li", "g'li",
  "qizi", "qizim", "qizilari", "kizi", "gizi",
]);

/** Slavic patronymic endings. Only inspected on tokens after the first name. */
const PATRONYMIC_SUFFIXES = ["ovich", "ovna", "yevich", "yevna"];

/** @returns {string} true when the text contains any Cyrillic letter */
export function hasCyrillic(value) {
  return CYRILLIC_LETTER.test(value);
}

/** Transliterate Uzbek Cyrillic to Uzbek Latin. Latin input is unchanged. */
export function transliterateUzbekCyrillic(value) {
  if (!hasCyrillic(value)) return value;
  return value.replace(CYRILLIC_LETTER_GLOBAL, (char) => CYRILLIC_TO_LATIN[char] ?? char);
}

/** Collapse whitespace and drop surrounding numbering the model may echo. */
function tidy(value) {
  if (typeof value !== "string") return "";
  return value
    .replace(/\s+/g, " ")
    .replace(/^[\d\s\-–—•*·.[)\]]+/, "")
    .replace(/[\s\-–—•*·.[)\]]+$/, "")
    .trim();
}

function markerKey(token) {
  return token.replace(APOSTROPHE_VARIANTS, "'").toLowerCase();
}

/** True when the token is a patronymic in its own right ("o'g'li", "ovna"). */
function isPatronymicMarker(token) {
  const key = markerKey(token);
  return PATRONYMIC_MARKERS.has(key) || PATRONYMIC_SUFFIXES.includes(key);
}

/** True when the token carries a patronymic ending ("Nurmuhamedovich"). */
function isPatronymicEnding(token) {
  const key = markerKey(token);
  return PATRONYMIC_SUFFIXES.some((suffix) => key.length > suffix.length && key.endsWith(suffix));
}

/**
 * Reduce one extracted name to `Surname FirstName`.
 *
 * @param {unknown} value raw `fullName` from the model
 * @returns {string} normalized name, or "" when nothing usable is left
 */
export function normalizeStudentName(value) {
  const cleaned = tidy(value);
  if (!cleaned) return "";

  const tokens = transliterateUzbekCyrillic(cleaned).split(" ").filter(Boolean);
  if (tokens.length <= 2) return tokens.join(" ");

  // An explicit marker ("... Umarjon o'g'li") means the token right before it is
  // the father's first name, so it goes too. Surname + first name are always kept.
  const markerIndex = tokens.findIndex(isPatronymicMarker);
  if (markerIndex !== -1) {
    return tokens.slice(0, Math.max(2, markerIndex - 1)).join(" ");
  }

  // Otherwise only cut at a real patronymic ending, so a two-part first name
  // ("Muhammad Ali") survives while "Fotima Nurmuhamedovich" is trimmed.
  const patronymicIndex = tokens.findIndex((token, index) => index >= 2 && isPatronymicEnding(token));
  const end = patronymicIndex === -1 ? tokens.length : patronymicIndex;

  return tokens.slice(0, end).join(" ");
}

/**
 * Comparison key for a name. Both sides are normalized first, so a roster entry
 * typed as "Yakubov Abdulla Umarjon o'g'li" still matches "Yakubov Abdulla".
 *
 * @returns {string} empty string when the name carries no usable content
 */
export function nameKey(value) {
  return normalizeStudentName(value).toLowerCase();
}

/**
 * Normalize, de-duplicate (preserving first-seen order) and cap a list of names.
 *
 * @param {unknown[]} values raw names from the model
 * @returns {string[]} normalized names in their original order
 */
export function normalizeStudentNames(values) {
  const result = [];
  const seen = new Set();

  for (const value of Array.isArray(values) ? values : []) {
    const name = normalizeStudentName(value);
    if (!name) continue;

    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    result.push(name);
    if (result.length >= MAX_STUDENTS) break;
  }

  return result;
}
