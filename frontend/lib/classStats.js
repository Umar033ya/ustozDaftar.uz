import { isResultEntered } from "./resultStats.js";

/**
 * Class statistics for the statistics page — pure, so it is unit-tested.
 *
 * Every student of the class roster appears in `studentRows`, also the ones
 * with no entered result (entered: false), so nobody silently disappears from
 * a chart. A real 0 counts; an empty cell does not.
 *
 * @param {{ assessments: object[], students: { id: string, name: string }[],
 *           filters?: { type?: string, subject?: string, assessmentId?: string } }} input
 */
export function computeClassStats({ assessments, students, filters = {} }) {
  const selected = assessments.filter(
    (a) =>
      (!filters.type || a.type === filters.type) &&
      (!filters.subject || a.subject === filters.subject) &&
      (!filters.assessmentId || a.id === filters.assessmentId)
  );

  const percentages = [];
  const perStudent = new Map(students.map((s) => [s.id, []]));
  const assessmentRows = [];

  for (const a of selected) {
    const entered = (a.results || []).filter((r) => isResultEntered(r, a.type));
    const values = entered.map((r) => Number(r.percentage) || 0);
    percentages.push(...values);
    for (const r of entered) {
      const list = perStudent.get(r.studentId || r.id);
      if (list) list.push(Number(r.percentage) || 0);
    }
    assessmentRows.push({
      studentName: `${a.type} ${a.number ?? ""} · ${a.subject || ""}`.trim(),
      entered: values.length > 0,
      percentage: values.length ? values.reduce((x, y) => x + y, 0) / values.length : 0,
    });
  }

  const studentRows = students.map((s) => {
    const list = perStudent.get(s.id) || [];
    return {
      studentId: s.id,
      studentName: s.name,
      entered: list.length > 0,
      count: list.length,
      percentage: list.length ? list.reduce((x, y) => x + y, 0) / list.length : 0,
    };
  });

  const average = percentages.length ? percentages.reduce((x, y) => x + y, 0) / percentages.length : null;
  return {
    assessments: selected,
    summary: {
      assessmentCount: selected.length,
      resultCount: percentages.length,
      averagePercentage: average === null ? null : average.toFixed(1),
      highPerformers: percentages.filter((p) => p >= 80).length,
      needsImprovement: percentages.filter((p) => p < 60).length,
      studentsWithResults: studentRows.filter((r) => r.entered).length,
      studentCount: students.length,
    },
    studentRows,
    assessmentRows: assessmentRows.reverse(), // oldest first, as a timeline
  };
}

/** Distinct, sorted values for the filter dropdowns. */
export function filterOptions(assessments) {
  const uniq = (list) => [...new Set(list.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "uz"));
  return { types: uniq(assessments.map((a) => a.type)), subjects: uniq(assessments.map((a) => a.subject)) };
}
