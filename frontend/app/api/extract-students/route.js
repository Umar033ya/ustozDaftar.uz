import { NextResponse } from "next/server";
import { AuthError, requireAuth } from "@/lib/firebaseAdmin";
import { MAX_STUDENTS, normalizeStudentNames } from "@/lib/studentNames";

// This route is server-only. The Gemini key is read from process.env at
// request time and is never sent to the browser: no NEXT_PUBLIC_ prefix is
// used anywhere, and the client only ever talks to this endpoint.
//
// Every request must carry a Firebase ID token (`Authorization: Bearer <token>`)
// which is verified with the Firebase Admin SDK before anything else happens,
// so an anonymous caller cannot spend the Gemini quota.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
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

// The configured model is tried first; the rest are tried in order when the
// model is retired or temporarily saturated (Gemini answers 404/503 for both).
const FALLBACK_MODELS = ["gemini-3-flash-preview", "gemini-3.5-flash", "gemini-3.8-flash"];

const ACCEPTED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    students: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { fullName: { type: "STRING" } },
        required: ["fullName"],
      },
    },
  },
  required: ["students"],
};

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
].join("\n");

function errorResponse(message, status, code) {
  return NextResponse.json({ error: message, code }, { status });
}

function parseGeminiPayload(json) {
  const parts = json?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return null;
  const text = parts.map((part) => part?.text || "").join("");
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function fileToInlinePart(file) {
  const buffer = Buffer.from(await file.arrayBuffer());
  return {
    inlineData: { mimeType: file.type, data: buffer.toString("base64") },
  };
}

export async function POST(request) {
  // 1. Authentication first: an unauthenticated or invalid caller must never
  //    reach Gemini, and must not learn anything about the server config.
  let user;
  try {
    user = await requireAuth(request);
  } catch (error) {
    if (error instanceof AuthError) {
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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return errorResponse(
      "Gemini kaliti sozlanmagan. GEMINI_API_KEY environment o'zgaruvchisini to'ldiring.",
      500,
      "missing_api_key"
    );
  }

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

  let imageParts;
  try {
    imageParts = await Promise.all(files.map(fileToInlinePart));
  } catch {
    return errorResponse("Rasmni o'qib bo'lmadi.", 400, "unreadable_image");
  }

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: PROMPT }, ...imageParts],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  };

  const models = [process.env.GEMINI_MODEL, ...FALLBACK_MODELS].filter(
    (model, index, all) => model && all.indexOf(model) === index
  );

  let lastError = null;

  for (const model of models) {
    let response;
    try {
      response = await fetch(`${GEMINI_ENDPOINT}/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(body),
      });
    } catch {
      lastError = { status: 503, message: "Gemini serveriga ulanib bo'lmadi." };
      continue;
    }

    if (!response.ok) {
      // 404 = model retired for this key, 429 = rate limited, 503 = saturated.
      // All are worth retrying on the next candidate model.
      const detail = await response.text().catch(() => "");
      lastError = {
        status: response.status,
        message: `Gemini so'rovi muvaffaqiyatsiz bo'ldi (${response.status}).`,
        detail,
      };
      continue;
    }

    const json = await response.json().catch(() => null);
    const parsed = parseGeminiPayload(json);

    if (!parsed || !Array.isArray(parsed.students)) {
      lastError = {
        status: 502,
        message: "Gemini javobini tushunib bo'lmadi.",
        detail: JSON.stringify(json).slice(0, 500),
      };
      continue;
    }

    const fullNames = normalizeStudentNames(parsed.students.map((student) => student?.fullName));

    return NextResponse.json({ students: fullNames.map((fullName) => ({ fullName })) });
  }

  // Never leak the key or upstream body to the client.
  const status = lastError && [401, 403].includes(lastError.status) ? 502 : 500;
  return errorResponse(
    lastError?.message || "Gemini xatosi yuz berdi. Qayta urinib ko'ring.",
    status,
    "gemini_error"
  );
}