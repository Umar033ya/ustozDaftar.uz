import "server-only";

import { getAdminAuth, getAdminFirestore, requireAdminCredentials } from "@/lib/firebaseAdmin";
import { ApiError } from "@/lib/apiError";
import { invalidateAdminCache, writeAudit } from "@/lib/data";

/**
 * Account and workspace mutations an admin can perform on a teacher.
 *
 * Classes and students are written into `users/{uid}` exactly the way the main
 * app stores them (frontend/lib/firestoreService.js), so a class created here
 * opens, edits and exports in the teacher's own dashboard like any other.
 */

const USERS_COLLECTION = "users";

export const MAX_NAME_LENGTH = 120;
export const MAX_STUDENTS_PER_REQUEST = 100;

type Actor = { uid: string; email?: string | null };
type RawMap = Record<string, unknown>;

function asMap(value: unknown): RawMap {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as RawMap) : {};
}

/** Same id shape as the main app (time + random, unique inside the map). */
export function generateId(existing: RawMap): string {
  let id: string;
  do {
    id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  } while (Object.prototype.hasOwnProperty.call(existing, id));
  return id;
}

/** Trimmed, non-empty, length-capped names; throws on an empty or oversized list. */
export function cleanStudentNames(input: unknown, { allowEmpty = false } = {}): string[] {
  const list = Array.isArray(input) ? input : [];
  const names = list
    .map((n) => (typeof n === "string" ? n.replace(/\s+/g, " ").trim() : ""))
    .filter(Boolean)
    .map((n) => n.slice(0, MAX_NAME_LENGTH));
  if (names.length === 0 && !allowEmpty) {
    throw new ApiError(400, "NO_STUDENTS", "Kamida bitta o'quvchi ismini kiriting.");
  }
  if (names.length > MAX_STUDENTS_PER_REQUEST) {
    throw new ApiError(400, "TOO_MANY_STUDENTS", `Bir martada ko'pi bilan ${MAX_STUDENTS_PER_REQUEST} ta o'quvchi qo'shiladi.`);
  }
  return names;
}

export function cleanClassInput(body: { name?: unknown; academicYear?: unknown }) {
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 40) : "";
  const academicYear = typeof body.academicYear === "string" ? body.academicYear.trim().slice(0, 20) : "";
  if (!name || !academicYear) {
    throw new ApiError(400, "CLASS_FIELDS_REQUIRED", "Sinf nomi va o'quv yilini kiriting.");
  }
  return { name, academicYear };
}

/** Empty result row, identical to buildEmptyResult in the main app. */
function emptyResult(assessment: RawMap, student: { id: string; name: string }) {
  return assessment.type === "BSB"
    ? {
        studentId: student.id,
        studentName: student.name,
        scores: (Array.isArray(assessment.tasks) ? assessment.tasks : []).map(() => ""),
        total: 0,
        percentage: 0,
      }
    : { studentId: student.id, studentName: student.name, total: "", percentage: 0 };
}

/** Roster entries for `names`, ids unique against `existing`. */
function buildStudents(existing: RawMap, names: string[]) {
  const pool = { ...existing };
  const base = Date.now();
  return names.map((name, index) => {
    const id = generateId(pool);
    // distinct createdAt keeps the entered order when the roster is sorted
    const student = { id, name, createdAt: base + index };
    pool[id] = student;
    return student;
  });
}

async function assertManageable(uid: string, actor: Actor) {
  if (uid === actor.uid) {
    throw new ApiError(403, "SELF_ACTION", "Bu amalni o'z hisobingizga qo'llab bo'lmaydi.");
  }
  try {
    const record = await getAdminAuth().getUser(uid);
    if (record.customClaims?.admin === true) {
      throw new ApiError(403, "TARGET_IS_ADMIN", "Admin hisobini bu yerdan boshqarib bo'lmaydi.");
    }
    return record;
  } catch (error) {
    if ((error as { code?: string })?.code === "auth/user-not-found") return null;
    throw error;
  }
}

// ─── Account ─────────────────────────────────────────────────────────────────

export async function setUserBlocked(uid: string, blocked: boolean, actor: Actor): Promise<void> {
  requireAdminCredentials();
  const record = await assertManageable(uid, actor);
  const userRef = getAdminFirestore().collection(USERS_COLLECTION).doc(uid);
  const snap = await userRef.get();
  if (!record && !snap.exists) {
    throw new ApiError(404, "USER_NOT_FOUND", "Foydalanuvchi topilmadi.");
  }

  if (record) {
    // A disabled account cannot sign in or refresh its token; revoking ends
    // every session that is still open.
    await getAdminAuth().updateUser(uid, { disabled: blocked });
    if (blocked) await getAdminAuth().revokeRefreshTokens(uid);
  }
  if (snap.exists) await userRef.set({ blocked }, { merge: true });
  invalidateAdminCache();

  await writeAudit({
    action: blocked ? "user.block" : "user.unblock",
    actorUid: actor.uid,
    actorEmail: actor.email,
    targetUid: uid,
    targetEmail: record?.email ?? (snap.data()?.email as string | undefined),
  });
}

/** Removes the sign-in account and the teacher's workspace. Payment records are kept for bookkeeping. */
export async function deleteUserAccount(uid: string, actor: Actor): Promise<void> {
  requireAdminCredentials();
  const record = await assertManageable(uid, actor);
  const userRef = getAdminFirestore().collection(USERS_COLLECTION).doc(uid);
  const snap = await userRef.get();
  if (!record && !snap.exists) {
    throw new ApiError(404, "USER_NOT_FOUND", "Foydalanuvchi topilmadi.");
  }

  if (record) await getAdminAuth().deleteUser(uid);
  if (snap.exists) await userRef.delete();
  invalidateAdminCache();

  const data = snap.data() ?? {};
  await writeAudit({
    action: "user.delete",
    actorUid: actor.uid,
    actorEmail: actor.email,
    targetUid: uid,
    targetEmail: record?.email ?? (data.email as string | undefined),
    details: {
      name: [data.firstName, data.lastName].filter(Boolean).join(" ") || null,
      schoolName: data.schoolName ?? null,
      classCount: Object.keys(asMap(data.classes)).length,
    },
  });
}

// ─── Workspace ───────────────────────────────────────────────────────────────

/**
 * Adds one class (optionally with its roster) to every listed teacher, in one
 * batch. Returns the number of teachers that received it.
 */
export async function createClassForTeachers(
  uids: string[],
  input: { name: string; academicYear: string; students: string[] },
  actor: Actor,
  context: Record<string, unknown> = {}
): Promise<number> {
  requireAdminCredentials();
  if (uids.length === 0) {
    throw new ApiError(400, "NO_TEACHERS", "Sinf qo'shiladigan o'qituvchi topilmadi.");
  }
  const firestore = getAdminFirestore();
  const refs = uids.map((uid) => firestore.collection(USERS_COLLECTION).doc(uid));
  const snaps = await firestore.getAll(...refs);
  const batch = firestore.batch();
  let written = 0;

  snaps.forEach((snap, i) => {
    if (!snap.exists) return;
    const classes = asMap(snap.data()?.classes);
    const classId = generateId(classes);
    const students = Object.fromEntries(
      buildStudents({}, input.students).map((s) => [s.id, { name: s.name, createdAt: s.createdAt }])
    );
    batch.set(
      refs[i],
      {
        classes: {
          [classId]: {
            name: input.name,
            academicYear: input.academicYear,
            studentCount: input.students.length,
            createdAt: Date.now(),
            createdByAdmin: true,
            students,
          },
        },
      },
      { merge: true }
    );
    written += 1;
  });

  if (written === 0) {
    throw new ApiError(404, "USER_NOT_FOUND", "Foydalanuvchi topilmadi.");
  }
  await batch.commit();
  invalidateAdminCache();

  await writeAudit({
    action: "class.create",
    actorUid: actor.uid,
    actorEmail: actor.email,
    targetUid: uids.length === 1 ? uids[0] : undefined,
    details: { ...context, className: input.name, academicYear: input.academicYear, teachers: written, students: input.students.length },
  });
  return written;
}

/** Adds students to an existing class, seeding their empty rows in the class's assessments. */
export async function addStudentsToClass(
  uid: string,
  classId: string,
  names: string[],
  actor: Actor
): Promise<number> {
  requireAdminCredentials();
  const firestore = getAdminFirestore();
  const userRef = firestore.collection(USERS_COLLECTION).doc(uid);

  const added = await firestore.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new ApiError(404, "USER_NOT_FOUND", "Foydalanuvchi topilmadi.");
    const data = snap.data() ?? {};
    const classes = asMap(data.classes);
    if (!Object.prototype.hasOwnProperty.call(classes, classId)) {
      throw new ApiError(404, "CLASS_NOT_FOUND", "Sinf topilmadi.");
    }
    const roster = asMap(asMap(classes[classId]).students);
    const created = buildStudents(roster, names);

    const classPatch: RawMap = {
      studentCount: Object.keys(roster).length + created.length,
      students: Object.fromEntries(created.map((s) => [s.id, { name: s.name, createdAt: s.createdAt }])),
    };
    const assessmentPatch: RawMap = {};
    for (const [assessmentId, raw] of Object.entries(asMap(data.assessments))) {
      const assessment = asMap(raw);
      if (assessment.classId !== classId) continue;
      assessmentPatch[assessmentId] = {
        results: Object.fromEntries(created.map((s) => [s.id, emptyResult(assessment, s)])),
      };
    }

    const patch: RawMap = { classes: { [classId]: classPatch } };
    if (Object.keys(assessmentPatch).length > 0) patch.assessments = assessmentPatch;
    tx.set(userRef, patch, { merge: true });
    return { count: created.length, email: data.email as string | undefined, className: asMap(classes[classId]).name };
  });
  invalidateAdminCache();

  await writeAudit({
    action: "students.add",
    actorUid: actor.uid,
    actorEmail: actor.email,
    targetUid: uid,
    targetEmail: added.email,
    details: { classId, className: added.className ?? null, students: added.count },
  });
  return added.count;
}
