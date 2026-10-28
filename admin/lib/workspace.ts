import { toMillis } from "@/lib/format";
import type {
  AssessmentType,
  WorkspaceAssessment,
  WorkspaceClass,
  WorkspaceCounts,
  WorkspaceResult,
  UserWorkspace,
} from "@/lib/types";

/**
 * Read-only view of a teacher's workspace for the admin panel.
 *
 * The main app keeps a teacher's whole workspace inside `users/{uid}`
 * (see frontend/lib/firestoreService.js):
 *
 *   classes/{classId}         -> name, academicYear, createdAt, students/{studentId} -> { name, createdAt }
 *   assessments/{id}          -> type ("BSB" | "ChSB"), classId, className, subject, number, date,
 *                                tasks, maxTotal | maxScore, createdAt, results/{studentId}
 *
 * "Entered" mirrors frontend/lib/resultStats.js isResultEntered so the panel
 * and the teacher's own pages count the same results.
 */

type RawMap = Record<string, unknown>;

function asMap(value: unknown): RawMap {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as RawMap) : {};
}

const isScore = (s: unknown) => s !== "" && s !== null && s !== undefined && !Number.isNaN(Number(s));

function normalizeType(value: unknown): AssessmentType {
  return value === "BSB" ? "BSB" : "ChSB";
}

export function isResultEntered(result: RawMap, type: AssessmentType): boolean {
  if (type === "BSB") return Array.isArray(result.scores) && result.scores.some(isScore);
  return isScore(result.total);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function toClass(id: string, raw: unknown): WorkspaceClass {
  const data = asMap(raw);
  const students = Object.entries(asMap(data.students))
    .map(([sid, s]) => ({ id: sid, name: String(asMap(s).name ?? ""), createdAt: toMillis(asMap(s).createdAt) ?? 0 }))
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  return {
    id,
    name: String(data.name ?? ""),
    academicYear: String(data.academicYear ?? ""),
    createdAt: toMillis(data.createdAt),
    createdByAdmin: data.createdByAdmin === true,
    students,
  };
}

function toAssessment(id: string, raw: unknown): WorkspaceAssessment {
  const data = asMap(raw);
  const type = normalizeType(data.type);
  const tasks = Array.isArray(data.tasks) ? data.tasks.map((t) => asMap(t)) : [];

  const results: WorkspaceResult[] = Object.entries(asMap(data.results))
    .map(([rid, r]) => {
      const row = asMap(r);
      const entered = isResultEntered(row, type);
      return {
        studentId: String(row.studentId ?? rid),
        studentName: String(row.studentName ?? ""),
        scores: type === "BSB" && Array.isArray(row.scores) ? row.scores.map((s) => (isScore(s) ? Number(s) : null)) : [],
        total: entered && isScore(row.total) ? Number(row.total) : null,
        percentage: entered && isScore(row.percentage) ? round1(Number(row.percentage)) : null,
      };
    })
    .sort((a, b) => a.studentName.localeCompare(b.studentName, "uz"));

  const entered = results.filter((r) => r.percentage !== null);
  const averagePercentage =
    entered.length > 0 ? round1(entered.reduce((sum, r) => sum + (r.percentage ?? 0), 0) / entered.length) : null;

  const maxValue = type === "BSB" ? data.maxTotal : data.maxScore;
  return {
    id,
    type,
    classId: String(data.classId ?? ""),
    className: String(data.className ?? ""),
    academicYear: String(data.academicYear ?? ""),
    subject: String(data.subject ?? ""),
    number: data.number === undefined || data.number === null ? null : String(data.number),
    date: String(data.date ?? ""),
    maxScore: isScore(maxValue) ? Number(maxValue) : null,
    taskMaxScores: tasks.map((t) => (isScore(t.maxScore) ? Number(t.maxScore) : null)),
    createdAt: toMillis(data.createdAt),
    results,
    enteredCount: entered.length,
    averagePercentage,
  };
}

/** Counters only — cheap enough to run for every user in the list. */
export function summarizeWorkspace(data: unknown): WorkspaceCounts {
  const doc = asMap(data);
  const classes = Object.values(asMap(doc.classes));
  const assessments = Object.values(asMap(doc.assessments)).map(asMap);

  let lastActivity: number | null = null;
  const touch = (value: unknown) => {
    const ms = toMillis(value);
    if (ms && (lastActivity === null || ms > lastActivity)) lastActivity = ms;
  };
  classes.forEach((c) => touch(asMap(c).createdAt));
  assessments.forEach((a) => touch(a.createdAt));

  return {
    classCount: classes.length,
    studentCount: classes.reduce<number>((sum, c) => sum + Object.keys(asMap(asMap(c).students)).length, 0),
    bsbCount: assessments.filter((a) => normalizeType(a.type) === "BSB").length,
    chsbCount: assessments.filter((a) => normalizeType(a.type) === "ChSB").length,
    assessmentCount: assessments.length,
    lastActivity,
  };
}

/** Full workspace of one teacher: classes with rosters, assessments with results. */
export function buildWorkspace(data: unknown): UserWorkspace {
  const doc = asMap(data);
  const classes = Object.entries(asMap(doc.classes))
    .map(([id, raw]) => toClass(id, raw))
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0) || a.name.localeCompare(b.name, "uz"));
  const assessments = Object.entries(asMap(doc.assessments))
    .map(([id, raw]) => toAssessment(id, raw))
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  return { counts: summarizeWorkspace(doc), classes, assessments };
}
