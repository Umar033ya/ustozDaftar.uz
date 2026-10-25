import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeStudentNames, detectScript, missingRowNumbers } from "../lib/studentNames.js";
import { parseModelText } from "../lib/parseModelText.js";
import { buildRequestBody, extractStudents, ExtractionError, MAX_ATTEMPTS } from "../lib/server/studentExtraction.js";

const CYRILLIC_CLASS = [
  "Абдуллаев Жасур Бахтиёр ўғли", "Алиева Шаҳзода Рустам қизи", "Бекмуродов Ғайрат", "Ғаниев Ўктам",
  "Иброҳимов Қаҳрамон", "Каримов Ўткир", "Каримов Ўткир", "Каримова Ўткира", "Қўчқоров Сардор", "Юсупов Ёқубжон",
];
const LATIN_CLASS = ["Bekmurodov G‘ayrat", "G‘aniyev O‘ktam", "Jo‘rayeva Nilufar", "Qo‘chqorov Sardor", "Shoh Sherzod", "Chorshanbiyev Ilhom"];

const rows = (names, first = 1) => names.map((name, i) => ({ row: first + i, name, uncertain: false }));

test("Cyrillic class: every row kept, Uzbek letters untouched, namesakes both kept", () => {
  const { entries, merged } = analyzeStudentNames(rows(CYRILLIC_CLASS));
  assert.equal(merged, 0);
  assert.equal(entries.length, CYRILLIC_CLASS.length);
  assert.deepEqual(entries.map((e) => e.fullName), [
    "Абдуллаев Жасур", "Алиева Шаҳзода", "Бекмуродов Ғайрат", "Ғаниев Ўктам", "Иброҳимов Қаҳрамон",
    "Каримов Ўткир", "Каримов Ўткир", "Каримова Ўткира", "Қўчқоров Сардор", "Юсупов Ёқубжон",
  ]);
  assert.ok(entries.every((e) => detectScript(e.fullName) === "cyrillic"));
  assert.ok(entries[5].warnings.includes("same_name") && entries[6].warnings.includes("same_name"));
  assert.ok(!entries[7].warnings.includes("same_name"), "Каримова Ўткира is a different (similar) name");
});

test("Latin class: o‘ g‘ sh ch and apostrophe characters are kept exactly", () => {
  const { entries } = analyzeStudentNames(rows(LATIN_CLASS));
  assert.deepEqual(entries.map((e) => e.fullName), LATIN_CLASS);
  assert.ok(entries.every((e) => detectScript(e.fullName) === "latin"));
});

test("mixed list: names keep their own alphabet; a lone other-script name is flagged", () => {
  const list = [...LATIN_CLASS, "Каримов Ўткир"];
  const { entries } = analyzeStudentNames(rows(list));
  assert.equal(entries.at(-1).fullName, "Каримов Ўткир");
  assert.ok(entries.at(-1).warnings.includes("other_script"));
  assert.ok(entries.slice(0, -1).every((e) => !e.warnings.includes("other_script")));
});

test("overlapping screenshots: the same printed row is merged and counted, namesakes are not", () => {
  // image 1 shows rows 1-6, image 2 rows 4-8 (rows 4-6 twice); row 7 is a namesake of row 2
  const part1 = rows(["A Bir", "B Ikki", "C Uch", "D To‘rt", "E Besh", "F Olti"]);
  const part2 = rows(["D To‘rt", "E Besh", "F Olti", "B Ikki", "G Sakkiz"], 4);
  const { entries, merged } = analyzeStudentNames([...part1, ...part2]);
  assert.equal(merged, 3);
  assert.equal(entries.length, 8);
  assert.deepEqual(entries.map((e) => e.row), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.ok(entries[6].warnings.includes("same_name"), "row 7 'B Ikki' is kept as a second student");
});

test("without row numbers nothing is ever merged", () => {
  const { entries, merged } = analyzeStudentNames(["A Bir", "A Bir", "A Bir"]);
  assert.equal(merged, 0);
  assert.equal(entries.length, 3);
});

test("large class (45) keeps everybody in order; missing printed rows are detected", () => {
  const names = Array.from({ length: 45 }, (_, i) => `Familiya${i + 1} Ism${i + 1}`);
  const full = analyzeStudentNames(rows(names));
  assert.equal(full.entries.length, 45);
  assert.deepEqual(missingRowNumbers(full.entries), []);

  const gappy = rows(names).filter((r) => r.row !== 12 && r.row !== 30);
  const { entries } = analyzeStudentNames(gappy);
  assert.deepEqual(missingRowNumbers(entries), [12, 30]);
});

test("parseModelText: structured answer with row and visible_rows", () => {
  const answer = JSON.stringify({ visible_rows: 3, students: rows(["Каримов Ўткир", "Karimov O‘tkir", "Ali Vali"]) });
  const parsed = parseModelText(answer);
  assert.equal(parsed.visibleRows, 3);
  assert.equal(parsed.salvaged, false);
  assert.deepEqual(parsed.students[0], { row: 1, name: "Каримов Ўткир", uncertain: false });
});

test("parseModelText: truncated structured answer salvages complete rows only", () => {
  const cut =
    '{"visible_rows": 30, "students": [{"row": 1, "name": "Каримов Ўткир", "uncertain": false}, {"name": "Раҳимов Ғ", "row": 2, "uncertain": true}, {"row": 3, "name": "Aliy';
  const parsed = parseModelText(cut);
  assert.equal(parsed.salvaged, true);
  assert.equal(parsed.visibleRows, 30);
  assert.deepEqual(parsed.students, [
    { row: 1, name: "Каримов Ўткир", uncertain: false },
    { row: 2, name: "Раҳимов Ғ", uncertain: true },
  ]);
});

test("parseModelText: malformed or empty answers return null", () => {
  assert.equal(parseModelText("{students: [Ali Vali]}"), null);
  assert.equal(parseModelText("Kechirasiz, rasmni o'qiy olmadim."), null);
  assert.equal(parseModelText(null), null);
});

test("request: every image sent exactly once, strict JSON schema requested", () => {
  const body = buildRequestBody([
    { mimeType: "image/jpeg", base64: "AAA" },
    { mimeType: "image/png", base64: "BBB" },
  ]);
  const parts = body.messages[0].content;
  assert.equal(parts.filter((p) => p.type === "image_url").length, 2);
  assert.equal(body.response_format.type, "json_schema");
  assert.equal(body.response_format.json_schema.strict, true);
  assert.equal(body.provider.require_parameters, true);
  assert.equal(body.temperature, 0);
});

function fakeFetch(responses) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push(JSON.parse(init.body));
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return {
      ok: next.status === 200,
      status: next.status,
      headers: { get: () => null },
      json: async () => next.json,
      text: async () => JSON.stringify(next.json || {}),
    };
  };
  return { impl, calls };
}
const okAnswer = (content, finish = "stop") => ({
  status: 200,
  json: { choices: [{ message: { content }, finish_reason: finish }], usage: {} },
});
const quiet = { warn() {}, info() {} };
const noSleep = async () => {};
const ONE = '{"visible_rows":1,"students":[{"row":1,"name":"Ali Vali","uncertain":false}]}';

test("retry: one retry on 503, then success", async () => {
  const { impl, calls } = fakeFetch([{ status: 503, json: {} }, okAnswer(ONE)]);
  const result = await extractStudents({ apiKey: "k", images: [], fetchImpl: impl, sleep: noSleep, log: quiet });
  assert.equal(calls.length, 2);
  assert.equal(result.attempts, 2);
  assert.equal(result.students.length, 1);
});

test("retry: never more than MAX_ATTEMPTS calls, 400 is not retried", async () => {
  const many = fakeFetch(Array.from({ length: 5 }, () => ({ status: 429, json: {} })));
  await assert.rejects(
    extractStudents({ apiKey: "k", images: [], fetchImpl: many.impl, sleep: noSleep, log: quiet }),
    (e) => e instanceof ExtractionError && e.status === 429
  );
  assert.equal(many.calls.length, MAX_ATTEMPTS);

  const bad = fakeFetch([{ status: 400, json: {} }, okAnswer(ONE)]);
  await assert.rejects(extractStudents({ apiKey: "k", images: [], fetchImpl: bad.impl, sleep: noSleep, log: quiet }));
  assert.equal(bad.calls.length, 1);
});

test("truncated answer (finish_reason=length) is returned as partial, not retried", async () => {
  const { impl, calls } = fakeFetch([
    okAnswer('{"visible_rows": 40, "students": [{"row":1,"name":"Ali Vali","uncertain":false},{"row":2,"name":"Ka', "length"),
  ]);
  const result = await extractStudents({ apiKey: "k", images: [], fetchImpl: impl, sleep: noSleep, log: quiet });
  assert.equal(calls.length, 1);
  assert.equal(result.truncatedOutput, true);
  assert.equal(result.salvaged, true);
  assert.equal(result.visibleRows, 40);
  assert.equal(result.students.length, 1);
});

test("unparseable answer gets exactly one more attempt", async () => {
  const { impl, calls } = fakeFetch([okAnswer("not json"), okAnswer("still not json")]);
  await assert.rejects(
    extractStudents({ apiKey: "k", images: [], fetchImpl: impl, sleep: noSleep, log: quiet }),
    (e) => e.code === "unreadable_answer"
  );
  assert.equal(calls.length, 2);
});
