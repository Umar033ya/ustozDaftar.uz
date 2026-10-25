import { NextResponse } from "next/server";
import { AuthError, ConfigError, requireAuth } from "@/lib/firebaseAdmin";
import { MAX_STUDENTS, analyzeStudentNames } from "@/lib/studentNames";
import { parseModelText } from "@/lib/parseModelText";

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
  "- Copy each name EXACTLY as it is written in the image: same alphabet, same letters, same spelling, same apostrophes, same diacritics, same word order, same capitalization.",
  "- Names written in Cyrillic (for example \"Ўткир\", \"Ғайрат\", \"Шаҳзода\") MUST stay in Cyrillic, including the Uzbek letters Ў Қ Ғ Ҳ. Names written in Latin (for example \"O‘tkir\", \"G‘ayrat\", \"Shaxzoda\") MUST stay in Latin.",
  "- Do NOT translate, transliterate, correct, normalize, shorten, expand or re-order any name.",
  "- Keep the visual order of the list.",
  "- Keep the whole name as printed, including any patronymic or father's name (for example \"Umarjon o'g'li\", \"Умаржон ўғли\" or \"Nurmuhamedovich\"): it is removed afterwards by the server.",
  `- Read every student on the list, up to ${MAX_STUDENTS} in total. Output one entry per student row, even when two students have the same name.`,
  "- If the same row appears in two overlapping screenshots, output it once.",
  "- Ignore anything that is not a student name (headers, dates, subjects, teachers, phone numbers, column labels, page numbers).",
  "- Never invent or complete names. If a name is only partly readable, output what you can read and set \"uncertain\": true instead of skipping it.",
  "- If no student name can be read, return an empty list.",
  "",
  "Return ONLY valid JSON in this exact format, with no extra text, no markdown, no explanation:",
  '{ "students": [ { "name": "Surname FirstName", "uncertain": false } ] }',
].join("\n");

// One extra call is allowed when the model answers with something that is not
// parseable at all. Rate limits and HTTP errors are never retried here.
const MAX_MODEL_ATTEMPTS = 2;

function errorResponse(message, status, code) {
  return NextResponse.json({ error: message, code }, { status });
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

  // 6. Call OpenRouter. Student names are personal data: nothing the model
  //    returns is ever logged, only sizes and status codes.
  const requestBody = {
    model: OPENROUTER_MODEL,
    temperature: 0,
    messages: buildMessages(images),
    // NOTE: response_format is intentionally omitted — the free vision
    // endpoint does not support it. The plain-text answer is parsed and
    // validated by parseModelText / analyzeStudentNames instead.
  };

  let parsed = null;
  for (let attempt = 1; attempt <= MAX_MODEL_ATTEMPTS && !parsed; attempt++) {
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
        { error: "AI serveriga ulanib bo'lmadi. Birozdan so'ng qayta urinib ko'ring.", code: "openrouter_error", upstreamStatus: 503 },
        { status: 503 }
      );
    }

    // 7. Real upstream HTTP errors (400, 401, 429, 502, 503, …) are returned as is, never retried.
    if (!response.ok) {
      const rawBody = await response.text().catch(() => "");
      let upstreamMessage = `AI so'rovi muvaffaqiyatsiz bo'ldi (${response.status}).`;
      try {
        const body = JSON.parse(rawBody || "{}");
        const msg = body?.error?.message || body?.message;
        if (typeof msg === "string" && msg.trim()) upstreamMessage = msg.slice(0, 300);
      } catch {
        // Non-JSON body — keep the generic message.
      }

      console.error("[OpenRouter upstream] request failed", {
        model: OPENROUTER_MODEL,
        upstreamStatus: response.status,
        bodyLength: rawBody.length,
      });

      const userMessage =
        response.status === 429
          ? "AI xizmati hozir band. Bir daqiqadan so'ng qayta urinib ko'ring."
          : upstreamMessage;
      return NextResponse.json(
        { error: userMessage, code: "openrouter_error", upstreamStatus: response.status },
        { status: response.status }
      );
    }

    // 8. Parse the answer; an unusable answer gets one more attempt.
    const json = await response.json().catch(() => null);
    const rawText = json?.choices?.[0]?.message?.content ?? null;
    parsed = parseModelText(rawText);

    if (!parsed) {
      console.warn("[OpenRouter upstream] unusable answer", {
        model: OPENROUTER_MODEL,
        attempt,
        finishReason: json?.choices?.[0]?.finish_reason ?? null,
        contentLength: typeof rawText === "string" ? rawText.length : 0,
      });
    }
  }

  if (!parsed) {
    return NextResponse.json(
      {
        error: "AI javobini tushunib bo'lmadi. Aniqroq surat bilan qayta urinib ko'ring.",
        code: "openrouter_error",
        upstreamStatus: 502,
      },
      { status: 502 }
    );
  }

  // 9. Normalize without changing the script. Every returned line becomes a
  //    review entry (duplicates and doubtful names are flagged, not removed).
  const { entries, truncated } = analyzeStudentNames(parsed.students);

  return NextResponse.json({
    students: entries.filter((entry) => entry.status !== "empty"),
    skippedEmpty: entries.filter((entry) => entry.status === "empty").length,
    truncated,
    salvaged: parsed.salvaged,
  });
}
