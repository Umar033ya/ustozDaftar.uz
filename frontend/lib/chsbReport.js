/**
 * Pure rules of the ChSB report: question points and everything derived from the
 * correct / wrong marks. Scores are never stored, so the table, the print view and
 * the Excel export cannot disagree with the marks.
 */

export const CHSB_MAX_TOTAL = 40;
export const CHSB_MAX_QUESTIONS = 60;

export function roundScore(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/** 2.6 -> "2,6" (the decimal comma used on the official sheets). */
export function formatScore(value) {
  return String(roundScore(value)).replace(".", ",");
}

/** Accepts both 2.6 and 2,6. Returns null when the text is not a number. */
export function parsePoints(text) {
  const clean = String(text ?? "").trim().replace(",", ".");
  if (clean === "") return null;
  const value = Number(clean);
  return Number.isFinite(value) ? value : null;
}

export function sumPoints(rawPoints) {
  return roundScore((rawPoints || []).reduce((sum, raw) => sum + (parsePoints(raw) ?? 0), 0));
}

/** @returns {{ points: number[], total: number, error: string }} */
export function validateQuestionPoints(rawPoints) {
  const total = sumPoints(rawPoints);
  const points = [];
  for (let i = 0; i < (rawPoints || []).length; i++) {
    const value = parsePoints(rawPoints[i]);
    if (value === null || value <= 0) {
      return { points: [], total, error: `${i + 1}-savol uchun ballni to'g'ri kiriting` };
    }
    points.push(roundScore(value));
  }
  if (points.length === 0) return { points, total, error: "Savollar sonini kiriting" };
  if (total > CHSB_MAX_TOTAL) {
    return { points, total, error: `Savollar bali jami ${CHSB_MAX_TOTAL} balldan oshmasligi kerak (hozir: ${formatScore(total)})` };
  }
  return { points, total, error: "" };
}

const average = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null);

/**
 * @param {{ questions: number[], marks?: Record<string, Record<string, boolean>> }} report
 * @param {{ id: string, name: string }[]} students
 */
export function summarizeChsbReport(report, students) {
  const questions = report?.questions || [];
  const allMarks = report?.marks || {};
  const maxScore = roundScore(questions.reduce((sum, points) => sum + Number(points), 0));

  const rows = (students || []).map((student) => {
    const studentMarks = allMarks[student.id] || {};
    const marks = questions.map((_, q) => (typeof studentMarks[q] === "boolean" ? studentMarks[q] : null));
    const participated = marks.some((mark) => mark !== null);
    const total = participated
      ? roundScore(marks.reduce((sum, mark, q) => sum + (mark === true ? Number(questions[q]) : 0), 0))
      : null;
    return {
      id: student.id,
      studentId: student.id,
      studentName: student.name,
      marks,
      participated,
      total,
      percentage: participated && maxScore > 0 ? roundScore((total / maxScore) * 100) : null,
    };
  });

  // A question only counts the students it was already checked for.
  const questionStats = questions.map((points, q) => {
    const checked = rows.map((row) => row.marks[q]).filter((mark) => mark !== null);
    const correctCount = checked.filter(Boolean).length;
    return {
      checkedCount: checked.length,
      correctCount,
      average: checked.length ? roundScore((correctCount * Number(points)) / checked.length) : null,
      share: checked.length ? Math.round((correctCount / checked.length) * 100) : null,
    };
  });

  const participants = rows.filter((row) => row.participated);
  const averageScore = average(participants.map((row) => row.total));
  const averagePercentage = average(participants.map((row) => row.percentage));

  return {
    maxScore,
    rows,
    questionStats,
    studentCount: rows.length,
    participatedCount: participants.length,
    absentCount: rows.length - participants.length,
    averageScore: averageScore === null ? null : roundScore(averageScore),
    averagePercentage: averagePercentage === null ? null : Math.round(averagePercentage),
  };
}
