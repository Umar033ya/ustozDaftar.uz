/**
 * Firestore security rules, checked against the real rules engine of the
 * Firestore emulator (which loads frontend/firestore.rules).
 *
 *   firebase emulators:start --only firestore
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npm test
 *
 * Skipped when no emulator is configured. Each run uses its own ids, so it
 * never touches other data in the emulator.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const HOST = process.env.FIRESTORE_EMULATOR_HOST;
const PROJECT = process.env.FIREBASE_PROJECT_ID || "ustozdaftar-uz";
const BASE = `http://${HOST}/v1/projects/${PROJECT}/databases/(default)/documents`;
const cases = JSON.parse(readFileSync(new URL("./rules/firestore-cases.json", import.meta.url), "utf8"));

const run = `rt${Date.now().toString(36)}`;
const ID = (value) => (["u1", "u2", "adm", "r1", "p1", "x"].includes(value) ? `${run}_${value}` : value);
const mapPath = (path) => path.split("/").map((part, i) => (i % 2 ? ID(part) : part)).join("/");
const mapData = (data) => JSON.parse(JSON.stringify(data), (key, value) => (key === "uid" || key === "processedBy" ? ID(value) : value));

function toValue(v) {
  if (v === null) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  return { mapValue: { fields: toFields(v) } };
}
const toFields = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, toValue(v)]));

/** Unsigned JWT: the emulator accepts it and exposes its claims as request.auth.token. */
function token(auth) {
  if (!auth) return null;
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const uid = ID(auth.uid);
  const now = Math.floor(Date.now() / 1000);
  const claims = { sub: uid, user_id: uid, aud: PROJECT, iss: `https://securetoken.google.com/${PROJECT}`, iat: now, exp: now + 3600, auth_time: now, firebase: { sign_in_provider: "password" } };
  if (auth.admin) claims.admin = true;
  return `${b64({ alg: "none", typ: "JWT" })}.${b64(claims)}.`;
}

async function call(method, url, auth, body) {
  const headers = { "Content-Type": "application/json" };
  if (auth === "owner") headers.Authorization = "Bearer owner"; // emulator: bypass rules (seeding)
  else if (auth) headers.Authorization = `Bearer ${auth}`;
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  await res.text();
  return res.status;
}

const docName = (path) => `projects/${PROJECT}/databases/(default)/documents/${path}`;

for (const [name, expected, auth, op, rawPath, existing, incoming] of cases) {
  test(`rules: ${name}`, { skip: !HOST && "FIRESTORE_EMULATOR_HOST not set" }, async () => {
    const path = mapPath(rawPath);
    await call("DELETE", `${BASE}/${path}`, "owner");
    if (existing) {
      assert.equal(await call("PATCH", `${BASE}/${path}`, "owner", { fields: toFields(mapData(existing)) }), 200, "seed");
    }

    const t = token(auth);
    let status;
    if (op === "get") status = await call("GET", `${BASE}/${path}`, t);
    else if (op === "delete") status = await call("DELETE", `${BASE}/${path}`, t);
    else {
      const write = {
        update: { name: docName(path), fields: toFields(mapData(incoming)) },
        currentDocument: { exists: op === "update" },
      };
      status = await call("POST", `${BASE}:commit`, t, { writes: [write] });
    }

    if (expected === "ALLOW") assert.equal(status, 200, `${name}: expected ALLOW, got HTTP ${status}`);
    else assert.ok(status === 403 || status === 401, `${name}: expected DENY, got HTTP ${status}`);
  });
}
