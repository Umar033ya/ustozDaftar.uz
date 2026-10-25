/**
 * Seed the LOCAL Firebase emulators with test data. Refuses to run against
 * production: both emulator host variables must be set.
 *
 *   firebase emulators:start --only auth,firestore
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
 *     node scripts/emulator-seed.mjs
 *
 * Emulator-only accounts (they do not exist in the real project):
 *   teacher@test.local / admin@test.local, password EMULATOR_PASSWORD below.
 */
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error("Refusing to run: FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST must point at the emulators.");
  process.exit(1);
}

const EMULATOR_PASSWORD = "Emulator-Only-Pass-2026";
const app = initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || "ustozdaftar-uz" });
const auth = getAuth(app);
const db = getFirestore(app);

async function ensureUser(email, displayName, claims) {
  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch {
    user = await auth.createUser({ email, password: EMULATOR_PASSWORD, displayName, emailVerified: true });
  }
  if (claims) await auth.setCustomUserClaims(user.uid, claims);
  return user.uid;
}

const STUDENTS = [
  "Абдуллаев Жасур", "Алиева Шаҳзода", "Бекмуродов Ғайрат", "Каримов Ўткир", "Каримов Ўткир",
  "Қодиров Ҳасан", "Раҳимова Гулнора", "Тошматов Шерзод", "Умарова Чарос", "Юсупов Ёқубжон",
  "Karimov O‘tkir", "Rahimov G‘ayrat", "Aliyeva Shaxzoda", "Yo‘ldoshev Sardor", "Xolmatova Nigora",
  "Ergashev Bobur", "Normatova Dilnoza", "Sobirov Jahongir", "To‘xtayev Islom", "Usmonova Madina",
  "Hamidov Azizbek", "Ismoilova Sevara", "Jo‘rayev Behruz", "Qurbonova Malika", "Mirzayev Doston",
  "Nazarova Zarina", "Olimov Shohruh", "Po‘latova Feruza", "Rashidov Javohir", "Saidova Mohinur",
  "Tursunov Asadbek", "Valiyeva Kamola",
];

const teacher = await ensureUser("teacher@test.local", "Test Teacher");
await ensureUser("admin@test.local", "Test Admin", { admin: true });

const now = Date.now();
const students = {};
STUDENTS.forEach((name, i) => {
  students[`s${String(i).padStart(3, "0")}`] = { name, createdAt: now + i };
});

const tasks = [1, 2, 3, 4, 5].map((number) => ({ number, maxScore: 4 }));
const maxTotal = 20;
const results = {};
Object.entries(students).forEach(([id, s], i) => {
  // row 0: real zero scores, row 1: nothing entered yet, others: varied scores
  const scores =
    i === 0 ? [0, 0, 0, 0, 0] : i === 1 ? ["", "", "", "", ""] : tasks.map((_, t) => (i * 7 + t * 3) % 5);
  const total = scores.reduce((sum, v) => sum + (v === "" ? 0 : v), 0);
  results[id] = { studentId: id, studentName: s.name, scores, total, percentage: (total / maxTotal) * 100 };
});

await db.doc(`users/${teacher}`).set({
  firstName: "Test",
  lastName: "Teacher",
  email: "teacher@test.local",
  schoolName: "Test maktab",
  createdAt: now,
  classes: {
    c5a: { name: "5-A", academicYear: "2026-2027", studentCount: STUDENTS.length, createdAt: now, students },
    c6b: { name: "6-B (bo'sh)", academicYear: "2026-2027", studentCount: 0, createdAt: now + 1, students: {} },
  },
  assessments: {
    bsb1: {
      type: "BSB", classId: "c5a", className: "5-A", academicYear: "2026-2027", subject: "Matematika",
      number: "1", date: "2026-10-20", tasks, maxTotal, studentCount: STUDENTS.length, createdAt: now, results,
    },
  },
});

console.log(`Seeded emulator: teacher ${teacher}, ${STUDENTS.length} students, 1 BSB.`);
process.exit(0);
