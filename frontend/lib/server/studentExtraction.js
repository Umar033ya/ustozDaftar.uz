import { MAX_STUDENTS } from "../studentNames.js";
import { parseModelText } from "../parseModelText.js";

/**
 * Vision-model call for the AI student import — SERVER SIDE ONLY.
 * Kept free of Next.js imports so the retry/parse policy is unit-testable.
 *
 * One request carries every image once. Retries are bounded (MAX_ATTEMPTS
 * calls in total) and only happen for failures that can succeed on a second
 * try: network errors, 429/502/503/504, and an answer that cannot be parsed
 * at all. A truncated answer (finish_reason "length") is NOT retried — the
 * same request would be cut at the same place — it is returned as partial so
 * the teacher is warned.
 */

export const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
// Free vision model with structured outputs (response_format json_schema),
// checked against https://openrouter.ai/api/v1/models on 2026-10-25.
export const DEFAULT_MODEL = "dots-studio/dots-3-note-preview:free";
// Free models are often rate limited or briefly offline. OpenRouter tries the
// `models` list in order, so a second free vision model with structured
// outputs (checked 2026-10-26) keeps the import working when the first is down.
export const FALLBACK_MODELS = ["nvidia/nemotron-3.5-super-vl:free"];

/**
 * OPENROUTER_MODEL may name one model or a comma-separated chain
 * ("primary,fallback1,..."); unset means DEFAULT_MODEL + FALLBACK_MODELS.
 * @returns {string[]}
 */
export function resolveModels(setting) {
  const models = String(setting || "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  return models.length > 0 ? [...new Set(models)] : [DEFAULT_MODEL, ...FALLBACK_MODELS];
}
export const MAX_ATTEMPTS = 2;
const MAX_OUTPUT_TOKENS = 16_000; // reasoning models count their thinking here too
const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);
const MAX_RETRY_WAIT_MS = 8_000;

export const PROMPT = [
  "You transcribe photos/screenshots of ONE school class roster (Kundalik-style journal).",
  "Read every student row in every image, top to bottom.",
  "",
  "Copy rules (most important):",
  "- Copy each name character by character exactly as printed: same alphabet, letters, apostrophes, capitalization and word order.",
  "- Uzbek Cyrillic letters are DIFFERENT letters, never replace them: Ў ў (not У), Қ қ (not К), Ғ ғ (not Г or Ф), Ҳ ҳ (not Х). Also keep Ё ё, Ш, Ч, Ж, Э, Ю, Я.",
  "- Uzbek Latin: keep oʻ/gʻ and their apostrophe character exactly as printed (‘ ʻ ’ or '), keep sh, ch, ng, x and h as printed.",
  "- Cyrillic stays Cyrillic, Latin stays Latin. Never translate, transliterate, correct, shorten or reorder.",
  "- Keep patronymics such as \"o‘g‘li\", \"qizi\", \"ўғли\", \"қизи\" — the server removes them.",
  "",
  "Row rules:",
  "- One entry per printed row. Two different rows with the same name are two students: output both.",
  "- `row` is the number printed in the row's № column; use 0 when the row has no number.",
  "- When screenshots overlap, the same printed row may appear twice: output it once.",
  "- Skip headers, dates, subjects, teacher names, phone numbers and page numbers.",
  "- Never invent names. If a name is partly unreadable, write what you can read and set uncertain=true instead of skipping the row.",
  "- `visible_rows` is how many distinct student rows you can see in total, including ones you could not read.",
  `- At most ${MAX_STUDENTS} entries.`,
].join("\n");

export const RESPONSE_SCHEMA = {
  type: "json_schema",
  json_schema: {
    name: "class_roster",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["visible_rows", "students"],
      properties: {
        visible_rows: { type: "integer" },
        students: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["row", "name", "uncertain"],
            properties: {
              row: { type: "integer" },
              name: { type: "string" },
              uncertain: { type: "boolean" },
            },
          },
        },
      },
    },
  },
};

export class ExtractionError extends Error {
  /** @param {{ status: number, code: string, upstreamStatus?: number }} details */
  constructor(message, { status, code, upstreamStatus = status }) {
    super(message);
    this.name = "ExtractionError";
    this.status = status;
    this.code = code;
    this.upstreamStatus = upstreamStatus;
  }
}

/**
 * @param {{ mimeType: string, base64: string }[]} images
 * @param {string | string[]} model one model id, or a fallback chain
 */
export function buildRequestBody(images, model = DEFAULT_MODEL) {
  const content = [{ type: "text", text: PROMPT }];
  images.forEach(({ mimeType, base64 }, index) => {
    if (images.length > 1) content.push({ type: "text", text: `Image ${index + 1} of ${images.length}:` });
    content.push({ type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } });
  });
  const chain = Array.isArray(model) ? model : [model];
  return {
    ...(chain.length > 1 ? { models: chain } : { model: chain[0] }),
    temperature: 0,
    max_tokens: MAX_OUTPUT_TOKENS,
    response_format: RESPONSE_SCHEMA,
    // Fail instead of silently routing to a provider that ignores the schema.
    provider: { require_parameters: true },
    messages: [{ role: "user", content }],
  };
}

function retryDelay(response, attempt) {
  const header = Number(response?.headers?.get?.("retry-after"));
  const ms = Number.isFinite(header) && header > 0 ? header * 1000 : 1500 * attempt;
  return Math.min(ms, MAX_RETRY_WAIT_MS);
}

/**
 * @param {{ apiKey: string, images: { mimeType: string, base64: string }[], model?: string,
 *           fetchImpl?: typeof fetch, sleep?: (ms: number) => Promise<void>,
 *           log?: Pick<Console, "warn" | "info"> }} options
 * @returns {Promise<{ students: unknown[], salvaged: boolean, visibleRows: number | null,
 *                     truncatedOutput: boolean, attempts: number, usage: object | null }>}
 * @throws {ExtractionError}
 */
export async function extractStudents({
  apiKey,
  images,
  model = DEFAULT_MODEL,
  fetchImpl = fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  log = console,
}) {
  const body = JSON.stringify(buildRequestBody(images, model));
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let response;
    try {
      response = await fetchImpl(OPENROUTER_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://ustozdaftar.uz",
          "X-Title": "UstozDaftar",
        },
        body,
        signal: AbortSignal.timeout(150_000),
      });
    } catch (error) {
      log.warn("[ai] network error", { model, attempt, error: error?.name || "error" });
      lastError = new ExtractionError("AI serveriga ulanib bo'lmadi. Birozdan so'ng qayta urinib ko'ring.", {
        status: 503,
        code: "openrouter_unreachable",
      });
      if (attempt < MAX_ATTEMPTS) await sleep(1500);
      continue;
    }

    if (!response.ok) {
      const raw = await response.text().catch(() => "");
      // Only sizes and status codes are logged: the body can echo student data.
      log.warn("[ai] upstream error", { model, attempt, status: response.status, bodyLength: raw.length });
      const busy = response.status === 429;
      lastError = new ExtractionError(
        busy
          ? "AI xizmati hozir band. Bir daqiqadan so'ng qayta urinib ko'ring."
          : `AI so'rovi muvaffaqiyatsiz bo'ldi (${response.status}). Birozdan so'ng qayta urinib ko'ring.`,
        { status: busy ? 429 : 502, code: "openrouter_error", upstreamStatus: response.status }
      );
      if (!RETRYABLE_STATUS.has(response.status)) throw lastError;
      if (attempt < MAX_ATTEMPTS) await sleep(retryDelay(response, attempt));
      continue;
    }

    const json = await response.json().catch(() => null);
    const choice = json?.choices?.[0];
    const text = choice?.message?.content ?? null;
    const truncatedOutput = choice?.finish_reason === "length";
    const parsed = parseModelText(text);
    log.info("[ai] answer", {
      model: json?.model ?? model,
      attempt,
      finishReason: choice?.finish_reason ?? null,
      promptTokens: json?.usage?.prompt_tokens ?? null,
      completionTokens: json?.usage?.completion_tokens ?? null,
      parsed: Boolean(parsed),
    });

    if (parsed) {
      return { ...parsed, truncatedOutput, attempts: attempt, usage: json?.usage ?? null };
    }
    lastError = new ExtractionError("AI javobini tushunib bo'lmadi. Aniqroq surat bilan qayta urinib ko'ring.", {
      status: 502,
      code: "unreadable_answer",
    });
    // An unusable answer cut by the token limit would be cut again.
    if (truncatedOutput) break;
  }

  throw lastError;
}
