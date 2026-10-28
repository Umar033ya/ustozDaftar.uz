import "server-only";

import { getAdminFirestore, requireAdminCredentials } from "@/lib/firebaseAdmin";
import { normalizePlan } from "@/lib/data";
import { formatName } from "@/lib/format";
import type { School, SchoolTeacher } from "@/lib/types";

/**
 * Schools are not stored anywhere: teachers type their school into their
 * profile (users/{uid}.schoolName). Spellings such as "317-maktab",
 * "317 maktab" and "317-son maktabi" are grouped under one key.
 */
export function schoolKey(name: string | undefined | null): string {
  return String(name ?? "")
    .toLowerCase()
    .replace(/[‘’ʻʼ`']/g, "")
    .replace(/(^|[^a-zа-яё])son(?=[^a-zа-яё]|$)/g, "$1 ")
    .replace(/maktabi(?=[^a-zа-яё]|$)/g, "maktab")
    .replace(/[^a-z0-9а-яёўқғҳ]+/g, "");
}

type RawMap = Record<string, unknown>;
const asMap = (v: unknown): RawMap => (v && typeof v === "object" && !Array.isArray(v) ? (v as RawMap) : {});

function toTeacher(id: string, data: RawMap): SchoolTeacher {
  const classes = Object.entries(asMap(data.classes))
    .map(([cid, raw]) => {
      const c = asMap(raw);
      return {
        id: cid,
        name: String(c.name ?? ""),
        academicYear: String(c.academicYear ?? ""),
        studentCount: Object.keys(asMap(c.students)).length,
        createdByAdmin: c.createdByAdmin === true,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "uz", { numeric: true }));
  return {
    uid: id,
    name: formatName({ firstName: data.firstName as string, lastName: data.lastName as string, email: data.email as string }),
    email: data.email as string | undefined,
    plan: normalizePlan(data.plan),
    blocked: data.blocked === true,
    classes,
  };
}

/** Every school with its teachers; teachers without a school name are counted separately. */
export async function getSchools(): Promise<{ schools: School[]; withoutSchool: number }> {
  requireAdminCredentials();
  const snapshot = await getAdminFirestore()
    .collection("users")
    .select("firstName", "lastName", "email", "schoolName", "plan", "blocked", "classes")
    .get();

  const groups = new Map<string, { names: Map<string, number>; teachers: SchoolTeacher[] }>();
  let withoutSchool = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data() ?? {};
    const raw = String(data.schoolName ?? "").trim();
    const key = schoolKey(raw);
    if (!key) {
      withoutSchool += 1;
      continue;
    }
    const group = groups.get(key) ?? { names: new Map<string, number>(), teachers: [] as SchoolTeacher[] };
    group.names.set(raw, (group.names.get(raw) ?? 0) + 1);
    group.teachers.push(toTeacher(doc.id, data));
    groups.set(key, group);
  }

  const schools: School[] = [...groups.entries()].map(([key, group]) => {
    // the spelling most teachers use is shown as the school's name
    const name = [...group.names.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const teachers = group.teachers.sort((a, b) => a.name.localeCompare(b.name, "uz"));
    return {
      key,
      name,
      teachers,
      classCount: teachers.reduce((sum, t) => sum + t.classes.length, 0),
      studentCount: teachers.reduce((sum, t) => sum + t.classes.reduce((s, c) => s + c.studentCount, 0), 0),
    };
  });

  schools.sort((a, b) => b.teachers.length - a.teachers.length || a.name.localeCompare(b.name, "uz", { numeric: true }));
  return { schools, withoutSchool };
}

export async function getSchool(key: string): Promise<School | null> {
  const { schools } = await getSchools();
  return schools.find((s) => s.key === key) ?? null;
}
