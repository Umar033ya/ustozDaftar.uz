import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFinanceReport, dayKey, dayStart, normalizeInpay, normalizeManual } from "../lib/server/financeStats.js";

const H = 60 * 60 * 1000;
// 2026-10-25 12:00 Tashkent = 07:00 UTC
const NOW = Date.parse("2026-10-25T07:00:00Z");

function inpay(id, fields) {
  return normalizeInpay(id, { uid: "u1", plan: "pro", billingPeriod: "monthly", amount: 20000, currency: "UZS", provider: "inpay", livemode: true, createdAt: NOW - H, ...fields });
}

const users = [
  { uid: "u1", plan: "pro", planExpiry: NOW + 10 * 24 * H, name: "Ali Valiyev", email: "ali@example.uz" },
  { uid: "u2", plan: "max", planExpiry: NOW + 24 * H, name: "Vali", email: "v@example.uz" },
  { uid: "u3", plan: "max", planExpiry: NOW - H, name: "", email: "" },
  { uid: "u4", plan: "free" },
  { uid: "u5" },
];

test("Tashkent day boundaries (UTC+5)", () => {
  assert.equal(dayKey(Date.parse("2026-10-24T18:59:59Z")), "2026-10-24");
  assert.equal(dayKey(Date.parse("2026-10-24T19:00:00Z")), "2026-10-25");
  assert.equal(dayStart("2026-10-25"), Date.parse("2026-10-24T19:00:00Z"));
});

test("revenue counts only successful live payments, once each", () => {
  const transactions = [
    inpay("a", { status: "success", paidAt: NOW - H }),
    inpay("b", { status: "success", paidAt: NOW - 3 * 24 * H, amount: 45000, plan: "max" }),
    inpay("c", { status: "pending" }),
    inpay("d", { status: "failed" }),
    inpay("e", { status: "cancelled" }),
    inpay("f", { status: "expired" }),
    inpay("g", { status: "review", paidAt: null }),
    inpay("h", { status: "refunded", paidAt: NOW - H }),
    inpay("t", { status: "success", paidAt: NOW - H, livemode: false, amount: 999999 }),
    normalizeManual("m1", { uid: "u2", plan: "max", billingPeriod: "monthly", amount: "45,000", status: "approved", createdAt: NOW - 2 * H, processedAt: NOW - H, userName: "Vali", userEmail: "v@example.uz" }),
    normalizeManual("m2", { uid: "u2", plan: "pro", billingPeriod: "monthly", amount: "20,000", status: "rejected", createdAt: NOW - 2 * H }),
    normalizeManual("m3", { uid: "u2", plan: "pro", billingPeriod: "monthly", amount: "20,000", status: "pending", createdAt: NOW - 2 * H }),
  ];
  const r = buildFinanceReport({ transactions, users, now: NOW });

  assert.equal(r.cards.totalRevenue, 20000 + 45000 + 45000);
  assert.equal(r.cards.revenueToday, 20000 + 45000);
  assert.equal(r.cards.revenueMonth, 110000);
  assert.equal(r.cards.successCount, 3);
  assert.equal(r.cards.pendingCount, 2);
  assert.equal(r.cards.failedCount, 4, "failed + cancelled + expired + rejected");
  assert.equal(r.cards.activePro, 1);
  assert.equal(r.cards.activeMax, 1);
  assert.equal(r.cards.expiredSubscriptions, 1);
  assert.deepEqual(r.charts.planDistribution, { pro: 1, max: 1, expired: 1, free: 2 });
  assert.equal(r.table.total, 11, "test payments hidden by default");

  const withTest = buildFinanceReport({ transactions, users, now: NOW, filters: { includeTest: true } });
  assert.equal(withTest.table.total, 12);
  assert.equal(withTest.cards.totalRevenue, 110000 + 999999);
});

test("daily and monthly charts sum to the collected revenue in range", () => {
  const transactions = [
    inpay("a", { status: "success", createdAt: NOW - 2 * H, paidAt: NOW - H }),
    inpay("b", { status: "success", createdAt: Date.parse("2026-09-15T05:00:00Z"), paidAt: Date.parse("2026-09-15T06:00:00Z"), amount: 180000 }),
  ];
  const r = buildFinanceReport({ transactions, users: [], now: NOW, filters: { from: "2026-09-01", to: "2026-10-25" } });
  assert.equal(r.charts.daily.length, 55);
  assert.equal(r.charts.daily.reduce((s, d) => s + d.amount, 0), 200000);
  assert.equal(r.charts.daily.find((d) => d.key === "2026-09-15").amount, 180000);
  assert.equal(r.charts.monthly.length, 12);
  assert.equal(r.charts.monthly.at(-1).key, "2026-10");
  assert.equal(r.charts.monthly.find((m) => m.key === "2026-09").amount, 180000);
});

test("filters, customer join and pagination", () => {
  const transactions = Array.from({ length: 60 }, (_, i) =>
    inpay(`p${String(i).padStart(2, "0")}`, {
      status: i % 3 === 0 ? "success" : "pending",
      plan: i % 2 ? "max" : "pro",
      createdAt: NOW - i * H,
      paidAt: i % 3 === 0 ? NOW - i * H : null,
    })
  );
  const r = buildFinanceReport({ transactions, users, now: NOW, filters: { status: "success", plan: "pro" } });
  assert.equal(r.table.total, 10); // i % 6 === 0
  assert.ok(r.table.rows.every((row) => row.status === "success" && row.plan === "pro"));
  assert.equal(r.table.rows[0].customerName, "Ali Valiyev");

  const page3 = buildFinanceReport({ transactions, users, now: NOW, filters: { page: 3 } });
  assert.equal(page3.table.pageCount, 3);
  assert.equal(page3.table.rows.length, 10);
  assert.equal(page3.table.rows[0].id, "p50", "newest first");
  const beyond = buildFinanceReport({ transactions, users, now: NOW, filters: { page: 99 } });
  assert.equal(beyond.table.page, 3);
});
