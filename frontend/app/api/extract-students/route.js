import { NextResponse } from "next/server";
import { AuthError, ConfigError, requireAuth } from "@/lib/firebaseAdmin";
import { analyzeStudentNames, missingRowNumbers } from "@/lib/studentNames";
import { DEFAULT_MODEL, ExtractionError, extractStudents } from "@/lib/server/studentExtraction";

// This route is server-only. The OpenRouter key is read from process.env at
// request time and is never sent to the browser: no NEXT_PUBLIC_ prefix is
// used anywhere, and the client only ever talks to this endpoint.
//
// Every request must carry a Firebase ID token (`Authorization: Bearer <token>`)
// which is verified with the Firebase Admin SDK before anything else happens,
// so an anonymous caller cannot spend the OpenRouter quota.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function errorResponse(message, status, code) {
  return NextResponse.json({ error: message, code }, { status });
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

  // 6. One model call carrying every image once (bounded retries inside).
  //    Student names are personal data: nothing the model returns is logged.
  let parsed;
  try {
    parsed = await extractStudents({ apiKey, images, model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL });
  } catch (error) {
    if (error instanceof ExtractionError) {
      return NextResponse.json(
        { error: error.message, code: error.code, upstreamStatus: error.upstreamStatus },
        { status: error.status }
      );
    }
    console.error("[ai] extraction failed", error?.message);
    return errorResponse("AI bilan ishlashda xatolik yuz berdi. Qayta urinib ko'ring.", 500, "server_error");
  }

  // 7. Normalize without changing the script. Every row becomes a review
  //    entry; only the same printed row seen twice (overlapping screenshots)
  //    is merged, and that is counted.
  const { entries, truncated, merged } = analyzeStudentNames(parsed.students);
  const students = entries.filter((entry) => entry.status !== "empty");

  return NextResponse.json({
    students,
    skippedEmpty: entries.length - students.length,
    truncated,
    merged,
    // completeness signals for the review screen
    visibleRows: parsed.visibleRows,
    missingRows: missingRowNumbers(entries),
    incomplete: parsed.salvaged || parsed.truncatedOutput,
  });
}
