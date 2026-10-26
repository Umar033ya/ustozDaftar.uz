// Route-level test of the inPAY flow in TEST mode against a mocked inPAY API:
// create -> (forged / unsigned / premature webhooks rejected) -> signed webhook
// -> server re-checks GET /payments/{id} -> subscription activated exactly once.
// No network: global fetch is replaced; the key is a dummy sk_test_ value.
import "./helpers/routeHooks.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { pathDb } from "./helpers/pathFirestore.mjs";

const SECRET_KEY = "sk_test_routeharness";
const WEBHOOK_SECRET = "whsec_routeharness";
const BASE = "http://localhost:3000";
Object.assign(process.env, {
  INPAY_SECRET_KEY: SECRET_KEY,
  INPAY_WEBHOOK_SECRET: WEBHOOK_SECRET,
  INPAY_API_BASE_URL: "https://inpay.mock/api/v2",
  APP_BASE_URL: BASE,
});

// ─── Mock inPAY API v2 ────────────────────────────────────────────────────────
const remote = new Map();
const created = [];
let seq = 0;
const ok = (data) => Response.json({ success: true, data });
globalThis.fetch = async (url, init = {}) => {
  assert.equal(init.headers.Authorization, `Bearer ${SECRET_KEY}`);
  const path = new URL(url).pathname.replace(/^\/api\/v2/, "");
  if (init.method === "POST" && path === "/payments/") {
    const body = JSON.parse(init.body);
    const id = `pay_${++seq}`;
    created.push({ body, idempotencyKey: init.headers["Idempotency-Key"] });
    const p = { id, status: "requires_payment_method", amount: body.amount, currency: body.currency, livemode: false, metadata: body.metadata, checkout_url: `https://checkout.inpay.mock/${id}` };
    remote.set(id, p);
    return ok(p);
  }
  const m = /^\/payments\/([^/]+)(\/cancel)?$/.exec(path);
  const p = m && remote.get(decodeURIComponent(m[1]));
  if (!p) return Response.json({ success: false, error: { code: "not_found", message: "no" } }, { status: 404 });
  if (m[2]) p.status = "canceled";
  return ok(p);
};

const db = pathDb();
globalThis.__routeHarness = {
  db,
  tokens: new Map([
    ["tok-a", { uid: "teacherA", email: "a@test.uz" }],
    ["tok-b", { uid: "teacherB", email: "b@test.uz" }],
  ]),
};
db.store.set("users/teacherA", { firstName: "Ali", plan: "free", planExpiry: 0 });
db.store.set("users/teacherB", { firstName: "Bobur", plan: "free", planExpiry: 0 });

const createRoute = await import("../app/api/payments/inpay/create/route.js");
const webhookRoute = await import("../app/api/payments/inpay/webhook/route.js");
const statusRoute = await import("../app/api/payments/inpay/status/route.js");

const json = (token, body) =>
  new Request(`${BASE}/api/payments/inpay/create`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

function sign(raw, { secret = WEBHOOK_SECRET, t = Math.floor(Date.now() / 1000) } = {}) {
  return `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${raw}`, "utf8").digest("hex")}`;
}

function webhook(event, signature) {
  const raw = JSON.stringify(event);
  const headers = { "Content-Type": "application/json" };
  const sig = signature === undefined ? sign(raw) : signature;
  if (sig) headers["X-Inpay-Signature"] = sig;
  return webhookRoute.POST(new Request(`${BASE}/api/payments/inpay/webhook`, { method: "POST", headers, body: raw }));
}

let evt = 0;
const event = (providerId, ourId, extra = {}) => ({
  id: `evt_test${String(++evt).padStart(6, "0")}`,
  type: "payment.succeeded",
  livemode: false,
  data: { object: { id: providerId, status: "succeeded", metadata: { payment_id: ourId } } },
  ...extra,
});

const status = (token, pid) =>
  statusRoute.GET(new Request(`${BASE}/api/payments/inpay/status?pid=${pid}`, { headers: { Authorization: `Bearer ${token}` } }));

let payA; // { paymentId, providerId }

test("create: server-side price, test mode, our webhook/return URLs, idempotency key", async () => {
  const res = await createRoute.POST(json("tok-a", { plan: "pro", billingPeriod: "monthly", amount: 1 }));
  assert.equal(res.status, 200);
  const { paymentId, payUrl } = await res.json();
  assert.match(payUrl, /^https:\/\/checkout\.inpay\.mock\//);

  const sent = created.at(-1);
  assert.equal(sent.body.amount, 20000, "the client's amount is ignored");
  assert.equal(sent.body.currency, "UZS");
  assert.equal(sent.body.webhook_url, `${BASE}/api/payments/inpay/webhook`);
  assert.equal(sent.body.return_url, `${BASE}/dashboard/payment?pid=${paymentId}`);
  assert.equal(sent.idempotencyKey, `ustozdaftar-${paymentId}`);

  const stored = db.raw(`inpayPayments/${paymentId}`);
  assert.equal(stored.status, "pending");
  assert.equal(stored.livemode, false);
  payA = { paymentId, providerId: stored.providerPaymentId };
});

test("create: unknown plan or no token is refused", async () => {
  assert.equal((await createRoute.POST(json("tok-a", { plan: "gold", billingPeriod: "monthly" }))).status, 400);
  assert.equal((await createRoute.POST(json("nope", { plan: "pro", billingPeriod: "monthly" }))).status, 401);
});

test("webhook: unsigned, wrongly signed and stale events are rejected", async () => {
  const e = event(payA.providerId, payA.paymentId);
  assert.equal((await webhook(e, "")).status, 401);
  assert.equal((await webhook(e, sign(JSON.stringify(e), { secret: "whsec_wrong" }))).status, 401);
  assert.equal((await webhook(e, sign(JSON.stringify(e), { t: Math.floor(Date.now() / 1000) - 600 }))).status, 401);
  assert.equal((await webhook(e, "t=1,v1=zz")).status, 401);
  assert.equal(db.raw("users/teacherA").plan, "free");
});

test("webhook: a signed 'succeeded' event does NOT activate while inPAY still says unpaid", async () => {
  const res = await webhook(event(payA.providerId, payA.paymentId));
  assert.equal(res.status, 200);
  assert.equal((await res.json()).status, "pending");
  assert.equal(db.raw("users/teacherA").plan, "free");
  assert.equal(db.raw(`inpayPayments/${payA.paymentId}`).activatedAt, undefined);
});

let expiryAfterFirst;
test("webhook: once inPAY confirms the payment, the plan is activated", async () => {
  remote.get(payA.providerId).status = "succeeded";
  const first = event(payA.providerId, payA.paymentId);
  const res = await webhook(first);
  assert.equal((await res.json()).status, "success");

  const user = db.raw("users/teacherA");
  assert.equal(user.plan, "pro");
  const days = (user.planExpiry - Date.now()) / 86_400_000;
  assert.ok(days > 29.9 && days <= 30, `about 30 days, got ${days}`);
  const p = db.raw(`inpayPayments/${payA.paymentId}`);
  assert.equal(p.status, "success");
  assert.ok(p.activatedAt && p.paidAt);
  expiryAfterFirst = user.planExpiry;

  // Same event delivered again: acknowledged, no work.
  assert.equal((await (await webhook(first)).json()).duplicate, true);
  // A different event for the same payment: still no second extension.
  assert.equal((await webhook(event(payA.providerId, payA.paymentId))).status, 200);
  assert.equal(db.raw("users/teacherA").planExpiry, expiryAfterFirst);
});

test("status: the owner sees the verified result; other users get 404", async () => {
  const res = await status("tok-a", payA.paymentId);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).payment.status, "success");
  assert.equal(db.raw("users/teacherA").planExpiry, expiryAfterFirst, "polling does not extend again");
  assert.equal((await status("tok-b", payA.paymentId)).status, 404);
});

test("webhook: amount mismatch is held for review, not activated", async () => {
  const res = await createRoute.POST(json("tok-b", { plan: "max", billingPeriod: "monthly" }));
  const { paymentId } = await res.json();
  const providerId = db.raw(`inpayPayments/${paymentId}`).providerPaymentId;
  Object.assign(remote.get(providerId), { status: "succeeded", amount: 1000 });

  assert.equal((await (await webhook(event(providerId, paymentId))).json()).status, "review");
  assert.equal(db.raw(`inpayPayments/${paymentId}`).errorCode, "amount_mismatch");
  assert.equal(db.raw("users/teacherB").plan, "free");
});

test("webhook: live-mode events, unknown payments and other event types are ignored", async () => {
  const live = await webhook(event(payA.providerId, payA.paymentId, { livemode: true }));
  assert.equal((await live.json()).ignored, "mode");
  const unknown = await webhook(event("pay_unknown", "doesnotexist00"));
  assert.equal((await unknown.json()).ignored, "unknown_payment");
  const other = await webhook({ ...event(payA.providerId, payA.paymentId), type: "customer.created" });
  assert.equal((await other.json()).ignored, "event_type");
});
