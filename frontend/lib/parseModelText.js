/**
 * Parse the student list returned by the vision model.
 *
 * Accepts the requested `{ "students": [{ "name", "uncertain" }] }` shape as
 * well as the older `{ "students": ["..."] }` one, ```json fences and text
 * around the JSON. When the JSON itself is broken (most often an answer cut
 * off by the token limit) the complete string values are salvaged, so a
 * truncated answer still yields every name that was fully written.
 *
 * @param {unknown} text raw model output
 * @returns {{ students: unknown[], salvaged: boolean } | null} null when nothing usable was found
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
      if (Array.isArray(parsed)) return { students: parsed, salvaged: false };
      if (parsed && Array.isArray(parsed.students)) return { students: parsed.students, salvaged: false };
    } catch {
      // try the next candidate
    }
  }

  // Salvage: only after a "students" key, pick every complete "name": "..."
  // pair, or every complete string in the array.
  const start = cleaned.search(/"students"\s*:\s*\[/);
  if (start === -1) return null;
  const tail = cleaned.slice(start).replace(/^"students"\s*:\s*\[/, "");

  const STRING = /"((?:[^"\\]|\\.)*)"/g;
  const students = [];
  if (/"name"\s*:/.test(tail)) {
    const pair = /"name"\s*:\s*"((?:[^"\\]|\\.)*)"(?:\s*,\s*"uncertain"\s*:\s*(true|false))?/g;
    for (const match of tail.matchAll(pair)) {
      students.push({ name: unescapeJson(match[1]), uncertain: match[2] === "true" });
    }
  } else {
    for (const match of tail.matchAll(STRING)) students.push(unescapeJson(match[1]));
  }

  return students.length > 0 ? { students, salvaged: true } : null;
}

function unescapeJson(value) {
  try {
    return JSON.parse(`"${value}"`);
  } catch {
    return value;
  }
}
