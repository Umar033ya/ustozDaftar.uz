// Route-level test of the support chat: the real frontend route handler
// (app/api/support/messages) and the real admin chat service
// (admin/lib/chat.ts) share one in-memory Firestore, as they share the real one.
import "./helpers/routeHooks.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { pathDb } from "./helpers/pathFirestore.mjs";

const db = pathDb();
globalThis.__routeHarness = {
  db,
  tokens: new Map([
    ["tok-a", { uid: "teacherA", email: "a@test.uz" }],
    ["tok-b", { uid: "teacherB", email: "b@test.uz" }],
  ]),
};
db.store.set("users/teacherA", { firstName: "Ali", lastName: "Valiyev", email: "a@test.uz", plan: "pro", planExpiry: Date.now() + 1e9 });
db.store.set("users/teacherB", { firstName: "Bobur", lastName: "Karimov", email: "b@test.uz", plan: "max", planExpiry: Date.now() + 1e9 });

const route = await import("../app/api/support/messages/route.js");
const adminChat = await import("../../admin/lib/chat.ts");

function call(method, token, { query = "", body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const request = new Request(`http://localhost/api/support/messages${query}`, {
    method,
    headers,
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  return method === "GET" ? route.GET(request) : route.POST(request);
}

const messagesOf = (uid) =>
  [...db.store.keys()].filter((k) => k.startsWith(`supportChats/${uid}/messages/`)).map((k) => db.raw(k));

test("chat: requests without a valid ID token are rejected", async () => {
  assert.equal((await call("GET", null)).status, 401);
  assert.equal((await call("GET", "forged")).status, 401);
  assert.equal((await call("POST", "forged", { body: { text: "x" } })).status, 401);
  assert.equal(db.store.size, 2, "nothing was written");
});

test("chat: a user message lands in the caller's own thread; spoofed fields are ignored", async () => {
  const res = await call("POST", "tok-a", {
    body: { text: "  Salom, yordam kerak  ", sender: "admin", uid: "teacherB", userName: "Hacker" },
  });
  assert.equal(res.status, 200);
  const { message } = await res.json();
  assert.equal(message.sender, "user");
  assert.equal(message.text, "Salom, yordam kerak");

  assert.deepEqual(messagesOf("teacherA").map((m) => [m.sender, m.text]), [["user", "Salom, yordam kerak"]]);
  assert.equal(messagesOf("teacherB").length, 0);
  assert.equal(db.raw("supportChats/teacherB"), undefined);

  const thread = db.raw("supportChats/teacherA");
  assert.equal(thread.userName, "Ali Valiyev", "name comes from the server-side profile");
  assert.equal(thread.userEmail, "a@test.uz");
  assert.equal(thread.unreadByAdmin, 1);
  assert.equal(thread.lastSender, "user");
});

test("chat: another user sees none of it", async () => {
  const res = await call("GET", "tok-b");
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).messages, []);
  assert.equal((await (await call("GET", "tok-b", { query: "?peek=1" })).json()).unread, 0);
});

test("chat: admin inbox shows who wrote, their current plan and the unread count", async () => {
  const threads = await adminChat.listThreads();
  assert.equal(threads.length, 1);
  assert.equal(threads[0].uid, "teacherA");
  assert.equal(threads[0].userName, "Ali Valiyev");
  assert.equal(threads[0].plan, "pro");
  assert.equal(threads[0].unreadByAdmin, 1);
  assert.equal(await adminChat.unreadThreadCount(), 1);

  const messages = await adminChat.listThreadMessages("teacherA");
  assert.deepEqual(messages.map((m) => m.sender), ["user"]);
  await adminChat.markReadByAdmin("teacherA");
  assert.equal(await adminChat.unreadThreadCount(), 0);
});

test("chat: an admin reply reaches only that user and is marked read when opened", async () => {
  const reply = await adminChat.sendAdminMessage("teacherA", "Assalomu alaykum, qanday yordam kerak?", { uid: "adm1" });
  assert.equal(reply.sender, "admin");

  assert.equal((await (await call("GET", "tok-a", { query: "?peek=1" })).json()).unread, 1);
  const { messages } = await (await call("GET", "tok-a")).json();
  assert.deepEqual(messages.map((m) => m.sender), ["user", "admin"]);
  assert.equal((await (await call("GET", "tok-a", { query: "?peek=1" })).json()).unread, 0);

  const since = await (await call("GET", "tok-a", { query: `?since=${reply.createdAt}` })).json();
  assert.ok(since.messages.every((m) => m.createdAt >= reply.createdAt));
  assert.ok(since.messages.some((m) => m.id === reply.id));

  assert.deepEqual((await (await call("GET", "tok-b")).json()).messages, []);
});

test("chat: admin cannot write to a non-existent user or send an empty message", async () => {
  await assert.rejects(adminChat.sendAdminMessage("ghost", "salom", { uid: "adm1" }), (e) => e.status === 404);
  await assert.rejects(adminChat.sendAdminMessage("teacherA", "   ", { uid: "adm1" }), (e) => e.status === 400);
  assert.equal(db.raw("supportChats/ghost"), undefined);
});

test("chat: invalid bodies are rejected without writing", async () => {
  const before = messagesOf("teacherA").length;
  assert.equal((await call("POST", "tok-a", { body: { text: "   " } })).status, 400);
  assert.equal((await call("POST", "tok-a", { body: { text: "x".repeat(2001) } })).status, 400);
  assert.equal((await call("POST", "tok-a", { body: "{not json" })).status, 400);
  assert.equal(messagesOf("teacherA").length, before);
});

test("chat: a user is rate limited to 10 messages a minute", async () => {
  for (let i = 0; i < 10; i += 1) {
    assert.equal((await call("POST", "tok-b", { body: { text: `xabar ${i}` } })).status, 200);
  }
  assert.equal((await call("POST", "tok-b", { body: { text: "ortiqcha" } })).status, 429);
  assert.equal(messagesOf("teacherB").length, 10);
});
