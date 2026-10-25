import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { guardAdmin } from "@/lib/server/adminRoute";
import { buildFinanceReport, normalizeInpay, normalizeManual } from "@/lib/server/financeStats";
import { toMillis } from "@/lib/server/subscriptionPayments";
import { paymentRuntime } from "@/lib/server/paymentRuntime";

// GET /api/admin/finance?from=YYYY-MM-DD&to=YYYY-MM-DD&status=&plan=&provider=&includeTest=1&page=
// Authorization: Bearer <Firebase ID token with the admin claim>
//
// Aggregates verified payment records with the Admin SDK. Users' documents are
// read with a field mask (plan, expiry, name, email) — never their classes,
// students or assessments.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = ["success", "pending", "creating", "failed", "cancelled", "expired", "rejected", "review", "refunded"];

export async function GET(request) {
  const { admin, response } = await guardAdmin(request);
  if (response) return response;

  const q = new URL(request.url).searchParams;
  const filters = {
    from: DAY_RE.test(q.get("from") || "") ? q.get("from") : undefined,
    to: DAY_RE.test(q.get("to") || "") ? q.get("to") : undefined,
    status: STATUSES.includes(q.get("status")) ? q.get("status") : undefined,
    plan: ["pro", "max"].includes(q.get("plan")) ? q.get("plan") : undefined,
    provider: ["inpay", "manual"].includes(q.get("provider")) ? q.get("provider") : undefined,
    includeTest: q.get("includeTest") === "1",
    page: Number(q.get("page")) || 1,
  };
  if (filters.from && filters.to && filters.from > filters.to) {
    return NextResponse.json({ error: "Boshlanish sanasi tugash sanasidan keyin bo'lishi mumkin emas.", code: "bad_range" }, { status: 400 });
  }

  try {
    const db = adminDb();
    const [inpaySnap, manualSnap, usersSnap] = await Promise.all([
      db.collection("inpayPayments").get(),
      db.collection("paymentRequests").get(),
      db.collection("users").select("plan", "planExpiry", "firstName", "lastName", "email").get(),
    ]);

    const transactions = [
      ...inpaySnap.docs.map((d) => normalizeInpay(d.id, d.data())),
      ...manualSnap.docs.map((d) => normalizeManual(d.id, d.data())),
    ];
    const users = usersSnap.docs.map((d) => {
      const u = d.data();
      return {
        uid: d.id,
        plan: u.plan,
        planExpiry: toMillis(u.planExpiry),
        name: [u.firstName, u.lastName].filter(Boolean).join(" "),
        email: u.email || "",
      };
    });

    const report = buildFinanceReport({ transactions, users, filters, now: Date.now() });
    // Provider status, so the dashboard never presents an unconnected provider as live.
    const rt = paymentRuntime();
    report.providers = {
      inpay: rt.ok
        ? { configured: true, mode: rt.config.mode, webhookSecret: Boolean(rt.config.webhookSecret) }
        : { configured: false, missing: rt.missing },
    };
    console.info("[admin] finance report", { admin: admin.uid, rows: report.table.total });
    return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[admin] finance report failed", error?.message);
    return NextResponse.json({ error: "Moliyaviy ma'lumotlarni yuklab bo'lmadi.", code: "server_error" }, { status: 500 });
  }
}
