import { NextResponse } from "next/server";
import { AuthError, ConfigError, requireAuth } from "@/lib/firebaseAdmin";
import { MAX_STUDENTS, normalizeStudentNames } from "@/lib/studentNames";

// This route is server-only. The OpenRouter key is read from process.env at
// request time and is never sent to the browser: no NEXT_PUBLIC_ prefix is
// used anywhere, and the client only ever talks to this endpoint.
//
// Every request must carry a Firebase ID token (`Authorization: Bearer <token>`)
// which is verified with the Firebase Admin SDK before anything else happens,
// so an anonymous caller cannot spend the OpenRouter quota.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
// dots-studio/dots-3-note-preview:free is a free OpenRouter model that supports
// image input (modality: text+image→text) — verified via /api/v1/models on
// 2026-10-06. 16B active / 280B total MoE, 512K context window.
// Chosen over google/gemma-4-31b-it:free because that model's shared Google AI
// Studio pool was returning provider-side 429s; Dots Studio uses a separate
// upstream backend.
const OPENROUTER_MODEL = "dots-studio/dots-3-note-preview:free";
const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // per image

// Best-effort in-process throttle. It protects a single server instance; a
// multi-instance/serverless deployment should back this with a shared store.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const RATE_LIMIT_MAX_TRACKED_USERS = 5_000;
const requestLog = new Map(); // uid -> number[] (timestamps)

/** @returns {boolean} true when the request is allowed */
function allowRequest(uid) {
  const now = Date.now();
  const recent = (requestLog.get(uid) || []).filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);

  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    requestLog.set(uid, recent);
    return false;
  }

  recent.push(now);
  requestLog.set(uid, recent);

  // Bound the map so a long-lived instance cannot grow it without limit.
  if (requestLog.size > RATE_LIMIT_MAX_TRACKED_USERS) {
    for (const [key, stamps] of requestLog) {
      if (stamps.every((ts) => now - ts >= RATE_LIMIT_WINDOW_MS)) requestLog.delete(key);
      if (requestLog.size <= RATE_LIMIT_MAX_TRACKED_USERS) break;
    }
  }

  return true;
}

const ACCEPTED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const PROMPT = [
  "You read photos of a class student roster (Kundalik-style school journal screenshots).",
  "Extract every student full name that is visible in the images.",
  "",
  "Hard rules:",
  "- Copy each name EXACTLY as it is written in the image: same letters, same spelling, same apostrophes, same diacritics, same word order, same capitalization.",
  "- Do NOT translate, transliterate, correct, normalize, shorten, expand or re-order any name.",
  "- Do NOT reorder names into a different sequence than the visual order of the list.",
  "- Keep the whole name as printed, including any patronymic or father's name (for example \"Umarjon o'g'li\" or \"Nurmuhamedovich\"): it is removed afterwards by the server.",
  `- Read every student on the list, up to ${MAX_STUDENTS} in total.`,
  "- Ignore anything that is not a student name (headers, dates, subjects, teachers, phone numbers, column labels, page numbers).",
  "- If the same name appears in more than one image, output it only once.",
  "- Include a name only if you can actually read it. Never invent, guess or complete names, and never pad the list with blanks.",
  "- If no student name can be read, return an empty list.",
  "",
  'Return ONLY valid JSON in this exact format, with no extra text, no markdown, no explanation:',
  '{ "students": ["Surname FirstName", "Surname FirstName2", ...] }',
].join("\n");

function errorResponse(message, status, code) {
  return NextResponse.json({ error: message, code }, { status });
}

/**
 * Parse the text returned by the model.
 * Handles raw JSON as well as ```json ... ``` fences the model may add.
 *
 * @param {string} text
 * @returns {{ students: string[] } | null}
 */
function parseModelText(text) {
  if (typeof text !== "string") return null;

  // Strip optional ```json ... ``` or ``` ... ``` fences.
  let cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  // Try the whole cleaned string first.
  try {
    return JSON.parse(cleaned);
  } catch {
    // Fall back: find the first {...} block in the response.
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Build an OpenAI-compatible multimodal user message:
 * system prompt text + one image_url content part per screenshot.
 *
 * @param {{ mimeType: string; base64: string }[]} images
 * @returns {object[]} messages array
 */
function buildMessages(images) {
  const content = [
    { type: "text", text: PROMPT },
    ...images.map(({ mimeType, base64 }) => ({
      type: "image_url",
      image_url: { url: `data:${mimeType};base64,${base64}` },
    })),
  ];

  return [{ role: "user", content }];
}

export async function POST(request) {
  // 1. Authentication first: an unauthenticated or invalid caller must never
  //    reach OpenRouter, and must not learn anything about the server config.
  let user;
  try {
    user = await requireAuth(request);
  } catch (error) {
    if (error instanceof ConfigError || error?.name === "ConfigError") {
      console.error("Firebase Admin configuration is missing:", error.message);
      return errorResponse(
        "Server konfiguratsiyasi yetarli emas. FIREBASE_PROJECT_ID yoki NEXT_PUBLIC_FIREBASE_PROJECT_ID sozlanmagan.",
        500,
        "firebase_config_missing"
      );
    }

    if (error instanceof AuthError || error?.name === "AuthError") {
      const missing = error.message === "missing_token";
      return errorResponse(
        missing
          ? "Avtorizatsiya talab qilinadi. Tizimga qayta kiring."
          : "Sessiya yaroqsiz yoki muddati tugagan. Tizimga qayta kiring.",
        401,
        missing ? "missing_token" : "invalid_token"
      );
    }

    console.error("Firebase Admin token verification failed:", error);
    return errorResponse("Avtorizatsiyani tekshirib bo'lmadi.", 500, "auth_unavailable");
  }

  // 2. Abuse protection: basic per-user rate limit.
  if (!allowRequest(user.uid)) {
    return errorResponse(
      "Juda ko'p so'rov yuborildi. Bir daqiqadan so'ng qayta urinib ko'ring.",
      429,
      "rate_limited"
    );
  }

  // 3. Validate the API key is present (server-side only, never logged).
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return errorResponse(
      "OpenRouter kaliti sozlanmagan. OPENROUTER_API_KEY environment o'zgaruvchisini to'ldiring.",
      500,
      "missing_api_key"
    );
  }

  // 4. Parse the multipart form.
  let formData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse("So'rovni tahlil qilib bo'lmadi.", 400, "bad_request");
  }

  const files = formData.getAll("images").filter((entry) => entry && typeof entry.arrayBuffer === "function");

  if (files.length === 0) {
    return errorResponse("Kamida bitta rasm tanlang.", 400, "no_images");
  }
  if (files.length > MAX_IMAGES) {
    return errorResponse(`Ko'pi bilan ${MAX_IMAGES} ta rasm yuklash mumkin.`, 400, "too_many_images");
  }

  for (const file of files) {
    if (!ACCEPTED_MIME_TYPES.has(file.type)) {
      return errorResponse(
        `Faqat rasm fayllari qabul qilinadi (JPG, PNG, WEBP). "${file.name || "fayl"}" qo'llab-quvvatlanmaydi.`,
        400,
        "invalid_image"
      );
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return errorResponse(
        `"${file.name || "fayl"}" hajmi 8 MB dan oshmasligi kerak.`,
        400,
        "image_too_large"
      );
    }
  }

  // 5. Convert images to base64 for the OpenAI multimodal format.
  let images;
  try {
    images = await Promise.all(
      files.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer());
        return { mimeType: file.type, base64: buffer.toString("base64") };
      })
    );
  } catch {
    return errorResponse("Rasmni o'qib bo'lmadi.", 400, "unreadable_image");
  }

  // 6. Call OpenRouter.
  const requestBody = {
    model: OPENROUTER_MODEL,
    temperature: 0,
    messages: buildMessages(images),
    // NOTE: response_format is intentionally omitted — the free Nemotron
    // endpoint does not support it. We parse the plain-text response instead.
  };

  let response;
  try {
    response = await fetch(OPENROUTER_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://ustozdaftar.uz",
        "X-Title": "UstozDaftar",
      },
      body: JSON.stringify(requestBody),
    });
  } catch (error) {
    console.error("[OpenRouter upstream] network error", { model: OPENROUTER_MODEL, error: error?.message || String(error) });
    return NextResponse.json(
      {
        error: "OpenRouter serveriga ulanib bo'lmadi.",
        code: "openrouter_error",
        upstreamStatus: 503,
        upstreamMessage: "OpenRouter serveriga ulanib bo'lmadi.",
        model: OPENROUTER_MODEL,
      },
      { status: 503 }
    );
  }

  // 7. Propagate real upstream HTTP errors (400, 401, 429, 502, 503, …).
  if (!response.ok) {
    const rawBody = await response.text().catch(() => "");

    let upstreamMessage = `OpenRouter so'rovi muvaffaqiyatsiz bo'ldi (${response.status}).`;
    try {
      const parsed = JSON.parse(rawBody || "{}");
      const msg = parsed?.error?.message || parsed?.message;
      if (typeof msg === "string" && msg.trim()) upstreamMessage = msg;
    } catch {
      // Non-JSON body — keep the generic message.
    }

    console.error("[OpenRouter upstream] request failed", {
      model: OPENROUTER_MODEL,
      upstreamStatus: response.status,
      upstreamBody: rawBody.slice(0, 1200),
    });

    return NextResponse.json(
      {
        error: upstreamMessage,
        code: "openrouter_error",
        upstreamStatus: response.status,
        upstreamMessage: rawBody.slice(0, 1200) || upstreamMessage,
        model: OPENROUTER_MODEL,
      },
      { status: response.status }
    );
  }

  // 8. Parse the response.
  const json = await response.json().catch(() => null);
  const rawText = json?.choices?.[0]?.message?.content ?? null;

  if (typeof rawText !== "string" || !rawText.trim()) {
    const detail = JSON.stringify(json || {}).slice(0, 500);
    console.error("[OpenRouter upstream] empty or missing content", { model: OPENROUTER_MODEL, upstreamBody: detail });
    return NextResponse.json(
      {
        error: "OpenRouter javobida matn yo'q.",
        code: "openrouter_error",
        upstreamStatus: 502,
        upstreamMessage: detail || "OpenRouter javobida matn yo'q.",
        model: OPENROUTER_MODEL,
      },
      { status: 502 }
    );
  }

  const parsed = parseModelText(rawText);

  if (!parsed || !Array.isArray(parsed.students)) {
    console.error("[OpenRouter upstream] invalid payload — could not parse JSON", {
      model: OPENROUTER_MODEL,
      rawText: rawText.slice(0, 500),
    });
    return NextResponse.json(
      {
        error: "OpenRouter javobini tushunib bo'lmadi.",
        code: "openrouter_error",
        upstreamStatus: 502,
        upstreamMessage: rawText.slice(0, 500) || "OpenRouter javobini tushunib bo'lmadi.",
        model: OPENROUTER_MODEL,
      },
      { status: 502 }
    );
  }

  // 9. Normalize (remove patronymics, deduplicate, cap at MAX_STUDENTS).
  //    The model now returns flat strings, not objects, so pass them directly.
  const fullNames = normalizeStudentNames(parsed.students);

  return NextResponse.json({ students: fullNames.map((fullName) => ({ fullName })) });
}