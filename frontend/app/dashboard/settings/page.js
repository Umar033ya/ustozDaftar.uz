"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/lib/authContext";
import {
  getClasses,
  getStudents,
  getAssessments,
  createClass,
  addStudent,
  setClassStudentCount,
  createAssessment,
  updateResult,
  updateUserProfile,
} from "@/lib/firestoreService";

const LEGACY_KEYS = {
  classes: "ustozdaftar_classes",
  assessments: "ustozdaftar_assessments",
  schoolName: "ustozdaftar_school_name",
  users: "ustozdaftar_users",
  user: "ustozdaftar_user",
};

function readLegacyArray(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return { items: [], corrupt: false };
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return { items: parsed, corrupt: false };
    return { items: [], corrupt: true };
  } catch {
    return { items: [], corrupt: true };
  }
}

function readLegacySchoolName() {
  const raw = localStorage.getItem(LEGACY_KEYS.schoolName);
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "string" ? parsed : raw;
  } catch {
    return raw;
  }
}

const sameName = (a = "", b = "") => a.trim().toLowerCase() === b.trim().toLowerCase();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

/** Firebase requires a recent sign-in for email/password changes. */
const needsReauth = (err) => err?.code === "auth/requires-recent-login" || err?.code === "auth/user-mismatch";

const AUTH_ERRORS = {
  "auth/invalid-email": "Noto'g'ri email manzil kiriting",
  "auth/email-already-in-use": "Bu email boshqa hisobda ishlatilgan",
  "auth/operation-not-allowed": "Emailni o'zgartirish vaqtincha faol emas. Keyinroq urinib ko'ring.",
  "auth/too-many-requests": "Juda ko'p urinish. Birozdan so'ng qayta urinib ko'ring.",
  "auth/user-mismatch": "Email manzili o'zgargan. Iltimos, qayta kiring.",
  "auth/wrong-password": "Joriy parol noto'g'ri",
  "auth/invalid-credential": "Joriy parol noto'g'ri",
  "auth/invalid-login-credentials": "Joriy parol noto'g'ri",
  "auth/weak-password": "Parol kamida 6 belgidan iborat bo'lishi kerak",
  "auth/network-request-failed": "Internet aloqasi uzildi. Qayta urinib ko'ring.",
  "auth/user-disabled": "Bu hisob bloklangan",
};

const errorMessage = (err, fallback) => AUTH_ERRORS[err?.code] || fallback;

export default function Settings() {
  const { currentUser, userProfile, refreshProfile, updateProfileNames, reauthenticate, changeEmail, changePassword } = useAuth();
  const [schoolName, setSchoolName] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Profile (first / last name)
  const [nameForm, setNameForm] = useState({ firstName: "", lastName: "" });
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState("");
  const [nameSuccess, setNameSuccess] = useState(false);

  // Email
  const [emailForm, setEmailForm] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [emailSuccess, setEmailSuccess] = useState("");

  // Password
  const [passwordForm, setPasswordForm] = useState({ password: "", confirmPassword: "" });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Re-authentication prompt (Firebase "recent login" requirement)
  const [reauth, setReauth] = useState(null); // { action: "email" | "password", value }
  const [reauthPassword, setReauthPassword] = useState("");
  const [reauthError, setReauthError] = useState("");
  const [reauthBusy, setReauthBusy] = useState(false);
  const [showReauthPassword, setShowReauthPassword] = useState(false);

  // Migration state
  const [legacyInfo, setLegacyInfo] = useState({ hasData: false, hadAuthKeys: false, corrupt: false });
  const [migrating, setMigrating] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState("");
  const [migrationSuccess, setMigrationSuccess] = useState(false);

  useEffect(() => {
    if (userProfile?.schoolName) {
      setSchoolName(userProfile.schoolName);
    }
  }, [userProfile]);

  useEffect(() => {
    setNameForm({
      firstName: userProfile?.firstName || "",
      lastName: userProfile?.lastName || "",
    });
  }, [userProfile?.firstName, userProfile?.lastName]);

  useEffect(() => {
    setEmailForm(currentUser?.email || "");
  }, [currentUser?.email]);

  useEffect(() => {
    // Detect legacy data and immediately drop the old fake-auth keys (they may hold plain passwords)
    const classes = readLegacyArray(LEGACY_KEYS.classes);
    const assessments = readLegacyArray(LEGACY_KEYS.assessments);
    const hasAuthKeys = Boolean(
      localStorage.getItem(LEGACY_KEYS.users) || localStorage.getItem(LEGACY_KEYS.user)
    );

    if (hasAuthKeys) {
      localStorage.removeItem(LEGACY_KEYS.users);
      localStorage.removeItem(LEGACY_KEYS.user);
    }

    setLegacyInfo({
      hasData: classes.items.length > 0 || assessments.items.length > 0 || hasAuthKeys,
      hadAuthKeys: hasAuthKeys,
      corrupt: classes.corrupt || assessments.corrupt,
    });
  }, []);

  const handleSaveSchoolName = async () => {
    if (!currentUser) return;
    setSaving(true);
    try {
      await updateUserProfile(currentUser.uid, {
        schoolName: schoolName.trim(),
      });
      await refreshProfile();
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error("Error saving school name:", err);
      alert("Maktab nomini saqlashda xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  };

  // ── Profile: first / last name ───────────────────────────────────────────────

  const handleSaveName = async () => {
    const firstName = nameForm.firstName.trim();
    const lastName = nameForm.lastName.trim();

    if (!firstName || !lastName) {
      setNameError("Ism va familiyani to'ldiring");
      return;
    }
    if (firstName === userProfile?.firstName && lastName === userProfile?.lastName) {
      setNameError("");
      return;
    }

    setSavingName(true);
    setNameError("");
    setNameSuccess(false);
    try {
      await updateProfileNames(firstName, lastName);
      setNameForm({ firstName, lastName });
      setNameSuccess(true);
      setTimeout(() => setNameSuccess(false), 3000);
    } catch (err) {
      console.error("Error saving profile name:", err);
      setNameError(errorMessage(err, "Ism va familiyani saqlashda xatolik yuz berdi"));
    } finally {
      setSavingName(false);
    }
  };

  // ── Email ────────────────────────────────────────────────────────────────────

  const performEmailChange = async (newEmail) => {
    setSavingEmail(true);
    setEmailError("");
    try {
      const { email, pendingVerification } = await changeEmail(newEmail);
      // While verification is pending the Auth email is still the old one, so keep the
      // field showing the active address instead of an address that is not in effect yet.
      setEmailForm(pendingVerification ? currentUser?.email || email : email);
      setEmailSuccess(
        pendingVerification
          ? `Tasdiqlash havolasi ${email} manziliga yuborildi. Havolani bosishdan keyin email o'zgaradi.`
          : `Email muvaffaqiyatli yangilandi: ${email}`
      );
      setTimeout(() => setEmailSuccess(""), 8000);
    } catch (err) {
      console.error("Error changing email:", err);
      if (needsReauth(err)) {
        // ask for the current password instead of failing silently
        openReauth({ action: "email", value: newEmail });
      } else if (err?.message === "PROFILE_EMAIL_SYNC_FAILED") {
        setEmailSuccess("");
        setEmailError(
          "Email Firebase Authentication da yangilandi, ammo Firestore profili sinxronlanmadi. Sahifani yangilab ko'ring."
        );
      } else {
        setEmailSuccess("");
        setEmailError(errorMessage(err, "Emailni yangilashda xatolik yuz berdi"));
      }
    } finally {
      setSavingEmail(false);
    }
  };

  const handleSaveEmail = async (e) => {
    e.preventDefault();
    const newEmail = emailForm.trim();

    if (!newEmail) {
      setEmailError("Email manzilini kiriting");
      return;
    }
    if (!EMAIL_REGEX.test(newEmail)) {
      setEmailError("To'g'ri email manzil kiriting");
      return;
    }
    if (newEmail === currentUser?.email) {
      setEmailError("Yangi email kiriting");
      return;
    }

    await performEmailChange(newEmail);
  };

  // ── Password ─────────────────────────────────────────────────────────────────

  const performPasswordChange = async (newPassword) => {
    setSavingPassword(true);
    setPasswordError("");
    try {
      await changePassword(newPassword);
      // never keep the new password in component state after a successful change
      setPasswordForm({ password: "", confirmPassword: "" });
      setShowPassword(false);
      setShowConfirmPassword(false);
      setPasswordSuccess(true);
      setTimeout(() => setPasswordSuccess(false), 5000);
    } catch (err) {
      console.error("Error changing password:", err);
      if (needsReauth(err)) {
        openReauth({ action: "password", value: newPassword });
      } else {
        setPasswordSuccess(false);
        setPasswordError(errorMessage(err, "Parolni o'zgartirishda xatolik yuz berdi"));
      }
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSavePassword = async (e) => {
    e.preventDefault();
    const { password, confirmPassword } = passwordForm;

    if (!password || !confirmPassword) {
      setPasswordError("Barcha maydonlarni to'ldiring");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(`Parol kamida ${MIN_PASSWORD_LENGTH} belgidan iborat bo'lishi kerak`);
      return;
    }
    if (password !== confirmPassword) {
      setPasswordError("Parollar mos kelmaydi");
      return;
    }

    await performPasswordChange(password);
  };

  // ── Re-authentication prompt ─────────────────────────────────────────────────

  const openReauth = (request) => {
    setReauth(request);
    setReauthError("");
    setReauthPassword("");
    setShowReauthPassword(false);
  };

  const closeReauth = () => {
    setReauth(null);
    setReauthError("");
    setReauthPassword("");
    setShowReauthPassword(false);
  };

  const handleConfirmReauth = async (e) => {
    e.preventDefault();
    if (!reauthPassword) {
      setReauthError("Joriy parolni kiriting");
      return;
    }

    const request = reauth;
    setReauthBusy(true);
    setReauthError("");
    try {
      await reauthenticate(reauthPassword);
      closeReauth();
      if (request.action === "email") {
        await performEmailChange(request.value);
      } else {
        await performPasswordChange(request.value);
      }
    } catch (err) {
      console.error("Re-authentication failed:", err);
      setReauthError(errorMessage(err, "Tasdiqlashda xatolik yuz berdi"));
    } finally {
      setReauthBusy(false);
      setReauthPassword("");
    }
  };

  const handleMigrateData = async () => {
    if (!currentUser) return;

    const legacyClasses = readLegacyArray(LEGACY_KEYS.classes);
    const legacyAssessments = readLegacyArray(LEGACY_KEYS.assessments);

    if (legacyClasses.items.length === 0 && legacyAssessments.items.length === 0) {
      setMigrationStatus("Ko'chirish uchun lokal ma'lumot topilmadi");
      setLegacyInfo((prev) => ({ ...prev, hasData: false }));
      return;
    }

    if (!confirm("Eski (lokal) ma'lumotlaringizni Firestore bulutli bazasiga ko'chirishni tasdiqlaysizmi?")) {
      return;
    }

    setMigrating(true);
    setMigrationSuccess(false);
    setMigrationStatus("Ma'lumotlar ko'chirilmoqda...");

    try {
      const uid = currentUser.uid;
      const existingClasses = await getClasses(uid);
      const existingAssessments = await getAssessments(uid);

      const classIdMap = {}; // legacy class id -> { newClassId, studentIdMap }
      let newClasses = 0;
      let reusedClasses = 0;

      // 1. Classes and students (idempotent: existing classes/students are reused)
      for (let i = 0; i < legacyClasses.items.length; i++) {
        const cls = legacyClasses.items[i];
        setMigrationStatus(`Sinf ko'chirilmoqda (${i + 1}/${legacyClasses.items.length}): ${cls.name}`);

        const knownClass = existingClasses.find(
          (c) => sameName(c.name, cls.name) && c.academicYear === cls.academicYear
        );

        let newClassId;
        if (knownClass) {
          newClassId = knownClass.id;
          reusedClasses++;
        } else {
          newClassId = await createClass(uid, {
            name: cls.name,
            academicYear: cls.academicYear,
          });
          existingClasses.push({ id: newClassId, name: cls.name, academicYear: cls.academicYear });
          newClasses++;
        }

        const classStudents = await getStudents(uid, newClassId);
        const studentIdMap = {};

        for (const std of cls.students || []) {
          if (!std?.name) continue;
          const knownStudent = classStudents.find((s) => sameName(s.name, std.name));
          if (knownStudent) {
            studentIdMap[std.id] = knownStudent.id;
            continue;
          }
          const created = await addStudent(uid, newClassId, std.name);
          classStudents.push(created);
          studentIdMap[std.id] = created.id;
        }

        await setClassStudentCount(uid, newClassId, classStudents.length);
        classIdMap[cls.id] = { newClassId, studentIdMap };
      }

      // 2. Assessments (already imported ones are skipped, never duplicated)
      let newAssessments = 0;
      let skippedAssessments = 0;
      let skippedResults = 0;

      for (let i = 0; i < legacyAssessments.items.length; i++) {
        const ast = legacyAssessments.items[i];
        setMigrationStatus(`Baholash ko'chirilmoqda (${i + 1}/${legacyAssessments.items.length}): ${ast.subject}`);

        const mapped = classIdMap[ast.classId];
        if (!mapped) {
          skippedAssessments++;
          continue;
        }

        if (existingAssessments.some((a) => a.migratedFromId && a.migratedFromId === ast.id)) {
          skippedAssessments++;
          continue;
        }

        const classStudents = await getStudents(uid, mapped.newClassId);
        const localResults = ast.results || [];
        const orderedStudents = [];
        const resultTargetIds = [];

        for (const r of localResults) {
          const targetId = mapped.studentIdMap[r.studentId];
          if (!targetId) {
            // result without a matching student in the class roster
            skippedResults++;
            continue;
          }
          if (orderedStudents.some((s) => s.id === targetId)) continue;
          const student = classStudents.find((s) => s.id === targetId);
          if (!student) {
            skippedResults++;
            continue;
          }
          orderedStudents.push(student);
          resultTargetIds.push({ legacyResult: r, targetId });
        }

        // keep exactly one row per class student
        for (const s of classStudents) {
          if (!orderedStudents.some((existing) => existing.id === s.id)) {
            orderedStudents.push(s);
          }
        }

        if (orderedStudents.length === 0) {
          skippedAssessments++;
          continue;
        }

        const assessmentData = {
          type: ast.type,
          classId: mapped.newClassId,
          className: ast.className,
          academicYear: ast.academicYear,
          subject: ast.subject,
          number: ast.number,
          date: ast.date,
          migratedFromId: ast.id,
          ...(ast.type === "BSB"
            ? { tasks: ast.tasks || [], maxTotal: ast.maxTotal || 0 }
            : { maxScore: ast.maxScore || 40 }),
        };

        const newAssessmentId = await createAssessment(uid, assessmentData, orderedStudents);
        existingAssessments.push({ id: newAssessmentId, migratedFromId: ast.id });
        newAssessments++;

        for (const { legacyResult, targetId } of resultTargetIds) {
          const resultData =
            ast.type === "BSB"
              ? {
                  scores: legacyResult.scores || [],
                  total: legacyResult.total || 0,
                  percentage: legacyResult.percentage || 0,
                }
              : {
                  total: legacyResult.total === "" ? "" : legacyResult.total,
                  percentage: legacyResult.percentage || 0,
                };
          await updateResult(uid, newAssessmentId, targetId, resultData);
        }
      }

      // 3. School name if available
      const legacySchoolName = readLegacySchoolName();
      if (legacySchoolName && !userProfile?.schoolName) {
        await updateUserProfile(uid, { schoolName: legacySchoolName });
        setSchoolName(legacySchoolName);
        await refreshProfile();
      }

      // 4. Clean up legacy storage (incl. old fake-auth keys with plain passwords)
      Object.values(LEGACY_KEYS).forEach((key) => localStorage.removeItem(key));

      setLegacyInfo({ hasData: false, hadAuthKeys: false, corrupt: false });
      setMigrationSuccess(true);
      setMigrationStatus(
        `Tayyor! ${newClasses} ta yangi sinf, ${newAssessments} ta baholash ko'chirildi` +
          (reusedClasses > 0 ? ` (${reusedClasses} ta sinf allaqachon mavjud bo'lgani uchun qo'shilmadi)` : "") +
          (skippedAssessments > 0 ? `, ${skippedAssessments} ta baholash o'tkazilmadi` : "") +
          (skippedResults > 0 ? `, ${skippedResults} ta natija sinf ro'yxatida topilmadi` : "") +
          "."
      );
    } catch (err) {
      console.error("Migration error:", err);
      setMigrationSuccess(false);
      setMigrationStatus("Ko'chirishda xatolik yuz berdi: " + err.message);
    } finally {
      setMigrating(false);
    }
  };

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Sozlamalar</h1>
        <p className="text-gray-600 mt-1 text-sm sm:text-base">Hisob, maktab ma'lumotlari va ma'lumotlarni boshqarish</p>
      </div>

      <div className="max-w-3xl space-y-6">
        {/* Profile: first / last name */}
        <div className="bg-white rounded-xl shadow-xs p-5 sm:p-6 border border-gray-200">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">Hisob ma&apos;lumotlari</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                  Ism
                </label>
                <input
                  id="firstName"
                  type="text"
                  value={nameForm.firstName}
                  onChange={(e) => setNameForm({ ...nameForm, firstName: e.target.value })}
                  className="block w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Masalan: Bekzod"
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                  Familiya
                </label>
                <input
                  id="lastName"
                  type="text"
                  value={nameForm.lastName}
                  onChange={(e) => setNameForm({ ...nameForm, lastName: e.target.value })}
                  className="block w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Masalan: Karimov"
                />
              </div>
            </div>

            {nameError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg text-sm font-medium">
                {nameError}
              </div>
            )}
            {nameSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2.5 rounded-lg text-sm font-medium">
                Ism va familiya muvaffaqiyatli saqlandi!
              </div>
            )}

            <button
              onClick={handleSaveName}
              disabled={savingName}
              className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 font-medium text-sm transition-colors disabled:bg-gray-400"
            >
              {savingName ? "Saqlanmoqda..." : "Saqlash"}
            </button>
          </div>
        </div>

        {/* Email */}
        <div className="bg-white rounded-xl shadow-xs p-5 sm:p-6 border border-gray-200">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-1">Email manzili</h2>
          <p className="text-gray-600 text-sm mb-4">
            Kirish uchun ishlatiladigan email. O&apos;zgartirish uchun yangi manzilga tasdiqlash
            havolasi yuboriladi - havolani bosganingizdan keyin email o&apos;zgaradi.
          </p>
          <form onSubmit={handleSaveEmail} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={emailForm}
                onChange={(e) => setEmailForm(e.target.value)}
                className="block w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="email@example.com"
              />
            </div>

            {emailError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg text-sm font-medium">
                {emailError}
              </div>
            )}
            {emailSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2.5 rounded-lg text-sm font-medium">
                {emailSuccess}
              </div>
            )}

            <button
              type="submit"
              disabled={savingEmail}
              className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 font-medium text-sm transition-colors disabled:bg-gray-400"
            >
              {savingEmail ? "Yangilanmoqda..." : "Emailni yangilash"}
            </button>
          </form>
        </div>

        {/* Password */}
        <div className="bg-white rounded-xl shadow-xs p-5 sm:p-6 border border-gray-200">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-1">Parolni o&apos;zgartirish</h2>
          <p className="text-gray-600 text-sm mb-4">
            Parol hech qachon Firebase ma&apos;lumotlar bazasi yoki brauzeringizda saqlanmaydi.
          </p>
          <form onSubmit={handleSavePassword} className="space-y-4">
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Yangi parol
              </label>
              <div className="relative mt-1">
                <input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={passwordForm.password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })}
                  className="block w-full px-3.5 py-2.5 pr-11 border border-gray-300 rounded-lg text-sm shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={`Kamida ${MIN_PASSWORD_LENGTH} belgi`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600 transition-colors"
                  title={showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
                  aria-label={showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18M10.58 10.58a2 2 0 002.83 2.83M9.9 4.24A9.12 9.12 0 0112 4c7 0 10 8 10 8a17.9 17.9 0 01-2.16 3.19M6.61 6.61A17.9 17.9 0 002 12s3 8 10 8a9.12 9.12 0 004.1-.9" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="newConfirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Yangi parolni tasdiqlash
              </label>
              <div className="relative mt-1">
                <input
                  id="newConfirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  className="block w-full px-3.5 py-2.5 pr-11 border border-gray-300 rounded-lg text-sm shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Parolni qayta kiriting"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600 transition-colors"
                  title={showConfirmPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
                  aria-label={showConfirmPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
                  aria-pressed={showConfirmPassword}
                >
                  {showConfirmPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18M10.58 10.58a2 2 0 002.83 2.83M9.9 4.24A9.12 9.12 0 0112 4c7 0 10 8 10 8a17.9 17.9 0 01-2.16 3.19M6.61 6.61A17.9 17.9 0 002 12s3 8 10 8a9.12 9.12 0 004.1-.9" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {passwordError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg text-sm font-medium">
                {passwordError}
              </div>
            )}
            {passwordSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2.5 rounded-lg text-sm font-medium">
                Parol muvaffaqiyatli o&apos;zgartirildi!
              </div>
            )}

            <button
              type="submit"
              disabled={savingPassword}
              className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 font-medium text-sm transition-colors disabled:bg-gray-400"
            >
              {savingPassword ? "O'zgartirilmoqda..." : "Parolni o'zgartirish"}
            </button>
          </form>
        </div>

        {/* School Settings */}
        <div className="bg-white rounded-xl shadow-xs p-5 sm:p-6 border border-gray-200">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">Maktab ma'lumotlari</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="schoolName" className="block text-sm font-medium text-gray-700 mb-1">
                Maktab nomi (Rasmiy jadvallar uchun)
              </label>
              <input
                id="schoolName"
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className="block w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Masalan: 317-sonli umumta'lim maktabi"
              />
              <p className="text-xs text-gray-500 mt-1.5">
                Ushbu nom barcha BSB va ChSB rasmiy natijalar huquqiy sarlavhasida chop etiladi
              </p>
            </div>

            {savedSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2.5 rounded-lg text-sm font-medium">
                Maktab nomi muvaffaqiyatli saqlandi!
              </div>
            )}

            <button
              onClick={handleSaveSchoolName}
              disabled={saving}
              className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 font-medium text-sm transition-colors disabled:bg-gray-400"
            >
              {saving ? "Saqlanmoqda..." : "Saqlash"}
            </button>
          </div>
        </div>

        {/* Firebase Data Migration Tool */}
        <div className="bg-white rounded-xl shadow-xs p-5 sm:p-6 border border-blue-200 bg-blue-50/20">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
            Lokal ma'lumotlarni ko'chirish (Migration Tool)
          </h2>
          <p className="text-gray-600 text-sm mb-4">
            Agar siz muqaddam ushbu brauzerda (localStorage) sinflar, o'quvchilar yoki BSB/ChSB yaratgan bo'lsangiz, ularni bir bosish bilan Firebase shaxsiy hisobingizga ko'chirishingiz mumkin.
          </p>

          {migrationStatus && (
            <div
              className={`p-4 rounded-lg mb-4 text-sm font-medium border ${
                migrationSuccess
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : "bg-blue-50 border-blue-200 text-blue-700"
              }`}
            >
              {migrationStatus}
            </div>
          )}

          {legacyInfo.hadAuthKeys && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg mb-4 text-sm">
              Eski versiyadagi mahalliy hisob ma'lumotlari (ochiq parol saqlangan bo'lishi mumkin) bu
              brauzerdan butunlay o'chirildi. Parollar endi faqat Firebase orqali saqlanadi.
            </div>
          )}

          {legacyInfo.corrupt && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg mb-4 text-sm">
              Ba'zi lokal ma'lumotlar buzilgan va o'qib bo'lmadi. Buzilgan qismi import qilinmadi.
            </div>
          )}

          {legacyInfo.hasData ? (
            <button
              onClick={handleMigrateData}
              disabled={migrating}
              className="bg-emerald-600 text-white px-5 py-2.5 rounded-lg hover:bg-emerald-700 font-medium text-sm transition-colors disabled:bg-gray-400 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              {migrating ? "Ko'chirilmoqda..." : "Lokal ma'lumotlarni Firebase ga o'tkazish"}
            </button>
          ) : (
            <p className="text-xs text-emerald-600 font-semibold bg-emerald-50 border border-emerald-200 p-3 rounded-lg">
              ✓ Brauzerda ko'chirilishi kerak bo'lgan lokal ma'lumotlar mavjud emas. Barcha ma'lumotlaringiz Firebase bilan xavfsiz bog'langan.
            </p>
          )}
        </div>

        {/* App Info */}
        <div className="bg-white rounded-xl shadow-xs p-5 sm:p-6 border border-gray-200">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3">Dastur haqida</h2>
          <div className="space-y-1.5 text-xs sm:text-sm text-gray-600">
            <p><strong>Nomi:</strong> UstozDaftar.uz</p>
            <p><strong>Tavsif:</strong> BSB va ChSB Natijalarini Avtomatlashtirish Tizimi (Firebase Backend)</p>
            <p><strong>Versiya:</strong> 2.0.0 (Firebase Cloud)</p>
          </div>
        </div>
      </div>

      {/* Re-authentication prompt (Firebase recent-login requirement) */}
      {reauth && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
          <div className="bg-white rounded-xl shadow-lg p-5 sm:p-6 w-full max-w-sm border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Xavfsizlikni tasdiqlang</h2>
            <p className="text-gray-600 text-sm mt-1.5">
              {reauth.action === "email"
                ? "Emailni o'zgartirish uchun hisobingizni tasdiqlashingiz kerak."
                : "Parolni o'zgartirish uchun hisobingizni tasdiqlashingiz kerak."}{" "}
              Joriy parolni kiriting.
            </p>

            <form onSubmit={handleConfirmReauth} className="mt-4 space-y-4">
              <div>
                <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Joriy parol
                </label>
                <div className="relative mt-1">
                  <input
                    id="currentPassword"
                    type={showReauthPassword ? "text" : "password"}
                    autoComplete="current-password"
                    autoFocus
                    value={reauthPassword}
                    onChange={(e) => setReauthPassword(e.target.value)}
                    className="block w-full px-3.5 py-2.5 pr-11 border border-gray-300 rounded-lg text-sm shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Joriy parolingiz"
                  />
                  <button
                    type="button"
                    onClick={() => setShowReauthPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600 transition-colors"
                    title={showReauthPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
                    aria-label={showReauthPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
                    aria-pressed={showReauthPassword}
                  >
                    {showReauthPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18M10.58 10.58a2 2 0 002.83 2.83M9.9 4.24A9.12 9.12 0 0112 4c7 0 10 8 10 8a17.9 17.9 0 01-2.16 3.19M6.61 6.61A17.9 17.9 0 002 12s3 8 10 8a9.12 9.12 0 004.1-.9" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {reauthError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg text-sm font-medium">
                  {reauthError}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="submit"
                  disabled={reauthBusy}
                  className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 font-medium text-sm transition-colors disabled:bg-gray-400"
                >
                  {reauthBusy ? "Tasdiqlanmoqda..." : "Tasdiqlash"}
                </button>
                <button
                  type="button"
                  onClick={closeReauth}
                  disabled={reauthBusy}
                  className="bg-gray-100 text-gray-700 px-5 py-2.5 rounded-lg hover:bg-gray-200 font-medium text-sm transition-colors"
                >
                  Bekor qilish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
