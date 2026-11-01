"use client";

const normalize = (value) => String(value ?? "").toLowerCase().trim();

/** Filters an assessment list by free-text search and by selected class id. */
export function filterAssessments(assessments, { search, classId, className }) {
  const query = normalize(search);
  return assessments.filter((a) => {
    if (classId) {
      // older assessments may lack classId; fall back to the class name
      const sameClass = a.classId ? a.classId === classId : normalize(a.className) === normalize(className);
      if (!sameClass) return false;
    }
    if (!query) return true;
    return [a.className, a.subject, a.number, a.date].some((field) => normalize(field).includes(query));
  });
}

export default function AssessmentFilters({ search, onSearchChange, classId, onClassChange, classes }) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-4">
      <div className="relative flex-1">
        <svg
          className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
        </svg>
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Sinf, fan yoki raqam bo'yicha qidirish..."
          aria-label="Qidirish"
          className="w-full h-11 sm:h-10 pl-10 pr-3 text-base sm:text-sm border border-gray-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <select
        value={classId}
        onChange={(e) => onClassChange(e.target.value)}
        aria-label="Sinf tanlash"
        className="h-11 sm:h-10 px-3 text-base sm:text-sm border border-gray-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 sm:w-56"
      >
        <option value="">Barcha sinflar</option>
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {c.academicYear ? ` (${c.academicYear})` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
