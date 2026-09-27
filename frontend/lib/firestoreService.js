import { deleteField, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

/**
 * Firestore data layer.
 *
 * The deployed security rules (frontend/firestore.rules) only grant access to the
 * `users/{uid}` document and deny everything else:
 *
 *   match /users/{uid}  { allow read, write: if request.auth != null && request.auth.uid == uid; }
 *   match /{document=**} { allow read, write: if false; }
 *
 * Subcollection documents are therefore unreachable ("Missing or insufficient
 * permissions"). To stay inside those rules the whole workspace of a teacher lives
 * in a single per-user document:
 *
 *   users/{uid}
 *     |-- firstName / lastName / email / schoolName / createdAt      (profile)
 *     |-- classes/{classId}
 *     |     |-- name / academicYear / createdAt / studentCount
 *     |     `-- students/{studentId} -> { name, createdAt }
 *     `-- assessments/{assessmentId}
 *           |-- type / classId / className / academicYear / subject / number / date
 *           |-- tasks / maxTotal | maxScore / studentCount / createdAt
 *           `-- results/{studentId} -> { studentId, studentName, scores, total, percentage }
 *
 * Every read and write goes through that one document, so the ownership check in the
 * rules keeps every user strictly inside their own data.
 */

const userRef = (uid) => doc(db, "users", uid);

// ─── INTERNAL HELPERS ─────────────────────────────────────────────────────────

function asMap(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function hasKey(target, key) {
  return Object.prototype.hasOwnProperty.call(target, key);
}

function toMillis(value) {
  if (typeof value === "number") return value;
  if (value && typeof value.toMillis === "function") return value.toMillis();
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

/** Firestore rejects `undefined` values. Class instances (Timestamp, FieldValue) pass through untouched. */
function stripUndefined(value) {
  if (Array.isArray(value)) return value.map(stripUndefined);
  if (value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (val !== undefined) out[key] = stripUndefined(val);
    }
    return out;
  }
  return value;
}

/**
 * Expand dotted keys ("classes.abc.students.def") into a nested object.
 * `setDoc(..., { merge: true })` merges nested maps recursively but treats a
 * top-level key containing dots as a literal field name, so the expansion is required.
 */
function nestPatch(flatPatch) {
  const nested = {};
  for (const [path, value] of Object.entries(flatPatch)) {
    const parts = path.split(".");
    let node = nested;
    for (let i = 0; i < parts.length - 1; i++) {
      if (typeof node[parts[i]] !== "object" || node[parts[i]] === null) node[parts[i]] = {};
      node = node[parts[i]];
    }
    node[parts[parts.length - 1]] = value;
  }
  return nested;
}

async function readUserDoc(uid) {
  const snap = await getDoc(userRef(uid));
  return snap.exists() ? snap.data() : null;
}

/**
 * Merge write on the user document. Map branches are merged recursively, so concurrent
 * writes on different branches (class vs. assessment) do not overwrite each other,
 * `deleteField()` removes a branch, and the document is created when it is missing.
 * Paths inside one patch must not be a prefix of each other.
 */
async function patchUserDoc(uid, patch) {
  await setDoc(userRef(uid), stripUndefined(nestPatch(patch)), { merge: true });
}

function generateId(existing) {
  let id;
  do {
    id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  } while (hasKey(existing, id));
  return id;
}

// ─── USER PROFILE ─────────────────────────────────────────────────────────────

const PROFILE_FIELDS = ["firstName", "lastName", "email", "schoolName", "createdAt"];

export async function getUserProfile(uid) {
  const data = await readUserDoc(uid);
  if (!data) return null;
  const profile = { id: uid };
  for (const field of PROFILE_FIELDS) {
    if (data[field] !== undefined) profile[field] = data[field];
  }
  return profile;
}

export async function updateUserProfile(uid, data) {
  await patchUserDoc(uid, data);
}

// ─── CLASSES ───────────────────────────────────────────────────────────────────

function toClass(id, raw) {
  const classData = asMap(raw);
  const students = asMap(classData.students);
  return {
    id,
    name: classData.name || "",
    academicYear: classData.academicYear || "",
    createdAt: toMillis(classData.createdAt),
    // the roster is the single source of truth, the cached counter can never drift
    studentCount: Object.keys(students).length,
  };
}

function toClassList(data) {
  return Object.entries(asMap(asMap(data).classes))
    .map(([id, raw]) => toClass(id, raw))
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
}

export async function getClasses(uid) {
  return toClassList(await readUserDoc(uid));
}

export async function getClassById(uid, classId) {
  const classes = asMap(asMap(await readUserDoc(uid)).classes);
  return hasKey(classes, classId) ? toClass(classId, classes[classId]) : null;
}

export async function createClass(uid, { name, academicYear }) {
  const classes = asMap(asMap(await readUserDoc(uid)).classes);
  const classId = generateId(classes);

  await patchUserDoc(uid, {
    [`classes.${classId}`]: {
      name,
      academicYear,
      studentCount: 0,
      createdAt: Date.now(),
      students: {},
    },
  });

  return classId;
}

/**
 * Update the editable details of a class in place. Only the given fields are written, so
 * the classId, the roster and every assessment of that class keep working untouched.
 */
export async function updateClass(uid, classId, { name, academicYear }) {
  const patch = {};
  if (name !== undefined) patch[`classes.${classId}.name`] = name;
  if (academicYear !== undefined) patch[`classes.${classId}.academicYear`] = academicYear;
  if (Object.keys(patch).length === 0) return;
  await patchUserDoc(uid, patch);
}

export async function setClassStudentCount(uid, classId, count) {
  await patchUserDoc(uid, { [`classes.${classId}.studentCount`]: count });
}

export async function deleteClass(uid, classId) {
  // the roster and every cached counter live inside the class branch, so one delete is enough
  await patchUserDoc(uid, { [`classes.${classId}`]: deleteField() });
}

// ─── STUDENTS ─────────────────────────────────────────────────────────────────

function toStudentList(classData) {
  return Object.entries(asMap(asMap(classData).students))
    .map(([id, raw]) => {
      const student = asMap(raw);
      return { id, name: student.name || "", createdAt: toMillis(student.createdAt) };
    })
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
}

export async function getStudents(uid, classId) {
  const classData = asMap(asMap(await readUserDoc(uid)).classes)[classId];
  return toStudentList(asMap(classData));
}

export async function addStudent(uid, classId, name) {
  const classData = asMap(asMap(asMap(await readUserDoc(uid)).classes)[classId]);
  const students = asMap(classData.students);
  const studentId = generateId(students);
  const createdAt = Date.now();

  // student document and cached counter in a single atomic write
  await patchUserDoc(uid, {
    [`classes.${classId}.students.${studentId}`]: { name, createdAt },
    [`classes.${classId}.studentCount`]: Object.keys(students).length + 1,
  });

  return { id: studentId, name, createdAt };
}

export async function updateStudentName(uid, classId, studentId, name) {
  await patchUserDoc(uid, { [`classes.${classId}.students.${studentId}.name`]: name });
}

export async function deleteStudent(uid, classId, studentId) {
  const data = await readUserDoc(uid);
  const classData = asMap(asMap(data?.classes)[classId]);
  const students = asMap(classData.students);
  if (!hasKey(students, studentId)) return;

  const patch = {
    [`classes.${classId}.students.${studentId}`]: deleteField(),
    [`classes.${classId}.studentCount`]: Math.max(0, Object.keys(students).length - 1),
  };

  // drop the scores of the removed student from every assessment of this class
  for (const [assessmentId, raw] of Object.entries(asMap(data?.assessments))) {
    const assessment = asMap(raw);
    if (assessment.classId !== classId) continue;
    if (!hasKey(asMap(assessment.results), studentId)) continue;
    patch[`assessments.${assessmentId}.results.${studentId}`] = deleteField();
  }

  await patchUserDoc(uid, patch);
}

/** Sync a renamed student into every stored result row of the class. */
export async function syncStudentNameInAssessments(uid, classId, studentId, newName) {
  const data = await readUserDoc(uid);
  const patch = {};

  for (const [assessmentId, raw] of Object.entries(asMap(data?.assessments))) {
    const assessment = asMap(raw);
    if (assessment.classId !== classId) continue;
    if (!hasKey(asMap(assessment.results), studentId)) continue;
    patch[`assessments.${assessmentId}.results.${studentId}.studentName`] = newName;
  }

  if (Object.keys(patch).length > 0) await patchUserDoc(uid, patch);
}

/** Seed an empty result row for a student added after the assessments were created. */
export async function syncNewStudentToAssessments(uid, classId, student) {
  const data = await readUserDoc(uid);
  const patch = {};

  for (const [assessmentId, raw] of Object.entries(asMap(data?.assessments))) {
    const assessment = asMap(raw);
    if (assessment.classId !== classId) continue;
    if (hasKey(asMap(assessment.results), student.id)) continue;
    for (const [field, value] of Object.entries(buildEmptyResult(assessment, student))) {
      patch[`assessments.${assessmentId}.results.${student.id}.${field}`] = value;
    }
  }

  if (Object.keys(patch).length > 0) await patchUserDoc(uid, patch);
}

// ─── ASSESSMENTS ──────────────────────────────────────────────────────────────

function toAssessment(id, raw) {
  const assessment = asMap(raw);
  return {
    id,
    type: assessment.type || "",
    classId: assessment.classId || "",
    className: assessment.className || "",
    academicYear: assessment.academicYear || "",
    subject: assessment.subject || "",
    number: assessment.number,
    date: assessment.date || "",
    tasks: Array.isArray(assessment.tasks) ? assessment.tasks : [],
    maxTotal: assessment.maxTotal,
    maxScore: assessment.maxScore,
    migratedFromId: assessment.migratedFromId,
    studentCount: Object.keys(asMap(assessment.results)).length,
    createdAt: toMillis(assessment.createdAt),
  };
}

export async function getAssessments(uid) {
  const assessments = asMap(asMap(await readUserDoc(uid)).assessments);
  return Object.entries(assessments)
    .map(([id, raw]) => toAssessment(id, raw))
    .sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id));
}

export async function getAssessmentById(uid, assessmentId) {
  const assessments = asMap(asMap(await readUserDoc(uid)).assessments);
  return hasKey(assessments, assessmentId) ? toAssessment(assessmentId, assessments[assessmentId]) : null;
}

function buildEmptyResult(assessment, student) {
  return assessment.type === "BSB"
    ? {
        studentId: student.id,
        studentName: student.name || "",
        scores: (assessment.tasks || []).map(() => ""),
        total: 0,
        percentage: 0,
      }
    : {
        studentId: student.id,
        studentName: student.name || "",
        total: "",
        percentage: 0,
      };
}

export async function createAssessment(uid, assessmentData, students) {
  const assessments = asMap(asMap(await readUserDoc(uid)).assessments);
  const assessmentId = generateId(assessments);

  const results = {};
  for (const student of students) {
    results[student.id] = buildEmptyResult(assessmentData, student);
  }

  // the assessment and its empty result rows land in one atomic write
  await patchUserDoc(uid, {
    [`assessments.${assessmentId}`]: {
      ...assessmentData,
      studentCount: students.length,
      createdAt: Date.now(),
      results,
    },
  });

  return assessmentId;
}

export async function deleteAssessment(uid, assessmentId) {
  // the result rows live inside the assessment branch, so one delete is enough
  await patchUserDoc(uid, { [`assessments.${assessmentId}`]: deleteField() });
}

// ─── RESULTS ──────────────────────────────────────────────────────────────────

export async function getResults(uid, assessmentId) {
  const assessment = asMap(asMap(asMap(await readUserDoc(uid)).assessments)[assessmentId]);
  return Object.entries(asMap(assessment.results)).map(([id, raw]) => ({ id, ...asMap(raw) }));
}

/**
 * Guarantee that an assessment holds exactly one result row per student of its class.
 * Missing slots are created, stale names / missing ids are repaired and result rows of
 * students that no longer belong to the class are removed. Returns the ordered result list
 * used by the result table, the print view and the Excel export.
 */
export async function reconcileResultsWithStudents(uid, assessment, students, existingResults) {
  const sortByName = (list) =>
    [...list].sort((a, b) => (a.studentName || "").localeCompare(b.studentName || "", "uz"));

  const results = existingResults || [];

  // Class roster unavailable (deleted class) -> keep stored results untouched
  if (!students || students.length === 0) {
    return sortByName(results);
  }

  const byStudentId = new Map();
  results.forEach((r) => {
    const key = r.studentId || r.id;
    if (key) byStudentId.set(key, r);
  });

  const studentIds = new Set(students.map((s) => s.id));
  const base = `assessments.${assessment.id}.results`;
  const patch = {};
  const reconciled = [];

  for (const student of students) {
    const existing = byStudentId.get(student.id);

    if (!existing) {
      const initial = buildEmptyResult(assessment, student);
      for (const [field, value] of Object.entries(initial)) {
        patch[`${base}.${student.id}.${field}`] = value;
      }
      reconciled.push({ id: student.id, ...initial });
      continue;
    }

    const repairs = {};
    if (existing.studentId !== student.id) repairs.studentId = student.id;
    if (existing.studentName !== student.name) repairs.studentName = student.name;
    if (assessment.type === "BSB" && !Array.isArray(existing.scores)) {
      repairs.scores = (assessment.tasks || []).map(() => "");
    }

    for (const [field, value] of Object.entries(repairs)) {
      patch[`${base}.${student.id}.${field}`] = value;
    }

    reconciled.push({ ...existing, id: student.id, ...repairs });
  }

  // Result rows of students that are not part of the class anymore
  results.forEach((r) => {
    const key = r.studentId || r.id;
    if (!key || studentIds.has(key)) return;
    patch[`${base}.${key}`] = deleteField();
  });

  if (Object.keys(patch).length > 0) {
    await patchUserDoc(uid, patch);
  }

  return sortByName(reconciled);
}

export async function updateResult(uid, assessmentId, studentId, data) {
  const userData = await readUserDoc(uid);
  const assessment = asMap(asMap(userData?.assessments)[assessmentId]);
  const stored = asMap(asMap(assessment.results)[studentId]);
  const roster = asMap(asMap(asMap(userData?.classes)[assessment.classId]).students);
  const studentName = stored.studentName || asMap(roster[studentId]).name || "";

  const base = `assessments.${assessmentId}.results.${studentId}`;
  const patch = { [`${base}.studentId`]: studentId };
  // autosave must not produce a nameless row if the slot had to be recreated
  if (stored.studentName !== studentName) {
    patch[`${base}.studentName`] = studentName;
  }

  for (const [field, value] of Object.entries(data || {})) {
    patch[`${base}.${field}`] = value;
  }

  await patchUserDoc(uid, patch);
}
