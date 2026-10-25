/**
 * Shared rule for "has this student's result been entered?".
 *
 * A real score of 0 is a result; an empty cell is not. Filtering on
 * `total > 0` (the previous rule) dropped students who scored 0 from every
 * average and made the lowest score wrong.
 */
export function isResultEntered(result, type) {
  if (!result) return false;
  if (type === "BSB") {
    return (result.scores || []).some((s) => s !== "" && s !== null && s !== undefined && !Number.isNaN(Number(s)));
  }
  return result.total !== "" && result.total !== null && result.total !== undefined && !Number.isNaN(Number(result.total));
}

const isScore = (s) => s !== "" && s !== null && s !== undefined && !Number.isNaN(Number(s));
const mean = (list) => list.reduce((a, b) => a + b, 0) / list.length;

/**
 * Statistics of one assessment, used by the result page, its charts and the
 * Excel export so they always agree.
 *
 * Only entered results count. When nothing has been entered yet the averages
 * and extremes are null (shown as "—"), never a fake 0.
 *
 * @returns {{ studentCount: number, completedCount: number, averageScore: string | null,
 *             averagePercentage: string | null, highestScore: number | null, lowestScore: number | null,
 *             taskAverages: (string | null)[], maxTotal?: number, maxScore?: number } | null}
 */
export function summarizeAssessment(assessment, results) {
  if (!assessment || !results || results.length === 0) return null;
  const type = assessment.type;
  const entered = results.filter((r) => isResultEntered(r, type));
  const totals = entered.map((r) =>
    type === "BSB" ? (r.scores || []).reduce((sum, s) => sum + (isScore(s) ? Number(s) : 0), 0) : Number(r.total)
  );
  const percentages = entered.map((r) => Number(r.percentage) || 0);

  const taskAverages = (type === "BSB" ? assessment.tasks || [] : []).map((task, index) => {
    const scores = entered.map((r) => (r.scores || [])[index]).filter(isScore).map(Number);
    if (scores.length === 0 || !(task.maxScore > 0)) return null;
    return ((mean(scores) / task.maxScore) * 100).toFixed(1);
  });

  return {
    ...(type === "BSB" ? { maxTotal: assessment.maxTotal } : { maxScore: assessment.maxScore }),
    studentCount: results.length,
    completedCount: entered.length,
    averageScore: entered.length ? mean(totals).toFixed(1) : null,
    averagePercentage: entered.length ? mean(percentages).toFixed(1) : null,
    highestScore: entered.length ? Math.max(...totals) : null,
    lowestScore: entered.length ? Math.min(...totals) : null,
    taskAverages,
  };
}
