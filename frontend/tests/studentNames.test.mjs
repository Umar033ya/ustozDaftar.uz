import { test } from "node:test";
import assert from "node:assert/strict";
import {
  analyzeStudentNames,
  cleanStudentName,
  detectScript,
  looseNameKey,
  MAX_STUDENTS,
  nameKey,
  normalizeStudentName,
} from "../lib/studentNames.js";
import { parseModelText } from "../lib/parseModelText.js";

test("Latin names keep their script and apostrophes", () => {
  assert.equal(normalizeStudentName("Karimov O‘tkir"), "Karimov O‘tkir");
  assert.equal(normalizeStudentName("Rahimov G‘ayrat"), "Rahimov G‘ayrat");
  assert.equal(normalizeStudentName("Aliyeva Shaxzoda"), "Aliyeva Shaxzoda");
  assert.equal(normalizeStudentName("Yo'ldoshev O'tkir"), "Yo'ldoshev O'tkir");
});

test("Cyrillic names stay Cyrillic, including Uzbek letters", () => {
  assert.equal(normalizeStudentName("Каримов Ўткир"), "Каримов Ўткир");
  assert.equal(normalizeStudentName("Раҳимов Ғайрат"), "Раҳимов Ғайрат");
  assert.equal(normalizeStudentName("Алиева Шаҳзода"), "Алиева Шаҳзода");
  assert.equal(normalizeStudentName("Қодиров Ҳасан"), "Қодиров Ҳасан");
  assert.equal(detectScript(normalizeStudentName("Каримов Ўткир")), "cyrillic");
});

test("patronymics are removed in both scripts, multi-part first names are kept", () => {
  assert.equal(normalizeStudentName("Yakubov Abdulla Umarjon o‘g‘li"), "Yakubov Abdulla");
  assert.equal(normalizeStudentName("Якубов Абдулла Умаржон ўғли"), "Якубов Абдулла");
  assert.equal(normalizeStudentName("Aliyeva Shaxzoda Rustam qizi"), "Aliyeva Shaxzoda");
  assert.equal(normalizeStudentName("Алиева Шаҳзода Рустам қизи"), "Алиева Шаҳзода");
  assert.equal(normalizeStudentName("Петров Иван Сергеевич"), "Петров Иван");
  assert.equal(normalizeStudentName("Karimova Nodira Akmalovna"), "Karimova Nodira");
  assert.equal(normalizeStudentName("Karimov Muhammad Ali"), "Karimov Muhammad Ali");
  assert.equal(normalizeStudentName("Tosh-Muhammedov Anvar"), "Tosh-Muhammedov Anvar");
});

test("extra spaces, numbering and invisible characters are cleaned", () => {
  assert.equal(cleanStudentName("  1.  Karimov   O‘tkir  "), "Karimov O‘tkir");
  assert.equal(cleanStudentName("12) Каримов Ўткир"), "Каримов Ўткир");
  assert.equal(cleanStudentName("Aliyev​ Vali,"), "Aliyev Vali");
  // decomposed "й" (и + combining breve) is folded to the composed letter
  assert.equal(cleanStudentName("Сайидй"), "Сайидй");
});

test("same-script keys ignore case, spacing and apostrophe style only", () => {
  assert.equal(nameKey("Karimov O‘tkir"), nameKey("karimov  o'tkir"));
  assert.notEqual(nameKey("Каримов Ўткир"), nameKey("Karimov O‘tkir"));
});

test("cross-script keys match the same person written in both alphabets", () => {
  assert.equal(looseNameKey("Каримов Ўткир"), looseNameKey("Karimov O‘tkir"));
  assert.equal(looseNameKey("Раҳимов Ғайрат"), looseNameKey("Rahimov G‘ayrat"));
  assert.equal(looseNameKey("Алиева Шаҳзода"), looseNameKey("Aliyeva Shaxzoda"));
});

test("analyzeStudentNames never silently drops a student", () => {
  const input = [
    "Karimov O‘tkir",
    "Каримов Ўткир",
    "karimov  o'tkir",
    { name: "Rahimov G‘ay", uncertain: true },
    { fullName: "Алиева Шаҳзода" },
    "",
    "Vali",
    "Kаримов Ali",
  ];
  const { entries, truncated } = analyzeStudentNames(input);
  assert.equal(entries.length, input.length, "one entry per input line");
  assert.equal(truncated, 0);

  assert.equal(entries[0].status, "ok");
  assert.ok(entries[0].warnings.includes("same_name"), "the first namesake is flagged too");
  assert.equal(entries[1].status, "ok");
  assert.ok(entries[1].warnings.includes("possible_duplicate"));
  assert.equal(entries[1].fullName, "Каримов Ўткир");
  // a namesake is a student to review, never a duplicate that is dropped
  assert.equal(entries[2].status, "ok");
  assert.ok(entries[2].warnings.includes("same_name"));
  assert.ok(entries[3].uncertain && entries[3].warnings.includes("uncertain"));
  assert.equal(entries[4].fullName, "Алиева Шаҳзода");
  assert.equal(entries[5].status, "empty");
  assert.ok(entries[6].warnings.includes("single_word"));
  assert.ok(entries[7].warnings.includes("mixed_script"));
});

test("shortened names keep the original for review", () => {
  const [entry] = analyzeStudentNames(["Yakubov Abdulla Umarjon o'g'li"]).entries;
  assert.equal(entry.fullName, "Yakubov Abdulla");
  assert.equal(entry.original, "Yakubov Abdulla Umarjon o'g'li");
  assert.ok(entry.warnings.includes("shortened"));
});

test("large class lists are kept in order and the overflow is reported", () => {
  const big = Array.from({ length: MAX_STUDENTS + 5 }, (_, i) => `O'quvchi${i} Ism${i}`);
  const { entries, truncated } = analyzeStudentNames(big);
  assert.equal(entries.length, MAX_STUDENTS);
  assert.equal(truncated, 5);
  assert.equal(entries[0].fullName, "O'quvchi0 Ism0");
  assert.equal(entries.at(-1).fullName, `O'quvchi${MAX_STUDENTS - 1} Ism${MAX_STUDENTS - 1}`);

  const class35 = Array.from({ length: 35 }, (_, i) => `Familiya${i} Ism${i}`);
  assert.equal(analyzeStudentNames(class35).entries.filter((e) => e.status === "ok").length, 35);
});

test("parseModelText accepts both shapes, fences and surrounding text", () => {
  assert.deepEqual(parseModelText('{"students":["A B"]}').students, ["A B"]);
  assert.deepEqual(
    parseModelText('```json\n{ "students": [ { "name": "Каримов Ўткир", "uncertain": false } ] }\n```').students,
    [{ name: "Каримов Ўткир", uncertain: false }]
  );
  assert.deepEqual(parseModelText('Here you go: {"students": ["X Y"]} Done.').students, ["X Y"]);
  assert.equal(parseModelText("I cannot read this image."), null);
  assert.equal(parseModelText(""), null);
});

test("parseModelText salvages complete names from a truncated answer", () => {
  const truncatedAnswer =
    '{ "students": [ { "name": "Karimov O‘tkir", "uncertain": false }, { "name": "Раҳимов Ғайрат", "uncertain": true }, { "name": "Aliy';
  const result = parseModelText(truncatedAnswer);
  assert.equal(result.salvaged, true);
  assert.deepEqual(result.students, [
    { name: "Karimov O‘tkir", uncertain: false },
    { name: "Раҳимов Ғайрат", uncertain: true },
  ]);

  const flat = parseModelText('{"students": ["Aliyev Vali", "Каримов Ўткир", "Tosh');
  assert.deepEqual(flat.students, ["Aliyev Vali", "Каримов Ўткир"]);
});
