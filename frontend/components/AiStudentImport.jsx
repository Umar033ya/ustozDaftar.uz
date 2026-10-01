"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { auth } from "@/lib/firebase";
import {
  addStudent,
  syncNewStudentToAssessments,
  setClassStudentCount,
} from "@/lib/firestoreService";

const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"];
const ACCEPT_ATTRIBUTE = "image/jpeg,image/png,image/webp,image/heic,image/heif";

const sameName = (a = "", b = "") => a.trim().toLowerCase() === b.trim().toLowerCase();

function Banner({ tone = "error", children }) {
  const tones = {
    error: "bg-red-50 border border-red-200 text-red-700",
    warning: "bg-amber-50 border border-amber-200 text-amber-800",
    success: "bg-emerald-50 border border-emerald-200 text-emerald-700",
  };
  return <div className={`${tones[tone]} px-4 py-2.5 rounded-lg text-sm font-medium`}>{children}</div>;
}

export default function AiStudentImport({
  uid,
  classId,
  existingStudents,
  onStudentsAdded,
  onNotify,
}) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState("upload");
  const [files, setFiles] = useState([]);
  const [extracted, setExtracted] = useState([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [inputKey, setInputKey] = useState(0);

  const busy = status === "loading" || status === "adding";

  // Object URLs must be created once per file and revoked when they are dropped,
  // otherwise every re-render leaks a blob URL.
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  useEffect(() => () => previews.forEach(URL.revokeObjectURL), [previews]);

  const resetFileInput = () => setInputKey((key) => key + 1);

  const closeModal = () => {
    setOpen(false);
    setStage("upload");
    setFiles([]);
    setExtracted([]);
    setStatus("idle");
    setError(null);
    resetFileInput();
  };

  const handleFileChange = (event) => {
    const picked = Array.from(event.target.files || []);
    setError(null);
    if (picked.length === 0) return;

    const invalid = picked.find((file) => !ACCEPTED_MIME_TYPES.includes(file.type.toLowerCase()));
    if (invalid) {
      setError({
        kind: "invalid",
        message: `Faqat rasmlar qabul qilinadi (JPG, PNG, WEBP). "${invalid.name}" fayli mos kelmadi.`,
      });
      resetFileInput();
      return;
    }

    const oversized = picked.find((file) => file.size > MAX_IMAGE_BYTES);
    if (oversized) {
      setError({
        kind: "invalid",
        message: `"${oversized.name}" hajmi 8 MB dan oshmasligi kerak.`,
      });
      resetFileInput();
      return;
    }

    setFiles((prev) => {
      const merged = [...prev, ...picked];
      if (merged.length > MAX_IMAGES) {
        setError({
          kind: "invalid",
          message: `Ko'pi bilan ${MAX_IMAGES} ta rasm yuklash mumkin. Siz ${merged.length} ta fayl tanladingiz.`,
        });
        return merged.slice(0, MAX_IMAGES);
      }
      return merged;
    });

    resetFileInput();
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setError(null);
  };

  const handleExtract = async () => {
    if (files.length === 0 || status === "loading") return;
    setStatus("loading");
    setError(null);

    try {
      // The ID token is fetched fresh on every attempt. It is short-lived, so
      // reusing a stored copy would start failing after an hour.
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setStatus("idle");
        setError({ kind: "auth", message: "Sessiya topilmadi. Tizimga qayta kiring." });
        return;
      }

      let token;
      try {
        token = await currentUser.getIdToken();
      } catch {
        setStatus("idle");
        setError({ kind: "auth", message: "Sessiyani yangilab bo'lmadi. Tizimga qayta kiring." });
        return;
      }

      const formData = new FormData();
      files.forEach((file) => formData.append("images", file));

      const response = await fetch("/api/extract-students", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setStatus("idle");
        if (response.status === 401) {
          setError({
            kind: "auth",
            message: payload?.error || "Sessiya yaroqsiz. Tizimga qayta kiring.",
          });
          return;
        }
        setError({
          kind: response.status === 429 ? "rate" : "gemini",
          message: payload?.error || "AI bilan ishlashda xatolik yuz berdi. Qayta urinib ko'ring.",
        });
        return;
      }

      const students = Array.isArray(payload?.students) ? payload.students : [];
      const roster = existingStudents || [];

      if (students.length === 0) {
        setStatus("idle");
        setExtracted([]);
        setStage("review");
        setError({
          kind: "empty",
          message:
            "Rasmda o'quvchi ismi topilmadi. Aniqroq, yorug'roq surat bilan qayta urinib ko'ring.",
        });
        return;
      }

      setExtracted(
        students.map((entry) => {
          const fullName = (entry?.fullName || "").trim();
          const alreadyInClass = roster.some((student) => sameName(student.name, fullName));
          return { fullName, selected: !alreadyInClass, alreadyInClass };
        })
      );
      setStage("review");
      setStatus("idle");
    } catch {
      setStatus("idle");
      setError({
        kind: "gemini",
        message: "Serverga ulanib bo'lmadi. Internetni tekshirib, qayta urinib ko'ring.",
      });
    }
  };

  const toggleStudent = (index) => {
    setExtracted((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, selected: !entry.selected } : entry))
    );
  };

  const setAllSelected = (value) => {
    setExtracted((prev) =>
      prev.map((entry) => (entry.alreadyInClass ? entry : { ...entry, selected: value }))
    );
  };

  const selectableCount = extracted.filter((entry) => !entry.alreadyInClass).length;
  const selectedCount = extracted.filter((entry) => entry.selected).length;

  const handleConfirm = async () => {
    if (busy || selectedCount === 0) return;
    setStatus("adding");
    setError(null);

    // A local copy of the roster keeps duplicate checks correct for the whole
    // batch and lets the cached class counter end up exact.
    const roster = [...(existingStudents || [])];
    const created = [];
    let skipped = 0;

    try {
      for (const entry of extracted) {
        if (!entry.selected) continue;
        if (roster.some((student) => sameName(student.name, entry.fullName))) {
          skipped += 1;
          continue;
        }

        const newStudent = await addStudent(uid, classId, entry.fullName);
        await syncNewStudentToAssessments(uid, classId, newStudent);
        roster.push(newStudent);
        created.push(newStudent);
      }

      if (created.length > 0) {
        await setClassStudentCount(uid, classId, roster.length);
      }

      if (created.length === 0) {
        setStatus("idle");
        setError({
          kind: "empty",
          message: "Yangi o'quvchi qo'shilmadi — tanlangan ismlar allaqachon sinfda mavjud.",
        });
        return;
      }

      onStudentsAdded?.(created, roster.length);
      closeModal();

      const suffix = skipped > 0 ? ` (${skipped} ta allaqachon mavjudligi uchun o'tkazib yuborildi)` : "";
      onNotify?.(`${created.length} ta o'quvchi sinfga qo'shildi${suffix}.`);
    } catch (err) {
      console.error("Error adding students from AI import:", err);
      setStatus("idle");
      setError({
        kind: "firebase",
        message: "O'quvchilarni saqlashda xatolik yuz berdi. Qayta urinib ko'ring.",
      });
    }
  };

  const backToUpload = () => {
    setStage("upload");
    setError(null);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-white text-blue-600 border border-blue-200 px-5 py-2.5 rounded-lg hover:bg-blue-50 font-medium flex items-center justify-center gap-2 text-sm sm:text-base transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"
          />
        </svg>
        AI orqali o&apos;quvchi qo&apos;shish
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/50 px-4 py-4 sm:py-6 overflow-y-auto"
          onClick={busy ? undefined : closeModal}
        >
          <div
            className="bg-white rounded-xl shadow-lg border border-gray-200 w-full max-w-lg my-auto"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="AI orqali o'quvchi qo'shish"
          >
            <div className="p-5 sm:p-6 border-b border-gray-200">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                AI orqali o&apos;quvchi qo&apos;shish
              </h2>
              <p className="text-gray-600 text-sm mt-1">
                {stage === "review"
                  ? "AI topgan ismlarni tekshirib, keraklalarini tanlang. Hech narsa avtomatik qo'shilmaydi."
                  : `Sinf o'quvchilari ro'yxatining suratini yuklang (ko'pi bilan ${MAX_IMAGES} ta).`}
              </p>
            </div>

            <div className="p-5 sm:p-6">
              {stage === "upload" ? (
                <>
                  <label
                    htmlFor="ai-student-images"
                    className="block w-full px-4 py-6 border-2 border-dashed border-gray-300 rounded-lg text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/40 transition-colors"
                  >
                    <svg
                      className="w-8 h-8 text-gray-400 mx-auto mb-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <span className="block text-sm font-medium text-gray-700">Rasm tanlash yoki suratga surish</span>
                    <span className="block text-xs text-gray-500 mt-1">JPG, PNG, WEBP &middot; har biri 8 MB dan kam</span>
                  </label>
                  <input
                    key={inputKey}
                    id="ai-student-images"
                    type="file"
                    accept={ACCEPT_ATTRIBUTE}
                    multiple
                    onChange={handleFileChange}
                    disabled={busy}
                    className="sr-only"
                  />

                  {files.length > 0 && (
                    <ul className="mt-4 grid grid-cols-3 gap-3">
                      {files.map((file, index) => (
                        <li key={`${file.name}-${file.lastModified}-${index}`} className="relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={previews[index]}
                            alt={file.name}
                            className="w-full h-24 object-cover rounded-lg border border-gray-200"
                          />
                          <button
                            type="button"
                            onClick={() => removeFile(index)}
                            disabled={busy}
                            aria-label={`${file.name} ni olib tashlash`}
                            className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-white border border-gray-300 text-gray-600 hover:text-red-600 hover:border-red-300 shadow-sm flex items-center justify-center disabled:opacity-50"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <p className="text-xs text-gray-500 mt-3">
                    Tanlangan: {files.length} / {MAX_IMAGES}
                  </p>
                </>
              ) : extracted.length > 0 ? (
                <>
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <p className="text-sm font-medium text-gray-700">
                      Topildi: {extracted.length} ta
                      {selectableCount < extracted.length && (
                        <span className="text-gray-500 font-normal"> ({extracted.length - selectableCount} tasi sinfda bor)</span>
                      )}
                    </p>
                    <div className="flex items-center gap-3 text-xs font-medium shrink-0">
                      <button
                        type="button"
                        onClick={() => setAllSelected(true)}
                        disabled={busy || selectableCount === 0}
                        className="text-blue-600 hover:text-blue-800 disabled:text-gray-300 disabled:hover:text-gray-300 transition-colors"
                      >
                        Hammasi
                      </button>
                      <button
                        type="button"
                        onClick={() => setAllSelected(false)}
                        disabled={busy || selectedCount === 0}
                        className="text-blue-600 hover:text-blue-800 disabled:text-gray-300 disabled:hover:text-gray-300 transition-colors"
                      >
                        Tozalash
                      </button>
                    </div>
                  </div>

                  <ul className="border border-gray-200 rounded-lg divide-y divide-gray-200 max-h-72 overflow-y-auto">
                    {extracted.map((entry, index) => (
                      <li key={`${entry.fullName}-${index}`} className="px-3 py-2.5 flex items-start gap-3">
                        <input
                          id={`ai-student-${index}`}
                          type="checkbox"
                          checked={entry.selected}
                          disabled={entry.alreadyInClass || busy}
                          onChange={() => toggleStudent(index)}
                          className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0 disabled:cursor-not-allowed"
                        />
                        <label
                          htmlFor={`ai-student-${index}`}
                          className={`flex-1 text-sm break-words ${entry.selected ? "text-gray-900" : "text-gray-500"} ${entry.alreadyInClass ? "cursor-not-allowed" : "cursor-pointer"}`}
                        >
                          <span className="font-medium">{entry.fullName}</span>
                          {entry.alreadyInClass && (
                            <span className="ml-2 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 whitespace-nowrap">
                              sinfda bor
                            </span>
                          )}
                        </label>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <div className="text-center py-6">
                  <svg
                    className="w-12 h-12 text-gray-300 mx-auto mb-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <p className="text-sm font-medium text-gray-700">O&apos;quvchilar topilmadi</p>
                </div>
              )}

              {error && (
                <div className="mt-4">
                  <Banner tone={error.kind === "empty" ? "warning" : "error"}>{error.message}</Banner>
                </div>
              )}
            </div>

            <div className="p-5 sm:p-6 border-t border-gray-200 flex flex-col sm:flex-row gap-3">
              {stage === "upload" ? (
                <>
                  <button
                    type="button"
                    onClick={handleExtract}
                    disabled={files.length === 0 || busy}
                    className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 font-medium text-sm transition-colors disabled:bg-gray-400 sm:flex-1"
                  >
                    {status === "loading" ? (
                      <span className="inline-flex items-center gap-2">
                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        AI tahlil qilmoqda...
                      </span>
                    ) : (
                      "Ro'yxatni aniqlash"
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={busy}
                    className="bg-gray-100 text-gray-700 px-5 py-2.5 rounded-lg hover:bg-gray-200 font-medium text-sm transition-colors disabled:opacity-50"
                  >
                    Bekor qilish
                  </button>
                </>
              ) : extracted.length === 0 ? (
                <>
                  <button
                    type="button"
                    onClick={backToUpload}
                    className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 font-medium text-sm transition-colors sm:flex-1"
                  >
                    Boshqa rasm tanlash
                  </button>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="bg-gray-100 text-gray-700 px-5 py-2.5 rounded-lg hover:bg-gray-200 font-medium text-sm transition-colors"
                  >
                    Bekor qilish
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={selectedCount === 0 || busy}
                    className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 font-medium text-sm transition-colors disabled:bg-gray-400 sm:flex-1"
                  >
                    {status === "adding"
                      ? "Qo'shilmoqda..."
                      : selectedCount > 0
                        ? `Tanlanganlarni qo'shish (${selectedCount})`
                        : "Hech biri tanlanmagan"}
                  </button>
                  <button
                    type="button"
                    onClick={backToUpload}
                    disabled={busy}
                    className="bg-white text-blue-600 border border-blue-200 px-5 py-2.5 rounded-lg hover:bg-blue-50 font-medium text-sm transition-colors disabled:opacity-50"
                  >
                    Orqaga
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}