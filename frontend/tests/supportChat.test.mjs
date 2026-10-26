import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanMessageText, MAX_MESSAGE_LENGTH } from "../lib/server/supportChat.js";

test("support chat: message text is trimmed and keeps line breaks", () => {
  assert.deepEqual(cleanMessageText("  Salom\r\nYordam kerak  "), { text: "Salom\nYordam kerak" });
});

test("support chat: empty, whitespace-only and non-string messages are rejected", () => {
  assert.deepEqual(cleanMessageText(""), { error: "empty" });
  assert.deepEqual(cleanMessageText("   \n\t "), { error: "empty" });
  assert.deepEqual(cleanMessageText(undefined), { error: "empty" });
  assert.deepEqual(cleanMessageText({ text: "x" }), { error: "empty" });
});

test("support chat: control characters are stripped", () => {
  assert.deepEqual(cleanMessageText("a\u0000b\u0007c\u007F"), { text: "abc" });
});

test("support chat: the length limit is enforced", () => {
  assert.deepEqual(cleanMessageText("x".repeat(MAX_MESSAGE_LENGTH)), { text: "x".repeat(MAX_MESSAGE_LENGTH) });
  assert.deepEqual(cleanMessageText("x".repeat(MAX_MESSAGE_LENGTH + 1)), { error: "too_long" });
});
