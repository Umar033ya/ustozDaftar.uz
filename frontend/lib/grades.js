/**
 * Table settings of a teacher (users/{uid}.tableSettings) and the rule that turns
 * a percentage into a 5-point grade. Shared by the result tables, the ChSB report
 * and the Excel export so they always show the same grade.
 */

export const GRADE_LEVELS = [5, 4, 3, 2];

/** Lowest percentage of each grade; everything below the grade 2 limit is a 1. */
export const DEFAULT_GRADE_THRESHOLDS = Object.freeze({ 5: 86, 4: 71, 3: 56, 2: 31 });

export function normalizeThresholds(raw) {
  const thresholds = {};
  for (const grade of GRADE_LEVELS) {
    const value = Number(raw?.[grade]);
    thresholds[grade] = Number.isFinite(value) ? value : DEFAULT_GRADE_THRESHOLDS[grade];
  }
  return thresholds;
}

export function normalizeTableSettings(raw) {
  return {
    showGrade: raw?.showGrade === true,
    gradeThresholds: normalizeThresholds(raw?.gradeThresholds),
  };
}

/** Empty string when valid, otherwise the message to show to the teacher. */
export function validateGradeThresholds(thresholds) {
  let previous = 101;
  for (const grade of GRADE_LEVELS) {
    const raw = thresholds?.[grade];
    const value = Number(raw);
    if (raw === "" || raw === null || raw === undefined || !Number.isFinite(value)) {
      return `${grade} baho uchun foizni kiriting`;
    }
    if (value <= 0 || value > 100) return "Foiz 1 dan 100 gacha bo'lishi kerak";
    if (value >= previous) return "Yuqori baho foizi pastki bahodan katta bo'lishi kerak";
    previous = value;
  }
  return "";
}

/** 1-5 for a percentage, null when there is no result to grade. */
export function gradeFromPercentage(percentage, thresholds = DEFAULT_GRADE_THRESHOLDS) {
  if (percentage === "" || percentage === null || percentage === undefined) return null;
  const value = Number(percentage);
  if (!Number.isFinite(value)) return null;
  // 85.99999 from floating point arithmetic must not lose a grade
  const rounded = Math.round(value * 100) / 100;
  const limits = normalizeThresholds(thresholds);
  for (const grade of GRADE_LEVELS) {
    if (rounded >= limits[grade]) return grade;
  }
  return 1;
}

/** The name printed under the tables: the name of the signed-in account. */
export function teacherFullName(profile) {
  return [profile?.firstName, profile?.lastName]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" ");
}
