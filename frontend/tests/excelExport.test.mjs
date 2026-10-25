import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { buildBSBWorkbook, buildChSBWorkbook, columnLetter, safeFilename } from "../lib/excelExport.js";

const NAMES = [
  "Ўткир Каримов",
  "O‘tkir Karimov",
  "G‘ayrat Rahimov",
  "Ғайрат Раҳимов",
  "Shaxzoda Aliyeva",
  "Шаҳзода Алиева",
  "Yakubov Muhammad Ali",
  "Tosh-Muhammedov Anvar",
];

function bsbFixture(studentCount = 32, taskCount = 5) {
  const tasks = Array.from({ length: taskCount }, (_, i) => ({ number: i + 1, maxScore: 4 }));
  const maxTotal = taskCount * 4;
  const results = Array.from({ length: studentCount }, (_, i) => {
    const name = i < NAMES.length ? NAMES[i] : `O'quvchi ${i + 1}`;
    // student 1: nothing entered, student 2: real zeros, the rest: mixed scores
    const scores = tasks.map((_, t) => (i === 1 ? "" : i === 2 ? 0 : (i + t) % 5));
    const total = scores.reduce((sum, s) => sum + (s === "" ? 0 : s), 0);
    return { id: `s${i}`, studentId: `s${i}`, studentName: name, scores, total, percentage: (total / maxTotal) * 100 };
  });
  const assessment = {
    className: "5/A",
    subject: "Matematika",
    academicYear: "2026-2027",
    number: 1,
    date: "2026-10-20",
    tasks,
    maxTotal,
  };
  const stats = { taskAverages: tasks.map(() => "50.0"), averageScore: "10.0", averagePercentage: "50.0" };
  return { assessment, results, stats };
}

async function readWorkbook(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}

test("columnLetter handles single and double letters", () => {
  assert.equal(columnLetter(1), "A");
  assert.equal(columnLetter(26), "Z");
  assert.equal(columnLetter(27), "AA");
  assert.equal(columnLetter(24), "X");
});

test("safeFilename removes path separators but keeps Unicode", () => {
  assert.equal(safeFilename("5/A_Ona tili:BSB.xlsx"), "5-A_Ona tili-BSB.xlsx");
  assert.equal(safeFilename("Ўзбек тили.xlsx"), "Ўзбек тили.xlsx");
});

test("BSB export: one row per student, names unchanged, blanks stay blank", async () => {
  const { assessment, results, stats } = bsbFixture();
  const { buffer, filename } = await buildBSBWorkbook(assessment, results, stats, "1-maktab");
  assert.equal(filename, "5-A_Matematika_BSB-1.xlsx");

  const sheet = (await readWorkbook(buffer)).getWorksheet("BSB Natijalari");
  const totalCols = 2 + assessment.tasks.length + 2;

  results.forEach((result, idx) => {
    const row = sheet.getRow(7 + idx);
    assert.equal(row.getCell(1).value, idx + 1);
    assert.equal(row.getCell(2).value, result.studentName, "name must be exported exactly, in its own script");
    assert.equal(row.getCell(totalCols - 1).value, result.total);
    assert.ok(Math.abs(row.getCell(totalCols).value - result.percentage / 100) < 1e-9);
  });

  // student without entered scores: blank cells, not empty text
  assert.equal(sheet.getRow(8).getCell(3).value, null);
  // student with real zeros keeps the zeros
  assert.equal(sheet.getRow(9).getCell(3).value, 0);

  const summaryRow = sheet.getRow(7 + results.length);
  assert.equal(summaryRow.getCell(1).value, "O'rtacha ko'rsatkich (%)");
  assert.equal(sheet.getRow(8 + results.length).getCell(2).value, null, "no extra rows after the summary");
});

test("BSB export: native charts carry cached values for every student and task", async () => {
  const { assessment, results, stats } = bsbFixture(40, 20);
  const { buffer } = await buildBSBWorkbook(assessment, results, stats);
  const zip = await JSZip.loadAsync(buffer);

  const chart1 = await zip.file("xl/charts/chart1.xml").async("string");
  const chart2 = await zip.file("xl/charts/chart2.xml").async("string");
  assert.match(chart1, new RegExp(`<c:ptCount val="${results.length}"/>`));
  assert.ok(chart1.includes("<c:v>Ўткир Каримов</c:v>"));
  assert.match(chart2, /<c:ptCount val="20"\/>/);
  // 20 tasks: % column is X (2 + 20 + 2 = 24)
  assert.ok(chart1.includes("$X$7:$X$46"));
  assert.ok(chart2.includes("$C$5:$V$5"));

  const sheetXml = await zip.file("xl/worksheets/sheet1.xml").async("string");
  assert.ok(sheetXml.includes('<drawing r:id="rIdDrawing1"/></worksheet>'));
});

test("ChSB export: rows, blank totals and chart cache", async () => {
  const results = NAMES.map((name, i) => ({
    id: `s${i}`,
    studentId: `s${i}`,
    studentName: name,
    total: i === 0 ? "" : i,
    percentage: i === 0 ? 0 : (i / 10) * 100,
  }));
  const assessment = { className: "7-B", subject: "Tarix", academicYear: "2026-2027", number: 2, date: "2026-10-21", maxScore: 10 };
  const { buffer } = await buildChSBWorkbook(assessment, results, { averageScore: "4.0", averagePercentage: "40.0" });

  const sheet = (await readWorkbook(buffer)).getWorksheet("ChSB Natijalari");
  assert.equal(sheet.getRow(7).getCell(3).value, null);
  assert.equal(sheet.getRow(8).getCell(2).value, "O‘tkir Karimov");
  assert.equal(sheet.getRow(8).getCell(3).value, 1);

  const chart1 = await (await JSZip.loadAsync(buffer)).file("xl/charts/chart1.xml").async("string");
  assert.match(chart1, new RegExp(`<c:ptCount val="${results.length}"/>`));
});
