"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import LoadingState from "@/components/LoadingState";
import SaveStatus from "@/components/SaveStatus";
import TeacherSignature from "@/components/TeacherSignature";
import ResultTableToolbar, { matchesStudent, rowHighlightClass } from "@/components/ResultTableToolbar";
import { useAuth } from "@/lib/authContext";
import { getChsbReportById, saveChsbReportMarks } from "@/lib/firestoreService";
import { formatScore, summarizeChsbReport } from "@/lib/chsbReport";
import { gradeFromPercentage, normalizeTableSettings, teacherFullName } from "@/lib/grades";
import { exportChsbReportToExcel } from "@/lib/excelExport";

const cellKey = (studentId, question) => `${studentId}:${question}`;
const POPOVER_GAP = 6;
const VIEWPORT_MARGIN = 8;

function CheckIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export default function ChsbReportDetail() {
  const router = useRouter();
  const { id: reportId } = useParams();
  const { currentUser, userProfile } = useAuth();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeCell, setActiveCell] = useState(null);
  const [popoverPosition, setPopoverPosition] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [highlightEntered, setHighlightEntered] = useState(false);

  const popoverRef = useRef(null);
  const pendingChanges = useRef(new Map());
  const saveTimer = useRef(null);

  useEffect(() => {
    if (!currentUser || !reportId) return;
    getChsbReportById(currentUser.uid, reportId)
      .then((loaded) => {
        if (loaded) setReport(loaded);
        else router.push("/dashboard/chsb-reports");
      })
      .catch((err) => console.error("Error loading ChSB report:", err))
      .finally(() => setLoading(false));
  }, [currentUser, reportId, router]);

  const flushChanges = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (pendingChanges.current.size === 0) return;
    const batch = new Map(pendingChanges.current);
    pendingChanges.current.clear();
    setSaving(true);
    try {
      await saveChsbReportMarks(currentUser.uid, reportId, [...batch.values()]);
      setSaveError(false);
    } catch (e) {
      console.error("Error saving ChSB report marks:", e?.code || e);
      // Keep the marks for a retry, unless a newer mark for the same cell is already queued
      batch.forEach((change, key) => {
        if (!pendingChanges.current.has(key)) pendingChanges.current.set(key, change);
      });
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }, [currentUser, reportId]);

  // Never lose the last marks: flush on navigation, tab switch or reload
  useEffect(() => {
    const flush = () => {
      flushChanges();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", flush);
      flush();
    };
  }, [flushChanges]);

  const setMark = (studentId, question, value) => {
    setReport((current) => {
      const studentMarks = { ...(current.marks[studentId] || {}) };
      if (value === null) delete studentMarks[question];
      else studentMarks[question] = value;
      return { ...current, marks: { ...current.marks, [studentId]: studentMarks } };
    });
    pendingChanges.current.set(cellKey(studentId, question), { studentId, question, value });
    setSaving(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flushChanges, 600);
  };

  const summary = useMemo(() => (report ? summarizeChsbReport(report, report.students) : null), [report]);
  const settings = normalizeTableSettings(userProfile?.tableSettings);
  const teacherName = teacherFullName(userProfile);
  const schoolName = userProfile?.schoolName || "";

  const closePopover = useCallback(() => {
    setActiveCell(null);
    setPopoverPosition(null);
  }, []);

  /** After a ✓ / ✗ the next question of the same student opens, so a paper is marked in one go. */
  const answer = (value) => {
    const { studentId, question } = activeCell;
    setMark(studentId, question, value);
    if (value !== null && question + 1 < report.questions.length) {
      setActiveCell({ studentId, question: question + 1 });
    } else {
      closePopover();
    }
  };

  const activeElement = useCallback(() => {
    if (!activeCell) return null;
    return document.querySelector(`[data-cell="${cellKey(activeCell.studentId, activeCell.question)}"]`);
  }, [activeCell]);

  // The popover sits outside the scrollable table, otherwise the table would clip it
  useLayoutEffect(() => {
    if (!activeCell) return undefined;

    const place = () => {
      const cell = activeElement();
      const popover = popoverRef.current;
      if (!cell || !popover || cell.offsetParent === null) {
        closePopover();
        return;
      }
      const rect = cell.getBoundingClientRect();
      const width = popover.offsetWidth;
      const height = popover.offsetHeight;
      const fitsBelow = rect.bottom + POPOVER_GAP + height + VIEWPORT_MARGIN <= window.innerHeight;
      setPopoverPosition({
        top: fitsBelow ? rect.bottom + POPOVER_GAP : Math.max(VIEWPORT_MARGIN, rect.top - POPOVER_GAP - height),
        left: Math.min(
          window.innerWidth - width - VIEWPORT_MARGIN,
          Math.max(VIEWPORT_MARGIN, rect.left + rect.width / 2 - width / 2)
        ),
      });
    };

    activeElement()?.scrollIntoView({ block: "nearest", inline: "nearest" });
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [activeCell, activeElement, closePopover]);

  useEffect(() => {
    if (!activeCell) return undefined;
    popoverRef.current?.querySelector("button")?.focus({ preventScroll: true });

    const onPointerDown = (e) => {
      if (popoverRef.current?.contains(e.target) || e.target.closest?.("[data-cell]")) return;
      closePopover();
    };
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      activeElement()?.focus();
      closePopover();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [activeCell, activeElement, closePopover]);

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    setExportError("");
    try {
      await exportChsbReportToExcel(report, summary, schoolName, {
        teacherName,
        showGrade: settings.showGrade,
        gradeThresholds: settings.gradeThresholds,
      });
    } catch (e) {
      console.error("Excel export failed:", e);
      setExportError("Excel faylini yaratib bo'lmadi. Sahifani yangilab, qayta urinib ko'ring.");
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <LoadingState />
      </DashboardLayout>
    );
  }

  if (!report || !summary) return null;

  const activeMark =
    activeCell && summary.rows.find((row) => row.studentId === activeCell.studentId)?.marks[activeCell.question];
  const footerExtraCols = settings.showGrade ? 1 : 0;

  return (
    <DashboardLayout>
      <div className="mb-4 sm:mb-6 print:hidden">
        <Link href="/dashboard/chsb-reports" className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-2 inline-block">
          ← ChSB hisobotiga qaytish
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              {report.number}-ChSB hisoboti - {report.subject}
            </h1>
            <p className="text-gray-600 mt-0.5 text-xs sm:text-sm">
              {report.className} ({report.academicYear}) • {report.date}
            </p>
          </div>
          <div className="flex gap-2 sm:gap-3">
            <button
              onClick={handleExport}
              disabled={exporting}
              aria-busy={exporting}
              className="bg-emerald-600 text-white px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg hover:bg-emerald-700 font-medium text-xs sm:text-sm transition-colors shadow-xs disabled:opacity-70 disabled:cursor-wait"
            >
              {exporting ? "Tayyorlanmoqda..." : "Excelga yuklash"}
            </button>
            <button
              onClick={() => window.print()}
              className="bg-blue-600 text-white px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg hover:bg-blue-700 font-medium text-xs sm:text-sm transition-colors shadow-xs"
            >
              Chop etish (A4)
            </button>
          </div>
        </div>
        {exportError && (
          <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
            {exportError}
          </p>
        )}
      </div>

      <div className="bg-white border border-gray-300 shadow-sm rounded-lg mb-6 p-4 sm:p-6 print:border-none print:shadow-none print:p-0 print:mb-0">
        <div className="mb-4 text-center">
          <h2 className="text-lg font-extrabold text-gray-900 tracking-wide">BAYONNOMA</h2>
          <p className="text-sm font-semibold text-gray-900 mt-1">
            {report.className} sinfida {report.subject} fanidan {report.number}-ChSBni o&apos;tkazish bo&apos;yicha
          </p>
          {schoolName && <p className="text-sm text-gray-700">{schoolName}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-4 mb-4">
          <table className="w-full border-collapse text-xs sm:text-sm">
            <tbody>
              {[
                ["O'tkazilgan sanasi", report.date],
                ["Sinfdagi o'quvchilar soni", summary.studentCount],
                ["Ishtirok etdi", summary.participatedCount],
                ["Ishtirok etmadi", summary.absentCount],
              ].map(([label, value]) => (
                <tr key={label}>
                  <th scope="row" className="px-3 py-1.5 border border-gray-300 text-left font-medium text-gray-700">{label}</th>
                  <td className="px-3 py-1.5 border border-gray-300 text-center font-bold text-gray-900 w-28">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table className="w-full border-collapse text-xs sm:text-sm self-start">
            <tbody>
              <tr>
                <th scope="row" className="px-3 py-1.5 border border-gray-300 text-left font-medium text-gray-700">Maksimal ball</th>
                <td className="px-3 py-1.5 border border-gray-300 text-center font-bold text-gray-900">{formatScore(summary.maxScore)}</td>
              </tr>
              <tr>
                <th scope="row" className="px-3 py-1.5 border border-gray-300 text-left font-medium text-gray-700">Fan bo&apos;yicha o&apos;qituvchi</th>
                <td className="px-3 py-1.5 border border-gray-300 text-center font-bold text-gray-900">{teacherName || "—"}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <ResultTableToolbar
          search={studentSearch}
          onSearchChange={setStudentSearch}
          highlight={highlightEntered}
          onHighlightChange={setHighlightEntered}
          enteredCount={summary.participatedCount}
          totalCount={summary.studentCount}
        />

        <p className="mb-2 text-xs text-gray-500 print:hidden">
          Katakchani bosing: <span className="font-semibold text-green-700">✓</span> savolning to&apos;liq bali, <span className="font-semibold text-red-700">✗</span> 0 ball.
        </p>

        <div className="print-fit-wrap overflow-x-auto rounded-lg border border-gray-300">
          <table className="print-fit-table w-full border-collapse text-xs sm:text-sm">
            <thead className="bg-gray-100 text-gray-900 font-bold border-b-2 border-gray-400">
              <tr>
                <th rowSpan={2} className="px-2 py-2 border border-gray-300 text-center w-10">T/r</th>
                <th rowSpan={2} className="px-3 py-2 border border-gray-300 text-left w-32 max-w-32 sm:w-auto sm:max-w-none sm:min-w-[220px] sticky left-0 z-10 bg-gray-100 print:static">
                  O&apos;quvchilarning ism-familiyasi
                </th>
                <th colSpan={report.questions.length} className="px-2 py-1.5 border border-gray-300 text-center">Topshiriqlar</th>
                <th rowSpan={2} className="px-2 py-2 border border-gray-300 text-center w-14 bg-gray-200">Ball</th>
                <th rowSpan={2} className="px-2 py-2 border border-gray-300 text-center w-14 bg-gray-200">%</th>
                {settings.showGrade && <th rowSpan={2} className="px-2 py-2 border border-gray-300 text-center w-14 bg-gray-200">Baho</th>}
              </tr>
              <tr>
                {report.questions.map((_, q) => (
                  <th key={q} className="px-1 py-1.5 border border-gray-300 text-center min-w-[46px]">{q + 1}</th>
                ))}
              </tr>
            </thead>

            <tbody>
              <tr className="bg-blue-50/70 font-bold text-blue-900">
                <td className="px-2 py-2 border border-gray-300 text-center text-xs">Maks</td>
                <td className="student-name-cell px-3 py-2 border border-gray-300 text-xs max-w-32 truncate sm:max-w-none sticky left-0 z-[1] bg-blue-50 print:static">Savol bo&apos;yicha maksimal ball</td>
                {report.questions.map((points, q) => (
                  <td key={q} className="px-1 py-2 border border-gray-300 text-center font-extrabold">{formatScore(points)}</td>
                ))}
                <td className="px-2 py-2 border border-gray-300 text-center font-extrabold bg-blue-100/50">{formatScore(summary.maxScore)}</td>
                <td className="px-2 py-2 border border-gray-300 text-center font-extrabold bg-blue-100/50">100%</td>
                {settings.showGrade && <td className="px-2 py-2 border border-gray-300 text-center font-extrabold bg-blue-100/50">5</td>}
              </tr>

              {summary.rows.map((row, rowIndex) => {
                const rowColor = rowHighlightClass(row.participated, highlightEntered);
                const hiddenBySearch = !matchesStudent(row, studentSearch);
                return (
                  <tr key={row.studentId} className={`${rowColor} ${hiddenBySearch ? "hidden print:table-row" : ""}`}>
                    <td className="px-2 py-1.5 border border-gray-300 text-center font-medium text-gray-700">{rowIndex + 1}</td>
                    <td title={row.studentName} className={`student-name-cell px-3 py-1.5 border border-gray-300 font-semibold text-gray-900 whitespace-nowrap max-w-32 truncate sm:max-w-none sticky left-0 z-[1] print:static ${rowColor || "bg-white"}`}>
                      {row.studentName}
                    </td>
                    {row.marks.map((mark, q) => {
                      const isActive = activeCell?.studentId === row.studentId && activeCell?.question === q;
                      const tone =
                        mark === true
                          ? "bg-green-50 text-green-800 hover:bg-green-100"
                          : mark === false
                            ? "bg-red-50 text-red-700 hover:bg-red-100"
                            : "bg-white text-gray-300 hover:bg-gray-100";
                      return (
                        <td key={q} className="p-0 border border-gray-300 text-center">
                          <button
                            type="button"
                            data-cell={cellKey(row.studentId, q)}
                            aria-haspopup="dialog"
                            aria-expanded={isActive}
                            aria-label={`${row.studentName}, ${q + 1}-savol: ${mark === true ? "to'g'ri" : mark === false ? "noto'g'ri" : "belgilanmagan"}`}
                            onClick={() => (isActive ? closePopover() : setActiveCell({ studentId: row.studentId, question: q }))}
                            className={`block w-full h-10 sm:h-9 scroll-ml-32 sm:scroll-ml-60 font-semibold transition-colors print:h-auto print:bg-white print:text-black ${tone} ${
                              isActive ? "outline-2 -outline-offset-2 outline-blue-600" : ""
                            }`}
                          >
                            {mark === true ? formatScore(report.questions[q]) : mark === false ? "0" : "–"}
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-2 py-1.5 border border-gray-300 text-center font-bold text-gray-900 bg-gray-50">
                      {row.participated ? formatScore(row.total) : "—"}
                    </td>
                    <td className="px-2 py-1.5 border border-gray-300 text-center font-bold text-gray-900 bg-gray-50">
                      {row.participated ? `${Math.round(row.percentage)}%` : "—"}
                    </td>
                    {settings.showGrade && (
                      <td className="px-2 py-1.5 border border-gray-300 text-center font-extrabold text-gray-900 bg-gray-50">
                        {gradeFromPercentage(row.percentage, settings.gradeThresholds) ?? "—"}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>

            <tfoot className="bg-gray-100 font-bold border-t-2 border-gray-400 text-gray-900">
              <tr>
                <td colSpan={2} className="px-3 py-2 border border-gray-300 text-xs sm:text-sm font-extrabold">O&apos;rtacha ball</td>
                {summary.questionStats.map((stat, q) => (
                  <td key={q} className="px-1 py-2 border border-gray-300 text-center">{stat.average === null ? "—" : formatScore(stat.average)}</td>
                ))}
                <td className="px-2 py-2 border border-gray-300 text-center font-extrabold text-blue-700 bg-gray-200">
                  {summary.averageScore === null ? "—" : formatScore(summary.averageScore)}
                </td>
                <td className="px-2 py-2 border border-gray-300 text-center font-extrabold text-blue-700 bg-gray-200">
                  {summary.averagePercentage === null ? "—" : `${summary.averagePercentage}%`}
                </td>
                {footerExtraCols > 0 && <td className="border border-gray-300 bg-gray-200" />}
              </tr>
              <tr>
                <td colSpan={2} className="px-3 py-2 border border-gray-300 text-xs sm:text-sm font-extrabold">To&apos;g&apos;ri javob berganlar soni</td>
                {summary.questionStats.map((stat, q) => (
                  <td key={q} className="px-1 py-2 border border-gray-300 text-center">{stat.checkedCount ? stat.correctCount : "—"}</td>
                ))}
                <td colSpan={2 + footerExtraCols} className="border border-gray-300 bg-gray-200" />
              </tr>
              <tr>
                <td colSpan={2} className="px-3 py-2 border border-gray-300 text-xs sm:text-sm font-extrabold">To&apos;g&apos;ri javob berganlarning ulushi</td>
                {summary.questionStats.map((stat, q) => (
                  <td key={q} className="px-1 py-2 border border-gray-300 text-center">{stat.share === null ? "—" : `${stat.share}%`}</td>
                ))}
                <td colSpan={2 + footerExtraCols} className="border border-gray-300 bg-gray-200" />
              </tr>
            </tfoot>
          </table>
        </div>

        <TeacherSignature name={teacherName} />
      </div>

      {activeCell && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={`${activeCell.question + 1}-savol natijasi`}
          style={{
            position: "fixed",
            top: popoverPosition?.top ?? 0,
            left: popoverPosition?.left ?? 0,
            visibility: popoverPosition ? "visible" : "hidden",
          }}
          className="z-50 flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg print:hidden"
        >
          <button
            type="button"
            onClick={() => answer(true)}
            aria-label={`To'g'ri, ${formatScore(report.questions[activeCell.question])} ball`}
            className="flex h-11 w-11 items-center justify-center rounded-lg bg-green-600 text-white hover:bg-green-700"
          >
            <CheckIcon />
          </button>
          <button
            type="button"
            onClick={() => answer(false)}
            aria-label="Noto'g'ri, 0 ball"
            className="flex h-11 w-11 items-center justify-center rounded-lg bg-red-600 text-white hover:bg-red-700"
          >
            <CrossIcon />
          </button>
          {activeMark !== null && activeMark !== undefined && (
            <button
              type="button"
              onClick={() => answer(null)}
              className="h-11 rounded-lg px-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-100"
            >
              Tozalash
            </button>
          )}
        </div>
      )}

      <SaveStatus saving={saving} saveError={saveError} onRetry={flushChanges} />
    </DashboardLayout>
  );
}
