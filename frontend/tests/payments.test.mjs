import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createInPayClient, readInPayConfig, verifyWebhookSignature, InPayError } from "../lib/server/inpay.js";
import { createPaymentService, mapProviderStatus, markRefunded, PENDING_TTL_MS } from "../lib/server/subscriptionPayments.js";
import { approveRequest, parseAmount, rejectRequest } from "../lib/server/manualPayments.js";
import { computePlanChange, DAY_MS, planOffer } from "../lib/plans.js";
import { fakeDb, silentLog } from "./helpers/fakeFirestore.mjs";

// ─── Plans and the "prorate by value" upgrade policy ─────────────────────────
test("plan catalog matches the prices shown in the app", () => {
  assert.deepEqual(planOffer("pro", "monthly"), { amount: 20000, days: 30 });
  assert.deepEqual(planOffer("max", "yearly"), { amount: 480000, days: 365 });
  assert.equal(planOffer("free", "monthly"), null);
  assert.equal(planOffer("pro", "weekly"), null);
  assert.equal(planOffer("__proto__", "monthly"), null);
  assert.equal(planOffer("pro", "constructor"), null);
});

test("proration: same plan stacks, upgrade converts by value, free/expired gets no credit", () => {
  const now = 1000 * DAY_MS;
  // renewal of an active plan stacks 1:1
  assert.equal(computePlanChange({ currentPlan: "pro", currentExpiry: now + 10 * DAY_MS, plan: "pro", days: 30, now }).planExpiry, now + 40 * DAY_MS);
  // 10 Pro days (666.67 so'm/day) -> 10 * 666.67 / 1500 = 4.444 Max days
  const up = computePlanChange({ currentPlan: "pro", currentExpiry: now + 10 * DAY_MS, plan: "max", days: 30, now });
  assert.equal(up.creditMs, Math.round((10 * DAY_MS * 20000) / 45000));
  assert.ok(Math.abs(up.creditMs / DAY_MS - 4.444) < 0.001);
  // 9 Max days -> 9 * 1500 / 666.67 = 20.25 Pro days
  const down = computePlanChange({ currentPlan: "max", currentExpiry: now + 9 * DAY_MS, plan: "pro", days: 30, now });
  assert.ok(Math.abs(down.creditMs / DAY_MS - 20.25) < 0.001);
  // expired or free: starts now
  assert.equal(computePlanChange({ currentPlan: "pro", currentExpiry: now - DAY_MS, plan: "max", days: 30, now }).creditMs, 0);
  assert.equal(computePlanChange({ currentPlan: "free", currentExpiry: null, plan: "pro", days: 365, now }).planExpiry, now + 365 * DAY_MS);
});

test("provider statuses (API v2) map to payment statuses", () => {
  assert.equal(mapProviderStatus("succeeded"), "success");
  assert.equal(mapProviderStatus("failed"), "failed");
  assert.equal(mapProviderStatus("canceled"), "cancelled");
  for (const s of ["requires_payment_method", "requires_action", "processing", "something-new"]) assert.equal(mapProviderStatus(s), "pending");
});

test("config: the key prefix decides the mode", () => {
  assert.equal(readInPayConfig({ INPAY_SECRET_KEY: "sk_test_x" }).mode, "test");
  assert.equal(readInPayConfig({ INPAY_SECRET_KEY: "sk_live_x" }).livemode, true);
  assert.equal(readInPayConfig({ INPAY_SECRET_KEY: "abc" }).configured, false);
  assert.equal(readInPayConfig({}).baseUrl, "https://inpay.uz/api/v2");
});

// ─── Service flow with a fake inPAY ──────────────────────────────────────────
function fakeInPay({ status = "requires_payment_method", amount, livemode = false } = {}) {
  const state = { status, amount, livemode, created: [], cancels: 0, checks: 0 };
  return {
    state,
    async createPayment(p) {
      state.created.push(p);
      state.amount ??= p.amount;
      return { id: `pay${state.created.length}`, status: "requires_payment_method", checkoutUrl: "https://inpay.uz/checkout/pay1", livemode: state.livemode, amount: p.amount, currency: "UZS" };
    },
    async getPayment(id) {
      state.checks += 1;
      return { id, status: state.status, amount: state.amount, currency: "UZS", livemode: state.livemode, metadata: {} };
    },
    async cancelPayment(id) {
      state.cancels += 1;
      if (state.status === "succeeded") throw new InPayError("paid", { code: "invalid_state" });
      state.status = "canceled";
      return { id, status: "canceled", amount: state.amount, currency: "UZS", livemode: state.livemode };
    },
  };
}

function setup({ provider = fakeInPay(), livemode = false } = {}) {
  const db = fakeDb();
  const clock = { t: 1_800_000_000_000 };
  const service = createPaymentService({ db, inpay: provider, livemode, now: () => clock.t, log: silentLog });
  return { db, inpay: provider, clock, service };
}
const start = (service, plan = "pro", billingPeriod = "monthly") => service.startPayment({ uid: "u1", plan, billingPeriod, baseUrl: "https://app.test" });

test("startPayment: server price, idempotency key, webhook and return URLs", async () => {
  const { service, inpay, db } = setup();
  const { paymentId, payUrl } = await start(service, "max", "yearly");
  const sent = inpay.state.created[0];
  assert.equal(payUrl, "https://inpay.uz/checkout/pay1");
  assert.equal(sent.amount, 480000);
  assert.equal(sent.idempotencyKey, `ustozdaftar-${paymentId}`);
  assert.equal(sent.webhookUrl, "https://app.test/api/payments/inpay/webhook");
  assert.equal(sent.returnUrl, `https://app.test/dashboard/payment?pid=${paymentId}`);
  assert.deepEqual(sent.metadata, { payment_id: paymentId, plan: "max", billing_period: "yearly" });
  const stored = db.store.get(`inpayPayments/${paymentId}`);
  assert.equal(stored.status, "pending");
  assert.equal(stored.providerPaymentId, "pay1");
  assert.equal(stored.livemode, false);
});

test("startPayment rejects unknown plans before calling inPAY", async () => {
  const { service, inpay } = setup();
  await assert.rejects(service.startPayment({ uid: "u1", plan: "free", billingPeriod: "monthly", baseUrl: "https://a" }));
  assert.equal(inpay.state.created.length, 0);
});

test("a live server refuses a payment inPAY created in test mode", async () => {
  const { service, db } = setup({ provider: fakeInPay({ livemode: false }), livemode: true });
  await assert.rejects(start(service));
  const [stored] = [...db.store.values()];
  assert.equal(stored.status, "failed");
});

test("pending stays pending and does not touch the subscription", async () => {
  const { service, db } = setup();
  const { paymentId } = await start(service);
  for (const s of ["requires_payment_method", "requires_action", "processing"]) {
    const view = await service.syncPayment(paymentId);
    assert.equal(view.status, "pending", s);
  }
  assert.equal(db.store.get("users/u1"), undefined);
});

test("success activates exactly once, even when webhooks and polls race", async () => {
  const provider = fakeInPay();
  const { service, db, clock } = setup({ provider });
  await db.collection("users").doc("u1").set({ firstName: "Ali", plan: "free", classes: { c1: { name: "5-A" } } });
  const { paymentId } = await start(service);
  provider.state.status = "succeeded";

  const results = await Promise.all([1, 2, 3, 4, 5, 6, 7, 8].map(() => service.syncPayment(paymentId)));
  results.forEach((r) => assert.equal(r.status, "success"));

  const user = db.store.get("users/u1");
  assert.equal(user.plan, "pro");
  assert.equal(user.planExpiry, clock.t + 30 * DAY_MS, "extended exactly once");
  assert.deepEqual(user.classes, { c1: { name: "5-A" } }, "teacher data untouched");

  clock.t += DAY_MS;
  await service.syncPayment(paymentId);
  assert.equal(db.store.get("users/u1").planExpiry, clock.t - DAY_MS + 30 * DAY_MS, "later syncs change nothing");
  assert.equal(db.store.get(`inpayPayments/${paymentId}`).paidAt, clock.t - DAY_MS);
});

test("upgrade Pro -> Max credits the unused Pro time and records it", async () => {
  const provider = fakeInPay();
  const { service, db, clock } = setup({ provider });
  await db.collection("users").doc("u1").set({ plan: "pro", planExpiry: clock.t + 10 * DAY_MS });
  const { paymentId } = await start(service, "max", "monthly");
  provider.state.status = "succeeded";
  const view = await service.syncPayment(paymentId);
  const credit = Math.round((10 * DAY_MS * 20000) / 45000);
  assert.equal(db.store.get("users/u1").plan, "max");
  assert.equal(db.store.get("users/u1").planExpiry, clock.t + 30 * DAY_MS + credit);
  const stored = db.store.get(`inpayPayments/${paymentId}`);
  assert.equal(stored.previousPlan, "pro");
  assert.equal(stored.creditMs, credit);
  assert.equal(view.creditDays, 4.4);
});

test("amount, currency or mode mismatch is held for review, not activated", async () => {
  const provider = fakeInPay({ amount: 1000 });
  const { service, db } = setup({ provider });
  const { paymentId } = await start(service);
  provider.state.status = "succeeded";
  const view = await service.syncPayment(paymentId);
  assert.equal(view.status, "review");
  assert.equal(db.store.get(`inpayPayments/${paymentId}`).errorCode, "amount_mismatch");
  assert.equal(db.store.get("users/u1"), undefined);
});

test("failed and canceled payments are recorded without activation", async () => {
  for (const [remote, local] of [["failed", "failed"], ["canceled", "cancelled"]]) {
    const provider = fakeInPay();
    const { service, db } = setup({ provider });
    const { paymentId } = await start(service);
    provider.state.status = remote;
    const view = await service.syncPayment(paymentId);
    assert.equal(view.status, local);
    assert.equal(view.payUrl, null);
    assert.equal(db.store.get("users/u1"), undefined);
  }
});

test("a stale unpaid payment is cancelled at inPAY and marked expired", async () => {
  const provider = fakeInPay();
  const { service, clock, db } = setup({ provider });
  const { paymentId } = await start(service);
  clock.t += PENDING_TTL_MS + 1;
  assert.equal((await service.syncPayment(paymentId)).status, "expired");
  assert.equal(provider.state.cancels, 1);
  assert.equal(db.store.get("users/u1"), undefined);
});

test("if it was paid just before the cancel, the payment is still honoured", async () => {
  const provider = fakeInPay();
  const { service, clock, db } = setup({ provider });
  const { paymentId } = await start(service);
  clock.t += PENDING_TTL_MS + 1;
  let first = true;
  const realGet = provider.getPayment;
  provider.getPayment = async (id) => {
    if (first) {
      first = false;
      return { id, status: "requires_payment_method", amount: 20000, currency: "UZS", livemode: false };
    }
    return realGet(id);
  };
  provider.state.status = "succeeded"; // cancel will now fail with invalid_state
  assert.equal((await service.syncPayment(paymentId)).status, "success");
  assert.equal(db.store.get("users/u1").plan, "pro");
});

test("provider id lookup and ownership checks", async () => {
  const { service } = setup();
  const { paymentId } = await start(service);
  assert.equal(await service.findPaymentIdByProviderId("pay1"), paymentId);
  assert.equal(await service.findPaymentIdByProviderId("nope"), null);
  assert.equal(await service.isOwner(paymentId, "u1"), true);
  assert.equal(await service.isOwner(paymentId, "u2"), false);
});

test("refund marking removes a success from revenue and only applies to paid payments", async () => {
  const provider = fakeInPay();
  const { service, db, clock } = setup({ provider });
  const { paymentId } = await start(service);
  await assert.rejects(markRefunded(db, "inpayPayments", paymentId, { adminUid: "adm", now: clock.t }));
  provider.state.status = "succeeded";
  await service.syncPayment(paymentId);
  const refunded = await markRefunded(db, "inpayPayments", paymentId, { adminUid: "adm", now: clock.t, note: "inPAY #12" });
  assert.equal(refunded.status, "refunded");
  assert.equal((await service.syncPayment(paymentId)).status, "refunded", "sync never resurrects a refunded payment");
});

// ─── Manual card-transfer approvals ──────────────────────────────────────────
test("manual approval: prorated, exactly once, no self-approval, no approving rejected", async () => {
  const db = fakeDb();
  const now = 1_800_000_000_000;
  await db.collection("users").doc("u1").set({ plan: "pro", planExpiry: now + 5 * DAY_MS });
  await db.collection("paymentRequests").doc("r1").set({ uid: "u1", plan: "pro", billingPeriod: "monthly", amount: "20,000", status: "pending" });

  await assert.rejects(approveRequest(db, "r1", { adminUid: "u1", now }), /O'z so'rovingizni/);
  const [a, b] = await Promise.all([approveRequest(db, "r1", { adminUid: "adm", now }), approveRequest(db, "r1", { adminUid: "adm2", now })]);
  assert.ok(a.alreadyActivated || b.alreadyActivated);
  assert.equal(db.store.get("users/u1").planExpiry, now + 35 * DAY_MS);
  const r = db.store.get("paymentRequests/r1");
  assert.equal(r.status, "approved");
  assert.equal(r.amountValue, 20000);

  await db.collection("paymentRequests").doc("r2").set({ uid: "u1", plan: "max", billingPeriod: "monthly", amount: "45,000", status: "pending" });
  await rejectRequest(db, "r2", { adminUid: "adm", now });
  await assert.rejects(approveRequest(db, "r2", { adminUid: "adm", now }), /ko'rib chiqilgan/);
  assert.equal(db.store.get("users/u1").plan, "pro");
});

test("parseAmount handles the stored string formats", () => {
  assert.equal(parseAmount("20,000"), 20000);
  assert.equal(parseAmount("180 000"), 180000);
  assert.equal(parseAmount(45000), 45000);
  assert.equal(parseAmount(undefined), 0);
});

// ─── HTTP client against the documented v2 endpoints ─────────────────────────
function fakeFetch(routes) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    const key = `${init.method} ${new URL(url).pathname}`;
    const handler = routes[key];
    if (!handler) return new Response(JSON.stringify({ success: false, error: { code: "resource_missing", message: "x" } }), { status: 404 });
    const [status, body] = handler(url, init);
    return new Response(JSON.stringify(body), { status });
  };
  return { impl, calls };
}
const config = readInPayConfig({ INPAY_SECRET_KEY: "sk_test_abc123", INPAY_API_BASE_URL: "https://inpay.example/api/v2" });

test("client: create, get and cancel use Bearer sk_ key and documented paths", async () => {
  const payment = { id: "47907909afd21a28", object: "payment", amount: 20000, currency: "UZS", status: "requires_payment_method", checkout_url: "https://inpay.uz/checkout/47907909afd21a28", livemode: false, metadata: { payment_id: "p1" } };
  const { impl, calls } = fakeFetch({
    "POST /api/v2/payments/": () => [200, { success: true, data: payment }],
    "GET /api/v2/payments/47907909afd21a28": () => [200, { success: true, data: { ...payment, status: "succeeded" } }],
    "POST /api/v2/payments/47907909afd21a28/cancel": () => [400, { success: false, error: { type: "invalid_request_error", code: "invalid_state", message: "Bu to'lov allaqachon succeeded holatida.", request_id: "req_1" } }],
  });
  const client = createInPayClient(config, impl);
  const created = await client.createPayment({ amount: 20000, description: "x", returnUrl: "https://a/r", webhookUrl: "https://a/w", metadata: { payment_id: "p1" }, idempotencyKey: "ustozdaftar-p1" });
  assert.equal(created.id, "47907909afd21a28");
  assert.equal(created.checkoutUrl, payment.checkout_url);
  assert.equal((await client.getPayment(created.id)).status, "succeeded");
  await assert.rejects(client.cancelPayment(created.id), (e) => e.code === "invalid_state" && e.requestId === "req_1");

  const create = calls[0];
  assert.equal(create.init.headers.Authorization, "Bearer sk_test_abc123");
  assert.equal(create.init.headers["Idempotency-Key"], "ustozdaftar-p1");
  const sent = JSON.parse(create.init.body);
  assert.deepEqual(sent, { amount: 20000, currency: "UZS", description: "x", return_url: "https://a/r", webhook_url: "https://a/w", metadata: { payment_id: "p1" } });
});

test("client: rejects non-integer or too small amounts locally", async () => {
  const client = createInPayClient(config, async () => assert.fail("must not call inPAY"));
  await assert.rejects(client.createPayment({ amount: 999, idempotencyKey: "k" }), (e) => e.code === "amount_invalid");
  await assert.rejects(client.createPayment({ amount: 20000.5, idempotencyKey: "k" }), (e) => e.code === "amount_invalid");
});

test("client: business errors never echo the secret key", async () => {
  const { impl } = fakeFetch({ "POST /api/v2/payments/": () => [401, { success: false, error: { code: "invalid_api_key", message: "Yaroqsiz API kalit." } }] });
  const client = createInPayClient(config, impl);
  await assert.rejects(
    client.createPayment({ amount: 20000, description: "x", returnUrl: "https://a", webhookUrl: "https://a", metadata: {}, idempotencyKey: "k" }),
    (e) => e instanceof InPayError && e.code === "invalid_api_key" && !e.message.includes("sk_test_abc123")
  );
});

// ─── Webhook signature (t=…,v1=… over "{t}.{raw}") ───────────────────────────
test("webhook signature: valid, tampered, stale, wrong secret, malformed", () => {
  const secret = "whsec_test";
  const body = '{"id":"evt_839201ab","type":"payment.succeeded","livemode":false,"data":{"object":{"id":"pay1","amount":20000}}}';
  const t = 1_790_511_600;
  const v1 = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  assert.deepEqual(verifyWebhookSignature(body, `t=${t},v1=${v1}`, secret, t + 10), { ok: true, timestamp: t });
  assert.equal(verifyWebhookSignature(body, `t=${t},v1=deadbeef,v1=${v1}`, secret, t).ok, true, "any listed v1 may match");
  assert.equal(verifyWebhookSignature(body.replace("20000", "90000"), `t=${t},v1=${v1}`, secret, t).reason, "bad_signature");
  assert.equal(verifyWebhookSignature(body, `t=${t},v1=${v1}`, secret, t + 301).reason, "stale_signature");
  assert.equal(verifyWebhookSignature(body, `t=${t},v1=${v1}`, "whsec_other", t).reason, "bad_signature");
  assert.equal(verifyWebhookSignature(body, `v1=${v1}`, secret, t).reason, "malformed_signature");
  assert.equal(verifyWebhookSignature(body, "", secret, t).reason, "missing_signature");
  assert.equal(verifyWebhookSignature(body, `t=${t},v1=${v1}`, "", t).reason, "no_secret");
});
