"use client";

/**
 * Shrink a roster photo before it is uploaded for AI recognition.
 *
 * Phone photos are often 4000px+ and several MB; the vision model downsamples
 * them anyway, so sending them whole only costs upload time and image tokens.
 * The long edge is capped at MAX_EDGE, which keeps small Cyrillic letters
 * (ў қ ғ ҳ) clearly legible. Files that are already small, or that the browser
 * cannot decode (HEIC outside Safari), are sent unchanged.
 */
const MAX_EDGE = 2400;
const SKIP_BELOW_BYTES = 600 * 1024;
const QUALITY = 0.9;

export async function shrinkImage(file) {
  if (file.size < SKIP_BELOW_BYTES || typeof createImageBitmap !== "function") return file;
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.type === "image/jpeg") return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff"; // transparent PNG areas would turn black in JPEG
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg", lastModified: file.lastModified });
  } finally {
    bitmap.close?.();
  }
}
