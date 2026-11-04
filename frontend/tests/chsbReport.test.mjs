import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { buildBSBWorkbook, buildChSBWorkbook, buildChsbReportWorkbook } from "../lib/excelExport.js";
import { formatScore, parsePoints, summarizeChsbReport, validateQuestionPoints } from "../lib/chsbReport.js";
import { gradeFromPercentage, normalizeTableSettings, teacherFullName, validateGradeThresholds } from "../lib/grades.js";

const allCellText = (sheet) => {
  const out = [];
  sheet.eachRow((row) => row.eachCell((cell) => out.push(String(cell.value))));
  return out;
};

async function openWorkbook(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook.worksheets[0];
}

test("grades: default limits and float safety", () => {
  assert.equal(gradeFromPercentage(100), 5);
  assert.equal(gradeFromPercentage(86), 5);
  assert.equal(gradeFromPercentage(85.999999999), 5);
  assert.equal(gradeFromPercentage(85), 4);
  assert.equal(gradeFromPercentage(71), 4);
  assert.equal(gradeFromPercentage(56), 3);
  assert.equal(gradeFromPercentage(31), 2);
  assert.equal(gradeFromPercentage(30), 1);
  assert.equal(gradeFromPercentage(0), 1, "a real 0 is a grade");
  assert.equal(gradeFromPercentage(null), null, "no result, no grade");
  assert.equal(gradeFromPercentage(""), null);
  assert.equal(gradeFromPercentage(80, { 5: 80, 4: 60, 3: 40, 2: 20 }), 5, "teacher limits win");
});

test("table settings: off by default, broken data falls back", () => {
  assert.deepEqual(normalizeTableSettings(undefined), {
    showGrade: false,
    gradeThresholds: { 5: 86, 4: 71, 3: 56, 2: 31 },
  });
  assert.equal(normalizeTableSettings({ showGrade: true }).showGrade, true);
  assert.equal(normalizeTableSettings({ gradeThresholds: { 5: "x" } }).gradeThresholds[5], 86);
});

test("grade limits must go down from 5 to 2", () => {
  assert.equal(validateGradeThresholds({ 5: 86, 4: 71, 3: 56, 2: 31 }), "");
  assert.notEqual(validateGradeThresholds({ 5: 70, 4: 71, 3: 56, 2: 31 }), "");
  assert.notEqual(validateGradeThresholds({ 5: 86, 4: 71, 3: 56, 2: "" }), "");
  assert.notEqual(validateGradeThresholds({ 5: 101, 4: 71, 3: 56, 2: 31 }), "");
});

test("teacher name comes from the account", () => {
  assert.equal(teacherFullName({ firstName: " Nilufar ", lastName: "Ravshanova" }), "Nilufar Ravshanova");
  assert.equal(teacherFullName({ firstName: "Nilufar" }), "Nilufar");
  assert.equal(teacherFullName(null), "");
});

test("question points: decimal comma, 40 point limit, floating point sum", () => {
  assert.equal(parsePoints("2,6"), 2.6);
  assert.equal(parsePoints("abc"), null);
  assert.equal(formatScore(2.6), "2,6");

  const exact = validateQuestionPoints(["2", "2", "2", "2", "2,6", "2.6", "2,6", "2,6", "2,6", "2,6", "2,6", "2,6", "2,6", "2,6", "3", "3"]);
  assert.equal(exact.error, "");
  assert.equal(exact.total, 40);

  assert.match(validateQuestionPoints(["20", "20", "0,5"]).error, /40/);
  assert.equal(validateQuestionPoints(["20", "20"]).error, "");
  assert.match(validateQuestionPoints(["2", ""]).error, /2-savol/);
  assert.match(validateQuestionPoints(["0"]).error, /1-savol/);
  assert.notEqual(validateQuestionPoints([]).error, "");
});

const REPORT = {
  className: "7-B",
  subject: "Matematika",
  number: "1",
  date: "2026-10-26",
  questions: [2, 2.6, 2.4],
  marks: {
    a: { 0: true, 1: true, 2: true },
    b: { 0: true, 1: false, 2: false },
    gone: { 0: true },
  },
};
const STUDENTS = [
  { id: "a", name: "Aliyev Ali" },
  { id: "b", name: "Bobojonov Bek" },
  { id: "c", name: "Karimov Sardor" },
];

test("report summary: ✓ gives the full points, ✗ gives 0, no mark is absent", () => {
  const summary = summarizeChsbReport(REPORT, STUDENTS);
  assert.equal(summary.maxScore, 7);
  assert.equal(summary.studentCount, 3);
  assert.equal(summary.participatedCount, 2);
  assert.equal(summary.absentCount, 1);

  const [a, b, c] = summary.rows;
  assert.equal(a.total, 7);
  assert.equal(a.percentage, 100);
  assert.equal(b.total, 2);
  assert.equal(b.percentage, 28.57);
  assert.deepEqual(b.marks, [true, false, false]);
  assert.equal(c.total, null, "absent is not a 0");
  assert.equal(c.percentage, null);

  assert.deepEqual(summary.questionStats[0], { checkedCount: 2, correctCount: 2, average: 2, share: 100 });
  assert.deepEqual(summary.questionStats[1], { checkedCount: 2, correctCount: 1, average: 1.3, share: 50 });
  assert.equal(summary.averageScore, 4.5);
  assert.equal(summary.averagePercentage, 64);
});

test("report summary: a question nobody was checked for has no statistics", () => {
  const summary = summarizeChsbReport({ questions: [2], marks: {} }, STUDENTS);
  assert.deepEqual(summary.questionStats[0], { checkedCount: 0, correctCount: 0, average: null, share: null });
  assert.equal(summary.averageScore, null);
});

test("report workbook: marks, blanks, grade column and teacher line", async () => {
  const summary = summarizeChsbReport(REPORT, STUDENTS);
  const { buffer, filename } = await buildChsbReportWorkbook(REPORT, summary, "317-maktab", {
    teacherName: "Nilufar Ravshanova",
    showGrade: true,
  });
  assert.match(filename, /7-B_Matematika_ChSB-hisobot-1/);
  const sheet = await openWorkbook(buffer);
  assert.deepEqual(sheet.getRow(6).values.slice(1), ["T/r", "O'quvchilarning ism-familiyasi", 1, 2, 3, "Ball", "%", "Baho"]);
  assert.equal(sheet.getCell("C9").value, 2);
  assert.equal(sheet.getCell("D9").value, 0, "wrong answer is a real 0");
  assert.equal(sheet.getCell("C10").value, null, "absent stays blank");
  assert.equal(sheet.getCell("H8").value, 5);
  assert.equal(sheet.getCell("H9").value, 1);
  assert.equal(sheet.getCell("H10").value, null);
  assert.ok(allCellText(sheet).includes("Fan o'qituvchisi: Nilufar Ravshanova"));
});

test("BSB and ChSB workbooks: teacher line and optional grade column", async () => {
  const assessment = { className: "5/A", subject: "Fizika", academicYear: "2026-2027", number: 1, date: "2026-10-20", maxScore: 40 };
  const results = [
    { id: "a", studentId: "a", studentName: "Aliyev Ali", total: 36, percentage: 90 },
    { id: "b", studentId: "b", studentName: "Bek", total: "", percentage: 0 },
  ];
  const stats = { averageScore: "36", averagePercentage: "90" };

  const withGrade = await openWorkbook(
    (await buildChSBWorkbook(assessment, results, stats, "Maktab", { teacherName: "N. R", showGrade: true })).buffer
  );
  assert.equal(withGrade.getCell("E5").value, "Baho");
  assert.equal(withGrade.getCell("E7").value, 5);
  assert.equal(withGrade.getCell("E8").value, null);
  assert.equal(withGrade.getCell("D7").numFmt, "0.0%");
  assert.ok(allCellText(withGrade).includes("Fan o'qituvchisi: N. R"));

  const withoutGrade = await openWorkbook((await buildChSBWorkbook(assessment, results, stats, "Maktab")).buffer);
  assert.equal(withoutGrade.getCell("E5").value, null);
  assert.ok(!allCellText(withoutGrade).some((text) => text.startsWith("Fan o'qituvchisi")));

  const tasks = [{ number: 1, maxScore: 10 }, { number: 2, maxScore: 10 }];
  const bsb = await openWorkbook(
    (
      await buildBSBWorkbook(
        { ...assessment, tasks, maxTotal: 20 },
        [{ id: "a", studentId: "a", studentName: "Ali", scores: [10, 5], total: 15, percentage: 75 }],
        { taskAverages: ["100", "50"], averageScore: "15", averagePercentage: "75" },
        "Maktab",
        { teacherName: "N. R", showGrade: true }
      )
    ).buffer
  );
  assert.equal(bsb.getCell("F5").value, "%");
  assert.equal(bsb.getCell("G5").value, "Baho");
  assert.equal(bsb.getCell("G7").value, 4);
  assert.equal(bsb.getCell("F7").numFmt, "0.0%");
  assert.ok(allCellText(bsb).includes("Fan o'qituvchisi: N. R"));
});
