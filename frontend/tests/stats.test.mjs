import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { summarizeAssessment } from "../lib/resultStats.js";
import { computeClassStats, filterOptions } from "../lib/classStats.js";
import { buildBSBWorkbook, buildChSBWorkbook } from "../lib/excelExport.js";

const tasks = [1, 2, 3].map((number) => ({ number, maxScore: 4 }));
const bsb = (id, rows, extra = {}) => ({
  id,
  type: "BSB",
  number: 1,
  subject: "Matematika",
  classId: "c1",
  className: "5-A",
  academicYear: "2026-2027",
  date: "2026-10-20",
  tasks,
  maxTotal: 12,
  results: rows.map(([studentId, scores]) => {
    const total = scores.reduce((s, v) => s + (v === "" ? 0 : v), 0);
    return { id: studentId, studentId, studentName: studentId.toUpperCase(), scores, total, percentage: (total / 12) * 100 };
  }),
  ...extra,
});

test("summarizeAssessment: a real 0 counts, a blank row does not", () => {
  const a = bsb("a1", [
    ["s1", [0, 0, 0]],
    ["s2", ["", "", ""]],
    ["s3", [4, 4, 4]],
  ]);
  const s = summarizeAssessment(a, a.results);
  assert.equal(s.studentCount, 3);
  assert.equal(s.completedCount, 2);
  assert.equal(s.lowestScore, 0);
  assert.equal(s.highestScore, 12);
  assert.equal(s.averageScore, "6.0");
  assert.equal(s.averagePercentage, "50.0");
  assert.deepEqual(s.taskAverages, ["50.0", "50.0", "50.0"]);
});

test("summarizeAssessment: nothing entered gives nulls, not fake zeros", () => {
  const a = bsb("a1", [
    ["s1", ["", "", ""]],
    ["s2", ["", "", ""]],
  ]);
  const s = summarizeAssessment(a, a.results);
  assert.equal(s.completedCount, 0);
  assert.equal(s.averageScore, null);
  assert.equal(s.averagePercentage, null);
  assert.equal(s.lowestScore, null);
  assert.deepEqual(s.taskAverages, [null, null, null]);
});

test("summarizeAssessment: ChSB zero vs blank", () => {
  const a = { type: "ChSB", maxScore: 20 };
  const results = [
    { studentId: "s1", total: 0, percentage: 0 },
    { studentId: "s2", total: "", percentage: 0 },
    { studentId: "s3", total: 20, percentage: 100 },
  ];
  const s = summarizeAssessment(a, results);
  assert.equal(s.completedCount, 2);
  assert.equal(s.averagePercentage, "50.0");
  assert.equal(s.lowestScore, 0);
});

test("computeClassStats: every roster student is a chart row, filters apply", () => {
  const students = [
    { id: "s1", name: "Каримов Ўткир" },
    { id: "s2", name: "Каримов Ўткир" },
    { id: "s3", name: "Aliyev Vali" },
    { id: "s4", name: "Yangi O'quvchi" },
  ];
  const a1 = bsb("a1", [["s1", [4, 4, 4]], ["s2", [0, 0, 0]], ["s3", ["", "", ""]]]);
  const a2 = bsb("a2", [["s1", [2, 2, 2]], ["s3", [4, 4, 0]]], { subject: "Fizika", number: 2 });
  const chsb = { id: "c1x", type: "ChSB", number: 1, subject: "Matematika", classId: "c1", results: [{ studentId: "s4", total: 10, percentage: 50 }] };

  const all = computeClassStats({ assessments: [a1, a2, chsb], students });
  assert.equal(all.studentRows.length, 4, "nobody disappears, namesakes included");
  assert.deepEqual(all.studentRows.map((r) => r.entered), [true, true, true, true]);
  assert.equal(all.studentRows[1].percentage, 0, "a real 0 is plotted as 0");
  assert.equal(all.summary.assessmentCount, 3);
  assert.equal(all.summary.resultCount, 5);

  const fizika = computeClassStats({ assessments: [a1, a2, chsb], students, filters: { subject: "Fizika" } });
  assert.equal(fizika.summary.assessmentCount, 1);
  assert.deepEqual(fizika.studentRows.map((r) => r.entered), [true, false, true, false]);

  const onlyChsb = computeClassStats({ assessments: [a1, a2, chsb], students, filters: { type: "ChSB" } });
  assert.equal(onlyChsb.summary.averagePercentage, "50.0");

  const none = computeClassStats({ assessments: [], students });
  assert.equal(none.summary.averagePercentage, null);
  assert.equal(none.studentRows.length, 4);

  assert.deepEqual(filterOptions([a1, a2, chsb]), { types: ["BSB", "ChSB"], subjects: ["Fizika", "Matematika"] });
});

test("Excel: every student exported; blank rows stay blank, real zeros stay 0", async () => {
  const a = bsb("a1", [
    ["s1", [0, 0, 0]],
    ["s2", ["", "", ""]],
    ["s3", [4, 3, 2]],
  ]);
  const stats = summarizeAssessment(a, a.results);
  const { buffer } = await buildBSBWorkbook(a, a.results, stats, "Maktab");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheet = wb.worksheets[0];
  const row = (n) => sheet.getRow(n).values.slice(1);
  // rows 7.. are students: [№, name, t1, t2, t3, total, %]
  assert.deepEqual(row(7), [1, "S1", 0, 0, 0, 0, 0]);
  const blank = row(8);
  assert.equal(blank[1], "S2");
  assert.equal(blank.length <= 2 || blank.slice(2).every((v) => v === undefined || v === null), true);
  assert.deepEqual(row(9).slice(0, 6), [3, "S3", 4, 3, 2, 9]);

  const chsbResults = [
    { studentName: "A", total: 0, percentage: 0 },
    { studentName: "B", total: "", percentage: 0 },
  ];
  const c = await buildChSBWorkbook(
    { className: "5-A", subject: "Fizika", academicYear: "2026-2027", number: 1, date: "2026-10-20", maxScore: 20 },
    chsbResults,
    summarizeAssessment({ type: "ChSB", maxScore: 20 }, chsbResults),
    "Maktab"
  );
  const wb2 = new ExcelJS.Workbook();
  await wb2.xlsx.load(c.buffer);
  const s2 = wb2.worksheets[0];
  assert.deepEqual(s2.getRow(7).values.slice(1), [1, "A", 0, 0]);
  assert.deepEqual(s2.getRow(8).values.slice(1, 3), [2, "B"]);
  assert.equal(s2.getRow(8).getCell(3).value, null);
  assert.equal(s2.getRow(8).getCell(4).value, null);
});
