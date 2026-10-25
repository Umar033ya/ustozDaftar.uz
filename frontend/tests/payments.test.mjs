import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createInPayClient, verifyWebhookSignature, InPayError } from "../lib/server/inpay.js";
import { createPaymentService, mapProviderStatus, PENDING_TTL_MS } from "../lib/server/subscriptionPayments.js";
import { extendedExpiry, planOffer } from "../lib/plans.js";

const DAY = 24 * 60 * 60 * 1000;
const silent = { info() {}, warn() {}, error() {} };

// ─── Minimal in-memory Firestore (only the calls the service uses) ───────────
function fakeDb() {
  const store = new Map(); // "col/id" -> data
  let autoId = 0;
  const docRef = (col, id) => ({
    id,
    path: `${col}/${id}`,
    async get() {
      const data = store.get(`${col}/${id}`);
      return { exists: data !== undefined, id, data: () => (data ? structuredClone(data) : undefined) };
    },
    async set(data, opts) {
      const prev = store.get(`${col}/${id}`);
      store.set(`${col}/${id}`, opts?.merge ? { ...prev, ...data } : { ...data });
    },
    async update(data) {
      const prev = store.get(`${col}/${id}`);
      if (!prev) throw new Error("NOT_FOUND");
      store.set(`${col}/${id}`, { ...prev, ...data });
    },
  });
  const db = {
    store,
    collection: (col) => ({
      doc: (id) => docRef(col, id ?? `auto${String(++autoId).padStart(10, "0")}`),
      where: (field, _op, value) => ({
        limit: () => ({
          async get() {
            const docs = [...store.entries()]
              .filter(([k, v]) => k.startsWith(`${col}/`) && v[field] === value)
              .map(([k]) => ({ id: k.split("/")[1] }));
            return { empty: docs.length === 0, docs };
          },
        }),
      }),
    }),
    // Serialised transactions are enough to test the idempotency logic.
    queue: Promise.resolve(),
    runTransaction(fn) {
      const run = db.queue.then(() =>
        fn({
          get: (ref) => ref.get(),
          set: (ref, data, opts) => ref.set(data, opts),
          update: (ref, data) => ref.update(data),
        })
      );
      db.queue = run.catch(() => {});
      return run;
    },
  };
  return db;
}

function fakeInPay({ status = "pending", amount = 20000 } = {}) {
  const state = { status, amount, created: [], checks: 0 };
  return {
    state,
    async createPayment(p) {
      state.created.push(p);
      return { orderId: `ord${state.created.length}`, payUrl: "https://inpay.uz/pay/abc" };
    },
    async getTransaction(orderId) {
      state.checks += 1;
      return { orderId, status: state.status, amount: state.amount, paidAt: null };
    },
  };
}

function setup({ now = 1_700_000_000_000, provider } = {}) {
  const db = fakeDb();
  const inpay = provider || fakeInPay();
  const clock = { t: now };
  const service = createPaymentService({ db, inpay, now: () => clock.t, log: silent });
  return { db, inpay, clock, service };
}

// ─── Plans ──────────────────────────────────────────────────────────────────
test("plan catalog matches the prices shown in the app", () => {
  assert.deepEqual(planOffer("pro", "monthly"), { amount: 20000, days: 30 });
  assert.deepEqual(planOffer("max", "yearly"), { amount: 480000, days: 365 });
  assert.equal(planOffer("free", "monthly"), null);
  assert.equal(planOffer("pro", "weekly"), null);
  assert.equal(planOffer("__proto__", "monthly"), null);
});

test("renewing an active plan extends from its expiry, otherwise from now", () => {
  const now = 1_000 * DAY;
  assert.equal(extendedExpiry({ currentPlan: "pro", currentExpiry: now + 5 * DAY, plan: "pro", days: 30, now }), now + 35 * DAY);
  assert.equal(extendedExpiry({ currentPlan: "pro", currentExpiry: now - DAY, plan: "pro", days: 30, now }), now + 30 * DAY);
  assert.equal(extendedExpiry({ currentPlan: "pro", currentExpiry: now + 5 * DAY, plan: "max", days: 30, now }), now + 30 * DAY);
});

test("provider statuses map to payment statuses", () => {
  assert.equal(mapProviderStatus("success"), "success");
  assert.equal(mapProviderStatus("failed"), "failed");
  assert.equal(mapProviderStatus("cancelled"), "cancelled");
  assert.equal(mapProviderStatus("pending"), "pending");
  assert.equal(mapProviderStatus("something-new"), "pending");
});

// ─── Service flow ───────────────────────────────────────────────────────────
test("startPayment uses the server price and stores a pending payment", async () => {
  const { service, inpay, db } = setup();
  const { paymentId, payUrl } = await service.startPayment({ uid: "u1", plan: "max", billingPeriod: "yearly", baseUrl: "https://app.test" });
  assert.equal(payUrl, "https://inpay.uz/pay/abc");
  assert.equal(inpay.state.created[0].amount, 480000);
  assert.equal(inpay.state.created[0].callbackUrl, "https://app.test/api/payments/inpay/webhook");
  assert.equal(inpay.state.created[0].returnUrl, `https://app.test/dashboard/payment?pid=${paymentId}`);
  const stored = db.store.get(`inpayPayments/${paymentId}`);
  assert.equal(stored.status, "pending");
  assert.equal(stored.uid, "u1");
  assert.equal(stored.orderId, "ord1");
});

test("startPayment rejects unknown plans before calling inPAY", async () => {
  const { service, inpay } = setup();
  await assert.rejects(service.startPayment({ uid: "u1", plan: "free", billingPeriod: "monthly", baseUrl: "https://a" }));
  assert.equal(inpay.state.created.length, 0);
});

test("pending stays pending and does not touch the subscription", async () => {
  const { service, db } = setup();
  const { paymentId } = await service.startPayment({ uid: "u1", plan: "pro", billingPeriod: "monthly", baseUrl: "https://a" });
  const view = await service.syncPayment(paymentId);
  assert.equal(view.status, "pending");
  assert.equal(view.payUrl, "https://inpay.uz/pay/abc");
  assert.equal(db.store.get("users/u1"), undefined);
});

test("success activates once, even when webhook and polls race", async () => {
  const provider = fakeInPay({ status: "success", amount: 20000 });
  const { service, db, clock } = setup({ provider });
  await db.collection("users").doc("u1").set({ firstName: "Ali", plan: "free" });
  const { paymentId } = await service.startPayment({ uid: "u1", plan: "pro", billingPeriod: "monthly", baseUrl: "https://a" });

  const results = await Promise.all([1, 2, 3, 4, 5].map(() => service.syncPayment(paymentId)));
  results.forEach((r) => assert.equal(r.status, "success"));

  const user = db.store.get("users/u1");
  assert.equal(user.plan, "pro");
  assert.equal(user.planExpiry, clock.t + 30 * DAY, "extended exactly once");
  assert.equal(user.firstName, "Ali", "other profile fields untouched");

  clock.t += DAY;
  await service.syncPayment(paymentId);
  assert.equal(db.store.get("users/u1").planExpiry, clock.t - DAY + 30 * DAY, "later syncs change nothing");
});

test("a renewal stacks on top of the remaining time", async () => {
  const provider = fakeInPay({ status: "success", amount: 20000 });
  const { service, db, clock } = setup({ provider });
  await db.collection("users").doc("u1").set({ plan: "pro", planExpiry: clock.t + 10 * DAY });
  const { paymentId } = await service.startPayment({ uid: "u1", plan: "pro", billingPeriod: "monthly", baseUrl: "https://a" });
  await service.syncPayment(paymentId);
  assert.equal(db.store.get("users/u1").planExpiry, clock.t + 40 * DAY);
});

test("a success with a lower amount is held for review, not activated", async () => {
  const provider = fakeInPay({ status: "success", amount: 1000 });
  const { service, db } = setup({ provider });
  const { paymentId } = await service.startPayment({ uid: "u1", plan: "pro", billingPeriod: "monthly", baseUrl: "https://a" });
  const view = await service.syncPayment(paymentId);
  assert.equal(view.status, "review");
  assert.equal(db.store.get("users/u1"), undefined);
});

test("failed and cancelled payments are recorded without activation", async () => {
  for (const status of ["failed", "cancelled"]) {
    const provider = fakeInPay({ status });
    const { service, db } = setup({ provider });
    const { paymentId } = await service.startPayment({ uid: "u1", plan: "pro", billingPeriod: "monthly", baseUrl: "https://a" });
    const view = await service.syncPayment(paymentId);
    assert.equal(view.status, status);
    assert.equal(view.payUrl, null);
    assert.equal(db.store.get("users/u1"), undefined);
  }
});

test("an old unpaid payment expires, but a late success is still honoured", async () => {
  const provider = fakeInPay({ status: "pending" });
  const { service, db, clock } = setup({ provider });
  const { paymentId } = await service.startPayment({ uid: "u1", plan: "pro", billingPeriod: "monthly", baseUrl: "https://a" });
  clock.t += PENDING_TTL_MS + 1;
  assert.equal((await service.syncPayment(paymentId)).status, "expired");

  provider.state.status = "success";
  provider.state.amount = 20000;
  assert.equal((await service.syncPayment(paymentId)).status, "success");
  assert.equal(db.store.get("users/u1").plan, "pro");
});

test("webhook lookup by order id and ownership checks", async () => {
  const { service } = setup();
  const { paymentId } = await service.startPayment({ uid: "u1", plan: "pro", billingPeriod: "monthly", baseUrl: "https://a" });
  assert.equal(await service.findPaymentIdByOrderId("ord1"), paymentId);
  assert.equal(await service.findPaymentIdByOrderId("nope"), null);
  assert.equal(await service.isOwner(paymentId, "u1"), true);
  assert.equal(await service.isOwner(paymentId, "u2"), false);
});

// ─── HTTP client against the documented endpoints ───────────────────────────
function fakeFetch(routes) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    const path = new URL(url).pathname;
    const handler = routes[path];
    if (!handler) return new Response(JSON.stringify({ success: false, error_code: "NOT_FOUND" }), { status: 404 });
    const [status, body] = handler(url, init);
    return new Response(JSON.stringify(body), { status });
  };
  return { impl, calls };
}

const config = { merchantId: "123", merchantToken: "t".repeat(32), baseUrl: "https://inpay.example/api/v1", webhookSecret: "" };

test("client authorises, caches the bearer token and creates a payment", async () => {
  const { impl, calls } = fakeFetch({
    "/api/v1/authorization/": () => [200, { success: true, bearer_token: "BEARER" }],
    "/api/v1/create/": () => [200, { success: true, order_id: "abcdef0123456789", pay_url: "https://inpay.uz/c/abc" }],
    "/api/v1/transactions/": () => [200, { success: true, order_id: "abcdef0123456789", status: "success", amount: "20000.00" }],
  });
  const client = createInPayClient(config, impl);
  const created = await client.createPayment({ amount: 20000, description: "x", callbackUrl: "https://a/w", returnUrl: "https://a/r" });
  assert.deepEqual(created, { orderId: "abcdef0123456789", payUrl: "https://inpay.uz/c/abc" });
  const tx = await client.getTransaction("abcdef0123456789");
  assert.equal(tx.status, "success");
  assert.equal(tx.amount, 20000);

  assert.equal(calls.filter((c) => c.url.includes("/authorization/")).length, 1, "token fetched once");
  const createCall = calls.find((c) => c.url.endsWith("/create/"));
  assert.equal(createCall.init.method, "POST");
  assert.equal(createCall.init.headers.Authorization, "Bearer BEARER");
  const sent = JSON.parse(createCall.init.body);
  assert.equal(sent.merchant_id, "123");
  assert.equal(sent.amount, 20000);
  assert.equal(sent.callback_url, "https://a/w");
});

test("client surfaces inPAY business errors without leaking credentials", async () => {
  const { impl } = fakeFetch({
    "/api/v1/authorization/": () => [200, { success: true, bearer_token: "BEARER" }],
    "/api/v1/create/": () => [400, { success: false, error_code: "AMOUNT_TOO_LOW", message: "Minimal summa 1000" }],
  });
  const client = createInPayClient(config, impl);
  await assert.rejects(
    client.createPayment({ amount: 10, description: "x", callbackUrl: "https://a", returnUrl: "https://a" }),
    (error) => error instanceof InPayError && error.code === "AMOUNT_TOO_LOW" && !error.message.includes(config.merchantToken)
  );
});

test("webhook signature: valid, tampered, prefixed and missing", () => {
  const secret = "whsec_test";
  const body = '{"order_id":"abc","status":"success","amount":"20000.00"}';
  const sig = createHmac("sha256", secret).update(body).digest("hex");
  assert.equal(verifyWebhookSignature(body, sig, secret), true);
  assert.equal(verifyWebhookSignature(body, `sha256=${sig}`, secret), true);
  assert.equal(verifyWebhookSignature(body.replace("20000", "90000"), sig, secret), false);
  assert.equal(verifyWebhookSignature(body, "", secret), false);
  assert.equal(verifyWebhookSignature(body, sig, ""), false);
  assert.equal(verifyWebhookSignature(body, "zz", secret), false);
});
