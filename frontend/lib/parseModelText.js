/**
 * Parse the student list returned by the vision model.
 *
 * Accepts the structured `{ "students": [{ "row", "name", "uncertain" }], "visible_rows" }`
 * shape, the older `{ "students": ["..."] }` one, ```json fences and text
 * around the JSON. When the JSON itself is broken (most often an answer cut
 * off by the token limit) the complete entries are salvaged, so a truncated
 * answer still yields every name that was fully written — and is reported as
 * salvaged so the teacher is warned.
 *
 * @param {unknown} text raw model output
 * @returns {{ students: unknown[], salvaged: boolean, visibleRows: number | null } | null}
 *   null when nothing usable was found
 */
export function parseModelText(text) {
  if (typeof text !== "string" || !text.trim()) return null;

  const cleaned = text
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  const candidates = [cleaned];
  const block = cleaned.match(/\{[\s\S]*\}/);
  if (block) candidates.push(block[0]);
  const array = cleaned.match(/\[[\s\S]*\]/);
  if (array) candidates.push(array[0]);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed)) return { students: parsed, salvaged: false, visibleRows: null };
      if (parsed && Array.isArray(parsed.students)) {
        return { students: parsed.students, salvaged: false, visibleRows: readCount(parsed.visible_rows) };
      }
    } catch {
      // try the next candidate
    }
  }

  // Salvage: only after a "students" key, pick every complete entry.
  const start = cleaned.search(/"students"\s*:\s*\[/);
  if (start === -1) return null;
  const tail = cleaned.slice(start).replace(/^"students"\s*:\s*\[/, "");
  const visible = cleaned.match(/"visible_rows"\s*:\s*(\d+)/);

  const students = [];
  if (/"name"\s*:/.test(tail)) {
    // one complete {...} object at a time; fields may come in any order
    for (const match of tail.matchAll(/\{[^{}]*\}/g)) {
      const obj = match[0];
      const name = obj.match(/"name"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (!name) continue;
      const row = obj.match(/"row"\s*:\s*(\d+)/);
      const uncertain = obj.match(/"uncertain"\s*:\s*(true|false)/);
      const entry = { name: unescapeJson(name[1]), uncertain: uncertain?.[1] === "true" };
      if (row) entry.row = Number(row[1]);
      students.push(entry);
    }
  } else {
    for (const match of tail.matchAll(/"((?:[^"\\]|\\.)*)"/g)) students.push(unescapeJson(match[1]));
  }

  return students.length > 0 ? { students, salvaged: true, visibleRows: visible ? readCount(visible[1]) : null } : null;
}

function readCount(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n < 10_000 ? n : null;
}

function unescapeJson(value) {
  try {
    return JSON.parse(`"${value}"`);
  } catch {
    return value;
  }
}
