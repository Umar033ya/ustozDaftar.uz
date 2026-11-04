"use client";

import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/lib/authContext";
import { updateUserProfile } from "@/lib/firestoreService";
import {
  DEFAULT_GRADE_THRESHOLDS,
  GRADE_LEVELS,
  normalizeTableSettings,
  validateGradeThresholds,
} from "@/lib/grades";

const GRADE_TONES = {
  5: "bg-emerald-100 text-emerald-800",
  4: "bg-blue-100 text-blue-800",
  3: "bg-amber-100 text-amber-800",
  2: "bg-orange-100 text-orange-800",
  1: "bg-red-100 text-red-800",
};

function GradeBadge({ grade }) {
  return (
    <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold ${GRADE_TONES[grade]}`}>
      {grade}
    </span>
  );
}

export default function TableSettings() {
  const { currentUser, userProfile, refreshProfile } = useAuth();
  const saved = normalizeTableSettings(userProfile?.tableSettings);
  const savedThresholdsKey = JSON.stringify(saved.gradeThresholds);

  const [showGrade, setShowGrade] = useState(saved.showGrade);
  const [thresholds, setThresholds] = useState(saved.gradeThresholds);
  const [seenShowGrade, setSeenShowGrade] = useState(saved.showGrade);
  const [seenThresholdsKey, setSeenThresholdsKey] = useState(savedThresholdsKey);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // The profile may arrive after the first render. Each part follows its own saved value,
  // so using the toggle does not throw away limits that are being typed.
  if (saved.showGrade !== seenShowGrade) {
    setSeenShowGrade(saved.showGrade);
    setShowGrade(saved.showGrade);
  }
  if (savedThresholdsKey !== seenThresholdsKey) {
    setSeenThresholdsKey(savedThresholdsKey);
    setThresholds(saved.gradeThresholds);
  }

  const persist = async (settings, successMessage) => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await updateUserProfile(currentUser.uid, { tableSettings: settings });
      await refreshProfile();
      setMessage(successMessage);
      return true;
    } catch (e) {
      console.error("Error saving table settings:", e?.code || e);
      setError("Sozlamalarni saqlab bo'lmadi. Internet aloqasini tekshirib, qayta urinib ko'ring.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async () => {
    const next = !showGrade;
    setShowGrade(next);
    const ok = await persist(
      { showGrade: next, gradeThresholds: saved.gradeThresholds },
      next ? "Baho ustuni yoqildi" : "Baho ustuni o'chirildi"
    );
    if (!ok) setShowGrade(!next);
  };

  const handleThresholdChange = (grade, value) => {
    setMessage("");
    setThresholds({ ...thresholds, [grade]: value });
  };

  const handleSave = async () => {
    const validationError = validateGradeThresholds(thresholds);
    if (validationError) {
      setMessage("");
      setError(validationError);
      return;
    }
    const gradeThresholds = Object.fromEntries(GRADE_LEVELS.map((grade) => [grade, Number(thresholds[grade])]));
    await persist({ showGrade, gradeThresholds }, "Baho chegaralari saqlandi");
  };

  const validationFailed = validateGradeThresholds(thresholds) !== "";

  const rangeOf = (grade) => {
    if (validationFailed) return "—";
    const from = grade === 1 ? 0 : Number(thresholds[grade]);
    const to = grade === 5 ? 100 : Number(thresholds[grade + 1]);
    return grade === 5 ? `${from}% – ${to}%` : `${from}% – ${to}% gacha`;
  };

  return (
    <DashboardLayout>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Jadval sozlamalari</h1>
        <p className="text-gray-600 mt-1 text-sm sm:text-base">BSB, ChSB va ChSB hisoboti jadvallari ko&apos;rinishini sozlang</p>
      </div>

      <div className="max-w-2xl space-y-4">
        <section className="bg-white rounded-xl shadow-xs border border-gray-200 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="grade-toggle-label" className="text-base font-semibold text-gray-900">Baho ustuni</h2>
              <p className="mt-1 text-sm text-gray-600">
                Yoqilganda jadvalda ball yonida o&apos;quvchining 1 dan 5 gacha bahosi avtomatik chiqadi.
                O&apos;chirilganda bu ustun jadvalda ko&apos;rinmaydi.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={showGrade}
              aria-labelledby="grade-toggle-label"
              disabled={saving || !currentUser}
              onClick={handleToggle}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-70 ${
                showGrade ? "bg-emerald-600" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-6 w-6 rounded-full bg-white shadow transition-transform ${
                  showGrade ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        </section>

        <section className="bg-white rounded-xl shadow-xs border border-gray-200 p-5 sm:p-6">
          <h2 className="text-base font-semibold text-gray-900">Baho chegaralari</h2>
          <p className="mt-1 mb-4 text-sm text-gray-600">
            Baho o&apos;quvchi to&apos;plagan ballning maksimal ballga nisbatan foizidan olinadi, shuning uchun BSB necha ballik bo&apos;lsa ham ishlaydi.
          </p>

          <div className="divide-y divide-gray-100">
            {GRADE_LEVELS.map((grade) => (
              <div key={grade} className="flex items-center gap-3 py-2.5">
                <GradeBadge grade={grade} />
                <label htmlFor={`grade-${grade}`} className="flex-1 text-sm text-gray-700">
                  {rangeOf(grade)}
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Kamida</span>
                  <input
                    id={`grade-${grade}`}
                    type="number"
                    min="1"
                    max="100"
                    value={thresholds[grade]}
                    onChange={(e) => handleThresholdChange(grade, e.target.value)}
                    className="w-20 h-10 px-2 text-center text-base sm:text-sm font-semibold border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-500">%</span>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-3 py-2.5">
              <GradeBadge grade={1} />
              <p className="flex-1 text-sm text-gray-700">{rangeOf(1)}</p>
            </div>
          </div>

          {error && (
            <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>
          )}
          {message && !error && (
            <p role="status" className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">{message}</p>
          )}

          <div className="mt-5 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !currentUser}
              className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 font-medium text-sm transition-colors disabled:bg-gray-400"
            >
              {saving ? "Saqlanmoqda..." : "Saqlash"}
            </button>
            <button
              type="button"
              onClick={() => {
                setError("");
                setMessage("");
                setThresholds({ ...DEFAULT_GRADE_THRESHOLDS });
              }}
              className="bg-gray-100 text-gray-700 px-5 py-2.5 rounded-lg hover:bg-gray-200 font-medium text-sm transition-colors"
            >
              Standart chegaralar
            </button>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
