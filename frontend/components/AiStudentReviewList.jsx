"use client";

import { looseNameKey, nameKey } from "@/lib/studentNames";

// Uzbek explanations for every flag produced by analyzeStudentNames.
const WARNING_TEXT = {
  shortened: (entry) => `Otasining ismi olib tashlandi. Asl yozuv: "${entry.original}"`,
  uncertain: () => "AI bu ismni aniq o'qiy olmadi — tekshirib, kerak bo'lsa tuzating.",
  digits: () => "Ismda raqam bor — tekshiring.",
  mixed_script: () => "Kirill va lotin harflari aralash yozilgan — tekshiring.",
  single_word: () => "Faqat bitta so'z: familiya yoki ism yetishmayapti.",
  symbols: () => "Ismda noodatiy belgilar bor — tekshiring.",
  possible_duplicate: () => "Ro'yxatda boshqa alifboda yozilgan o'xshash ism bor.",
};

/**
 * Turn the API entries into editable review rows. Nothing is hidden: exact
 * duplicates and students already in the class are only unselected.
 */
export function buildReviewEntries(students, roster) {
  return students.map((entry, index) => {
    const fullName = (entry?.fullName || "").trim();
    const inClass = rosterMatch(fullName, roster);
    const duplicate = entry?.status === "duplicate";
    return {
      id: index,
      fullName,
      original: entry?.original || fullName,
      warnings: Array.isArray(entry?.warnings) ? entry.warnings : [],
      duplicate,
      inClass,
      selected: !duplicate && inClass !== "exact",
    };
  });
}

/** "exact" (same spelling), "similar" (same name, other alphabet) or null. */
export function rosterMatch(fullName, roster) {
  const key = nameKey(fullName);
  if (!key) return null;
  if (roster.some((student) => nameKey(student.name) === key)) return "exact";
  const loose = looseNameKey(fullName);
  if (loose && roster.some((student) => looseNameKey(student.name) === loose)) return "similar";
  return null;
}

function Tag({ tone, children }) {
  const tones = {
    amber: "text-amber-800 bg-amber-50 border-amber-200",
    gray: "text-gray-700 bg-gray-100 border-gray-200",
    red: "text-red-700 bg-red-50 border-red-200",
  };
  return (
    <span className={`text-xs font-medium border rounded px-1.5 py-0.5 whitespace-nowrap ${tones[tone]}`}>
      {children}
    </span>
  );
}

export default function AiStudentReviewList({ entries, busy, onToggle, onRename }) {
  return (
    <ul className="border border-gray-200 rounded-lg divide-y divide-gray-200 max-h-[22rem] overflow-y-auto">
      {entries.map((entry) => {
        const empty = entry.fullName.trim() === "";
        const notes = entry.warnings.filter((w) => WARNING_TEXT[w]);
        return (
          <li key={entry.id} className="px-3 py-2.5 flex items-start gap-3">
            <input
              id={`ai-student-${entry.id}`}
              type="checkbox"
              checked={entry.selected}
              disabled={busy}
              onChange={() => onToggle(entry.id)}
              aria-label={`${entry.fullName || "Ism"} ni tanlash`}
              className="mt-2 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0"
            />
            <div className="flex-1 min-w-0 space-y-1.5">
              <input
                type="text"
                value={entry.fullName}
                onChange={(event) => onRename(entry.id, event.target.value)}
                disabled={busy}
                lang="uz"
                spellCheck={false}
                aria-label="O'quvchi ismi"
                aria-invalid={entry.selected && empty}
                className={`w-full rounded-md border px-2.5 py-1.5 text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 ${
                  entry.selected && empty ? "border-red-400" : "border-gray-300"
                } ${entry.selected ? "text-gray-900" : "text-gray-500"}`}
              />
              {(entry.inClass || entry.duplicate || notes.length > 0 || (entry.selected && empty)) && (
                <div className="flex flex-wrap gap-1.5">
                  {entry.inClass === "exact" && <Tag tone="gray">sinfda bor</Tag>}
                  {entry.inClass === "similar" && <Tag tone="amber">sinfda boshqa alifboda bor bo&apos;lishi mumkin</Tag>}
                  {entry.duplicate && <Tag tone="amber">takroriy — ikki xil o&apos;quvchi bo&apos;lsa belgilang</Tag>}
                  {entry.selected && empty && <Tag tone="red">ism bo&apos;sh</Tag>}
                </div>
              )}
              {notes.length > 0 && (
                <ul className="space-y-0.5">
                  {notes.map((warning) => (
                    <li key={warning} className="text-xs text-amber-800 break-words">
                      {WARNING_TEXT[warning](entry)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
