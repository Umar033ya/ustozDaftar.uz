// Pure rules behind the admin management features: AI access per plan,
// school-name grouping and the student-name input of the admin panel.
import "./helpers/routeHooks.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";

const { aiAccessFor } = await import("../lib/server/aiAccess.js");
const { schoolKey } = await import("../../admin/lib/schools.ts");
const { cleanStudentNames, cleanClassInput } = await import("../../admin/lib/userAdmin.ts");

const NOW = 1_800_000_000_000;

test("AI access: only active Pro / Max accounts", () => {
  assert.equal(aiAccessFor(undefined, NOW), "plan_required");
  assert.equal(aiAccessFor({ plan: "free" }, NOW), "plan_required");
  assert.equal(aiAccessFor({ plan: "pro", planExpiry: NOW + 1000 }, NOW), "ok");
  assert.equal(aiAccessFor({ plan: "max", planExpiry: NOW + 1000 }, NOW), "ok");
  assert.equal(aiAccessFor({ plan: "pro", planExpiry: NOW - 1000 }, NOW), "plan_required");
  assert.equal(aiAccessFor({ plan: "pro", planExpiry: { toMillis: () => NOW + 1 } }, NOW), "ok");
  assert.equal(aiAccessFor({ plan: "pro" }, NOW), "ok", "missing expiry never expires, like subscriptionContext");
  assert.equal(aiAccessFor({ plan: "max", planExpiry: NOW + 1000, blocked: true }, NOW), "blocked");
});

test("school names: common spellings share one key", () => {
  const key = schoolKey("317-maktab");
  assert.equal(key, "317maktab");
  for (const spelling of ["317 maktab", "317-son maktabi", "317 - son Maktab", " 317-MAKTAB "]) {
    assert.equal(schoolKey(spelling), key, spelling);
  }
  assert.notEqual(schoolKey("31-maktab"), key);
  assert.equal(schoolKey(""), "");
  assert.equal(schoolKey(undefined), "");
});

test("student names: trimmed, empty lines dropped, limits enforced", () => {
  assert.deepEqual(cleanStudentNames(["  Aliyev   Vali ", "", 5, "Karimova Malika"]), ["Aliyev Vali", "Karimova Malika"]);
  assert.deepEqual(cleanStudentNames([], { allowEmpty: true }), []);
  assert.throws(() => cleanStudentNames([]), /Kamida bitta/);
  assert.throws(() => cleanStudentNames(Array.from({ length: 101 }, (_, i) => `O'quvchi ${i}`)), /ko'pi bilan 100/);
  assert.equal(cleanStudentNames(["x".repeat(500)])[0].length, 120);
});

test("class input: name and academic year are required", () => {
  assert.deepEqual(cleanClassInput({ name: " 5-A ", academicYear: "2026-2027" }), { name: "5-A", academicYear: "2026-2027" });
  assert.throws(() => cleanClassInput({ name: "", academicYear: "2026-2027" }), /Sinf nomi/);
  assert.throws(() => cleanClassInput({ name: "5-A" }), /Sinf nomi/);
});

// ─── Workspace writes against the in-memory Firestore ────────────────────────
const { pathDb } = await import("./helpers/pathFirestore.mjs");
const { addStudentsToClass, createClassForTeachers } = await import("../../admin/lib/userAdmin.ts");

const ADMIN = { uid: "admin1", email: "admin@test.uz" };

function freshDb() {
  const db = pathDb();
  globalThis.__routeHarness = { db, tokens: new Map() };
  return db;
}

test("school class: created in every listed teacher's workspace, existing classes kept", async () => {
  const db = freshDb();
  db.store.set("users/t1", { firstName: "Ali", classes: { old1: { name: "7-B", students: { s1: { name: "X" } } } } });
  db.store.set("users/t2", { firstName: "Bobur" });

  const count = await createClassForTeachers(
    ["t1", "t2", "missing"],
    { name: "5-A", academicYear: "2026-2027", students: ["Aliyev Vali", "Karimova Malika"] },
    ADMIN
  );
  assert.equal(count, 2);

  for (const uid of ["t1", "t2"]) {
    const classes = db.raw(`users/${uid}`).classes;
    const created = Object.values(classes).find((c) => c.name === "5-A");
    assert.ok(created, uid);
    assert.equal(created.createdByAdmin, true);
    assert.equal(created.studentCount, 2);
    assert.deepEqual(Object.values(created.students).map((s) => s.name), ["Aliyev Vali", "Karimova Malika"]);
  }
  assert.equal(db.raw("users/t1").classes.old1.name, "7-B", "existing class untouched");
  assert.equal(db.raw("users/missing"), undefined, "no document created for unknown uid");
  assert.ok([...db.store.keys()].some((k) => k.startsWith("auditLogs/")), "audit written");
});

test("add students: roster grows and every assessment of the class gets empty rows", async () => {
  const db = freshDb();
  db.store.set("users/t1", {
    email: "t1@test.uz",
    classes: { c1: { name: "5-A", studentCount: 1, students: { s1: { name: "Bor", createdAt: 1 } } } },
    assessments: {
      a1: { type: "BSB", classId: "c1", tasks: [{}, {}], results: { s1: { studentId: "s1", scores: ["3", "4"] } } },
      a2: { type: "ChSB", classId: "c1", results: {} },
      a3: { type: "ChSB", classId: "other", results: {} },
    },
  });

  const added = await addStudentsToClass("t1", "c1", ["Yangi Bir", "Yangi Ikki"], ADMIN);
  assert.equal(added, 2);

  const doc = db.raw("users/t1");
  const roster = doc.classes.c1.students;
  assert.equal(Object.keys(roster).length, 3);
  assert.equal(doc.classes.c1.studentCount, 3);
  assert.equal(doc.classes.c1.name, "5-A");

  const newIds = Object.keys(roster).filter((id) => id !== "s1");
  for (const id of newIds) {
    assert.deepEqual(doc.assessments.a1.results[id].scores, ["", ""]);
    assert.equal(doc.assessments.a2.results[id].total, "");
    assert.equal(doc.assessments.a3.results[id], undefined, "other class untouched");
  }
  assert.deepEqual(doc.assessments.a1.results.s1.scores, ["3", "4"], "existing scores kept");

  await assert.rejects(addStudentsToClass("t1", "nope", ["A"], ADMIN), /Sinf topilmadi/);
});
