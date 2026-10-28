"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui";

/** One student per line; blank lines and leading "1." / "1)" numbering are dropped. */
function parseNames(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\d+\s*[.)-]?\s*/, "").trim())
    .filter(Boolean);
}

function currentAcademicYear(): string {
  const now = new Date();
  // the school year starts in September
  const start = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${start + 1}`;
}

async function postJson(url: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Saqlab bo'lmadi.");
  return data;
}

const textareaClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500";

function Message({ error, success }: { error: string; success: string }) {
  if (error) return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  if (success) return <p className="text-sm text-emerald-600 dark:text-emerald-400">{success}</p>;
  return null;
}

/** Create a class (with an optional roster) through `endpoint`. */
export function CreateClassForm({ endpoint, hint }: { endpoint: string; hint?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [academicYear, setAcademicYear] = useState(currentAcademicYear);
  const [students, setStudents] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const data = await postJson(endpoint, { name, academicYear, students: parseNames(students) });
      const teachers = typeof data.teachers === "number" ? data.teachers : null;
      setSuccess(teachers !== null ? `"${name}" sinfi ${teachers} ta o'qituvchiga qo'shildi.` : `"${name}" sinfi yaratildi.`);
      setName("");
      setStudents("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Saqlab bo'lmadi.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          + Sinf yaratish
        </button>
        <Message error="" success={success} />
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
      {hint && <p className="text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
          Sinf nomi
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Masalan: 5-A" maxLength={40} className="mt-1" required />
        </label>
        <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
          O&apos;quv yili
          <Input value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} placeholder="2026-2027" maxLength={20} className="mt-1" required />
        </label>
      </div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">
        O&apos;quvchilar (ixtiyoriy, har qatorga bitta F.I.Sh)
        <textarea value={students} onChange={(e) => setStudents(e.target.value)} rows={6} className={`${textareaClass} mt-1`} placeholder={"Aliyev Vali\nKarimova Malika"} />
      </label>
      <Message error={error} success={success} />
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
          {busy ? "Saqlanmoqda..." : "Yaratish"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={busy}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          Yopish
        </button>
      </div>
    </form>
  );
}

/** Add students to an existing class of a teacher. */
export function AddStudentsForm({ uid, classId }: { uid: string; classId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const data = await postJson(
        `/api/admin/users/${encodeURIComponent(uid)}/classes/${encodeURIComponent(classId)}/students`,
        { names: parseNames(text) }
      );
      setSuccess(`${Number(data.added) || 0} ta o'quvchi qo'shildi.`);
      setText("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Saqlab bo'lmadi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-4 space-y-2 border-t border-gray-100 pt-4 dark:border-gray-800">
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">
        O&apos;quvchi qo&apos;shish (har qatorga bitta F.I.Sh)
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className={`${textareaClass} mt-1`} />
      </label>
      <Message error={error} success={success} />
      <button
        type="submit"
        disabled={busy || parseNames(text).length === 0}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {busy ? "Qo'shilmoqda..." : "Qo'shish"}
      </button>
    </form>
  );
}
