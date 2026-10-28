"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Card, CardHeader, Select } from "@/components/ui";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PLAN_AMOUNTS } from "@/lib/plan";
import { formatDate } from "@/lib/format";
import type { BillingPeriod, PlanId } from "@/lib/types";

type Pending = "plan" | "block" | "delete" | null;

async function send(url: string, init: RequestInit): Promise<void> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "Amal bajarilmadi.");
  }
}

/** Plan change, block/unblock and delete for one teacher (user detail page). */
export function UserActions({
  uid,
  name,
  plan,
  planExpiry,
  blocked,
}: {
  uid: string;
  name: string;
  plan: PlanId;
  planExpiry?: number | null;
  blocked: boolean;
}) {
  const router = useRouter();
  const [nextPlan, setNextPlan] = useState<PlanId>(plan === "free" ? "pro" : plan);
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      if (pending === "plan") {
        await send("/api/admin/subscriptions", {
          method: "POST",
          body: JSON.stringify({ uid, plan: nextPlan, billingPeriod: period }),
        });
        setNotice(`Tarif ${nextPlan.toUpperCase()} qilib o'rnatildi.`);
      } else if (pending === "block") {
        await send(`/api/admin/users/${encodeURIComponent(uid)}`, {
          method: "PATCH",
          body: JSON.stringify({ blocked: !blocked }),
        });
        setNotice(blocked ? "Foydalanuvchi blokdan chiqarildi." : "Foydalanuvchi bloklandi.");
      } else if (pending === "delete") {
        await send(`/api/admin/users/${encodeURIComponent(uid)}`, { method: "DELETE" });
        router.push("/dashboard/users");
        router.refresh();
        return;
      }
      setPending(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Amal bajarilmadi.");
      setPending(null);
    } finally {
      setBusy(false);
    }
  };

  const price = nextPlan === "free" ? "0 UZS" : `${PLAN_AMOUNTS[nextPlan][period]} UZS`;
  const dialog = {
    plan: {
      title: "Tarifni o'zgartirish",
      description: `${name} uchun tarif ${nextPlan.toUpperCase()}${nextPlan === "free" ? "" : ` (${period === "yearly" ? "yillik" : "oylik"})`} qilib o'rnatiladi. Muddat bugundan hisoblanadi.`,
      label: "Saqlash",
      danger: false,
    },
    block: blocked
      ? { title: "Blokdan chiqarish", description: `${name} yana tizimga kira oladi.`, label: "Blokdan chiqarish", danger: false }
      : {
          title: "Foydalanuvchini bloklash",
          description: `${name} tizimga kira olmaydi va ochiq sessiyalari yopiladi. Ma'lumotlari saqlanib qoladi, istalgan payt blokdan chiqarish mumkin.`,
          label: "Bloklash",
          danger: true,
        },
    delete: {
      title: "Foydalanuvchini o'chirish",
      description: `${name} hisobi, sinflari, o'quvchilari va BSB/ChSB natijalari butunlay o'chiriladi. Bu amalni qaytarib bo'lmaydi. To'lov yozuvlari hisobot uchun saqlanadi.`,
      label: "O'chirish",
      danger: true,
    },
  };
  const active = pending ? dialog[pending] : null;

  return (
    <Card>
      <CardHeader
        title="Boshqaruv"
        subtitle="Tarif, bloklash va o'chirish"
        action={blocked ? <Badge tone="red">Bloklangan</Badge> : <Badge tone="green">Faol hisob</Badge>}
      />
      <div className="space-y-4 p-5">
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}
        {notice && !error && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{notice}</p>
        )}

        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Tarif</h3>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
            Tarif
            <Select value={nextPlan} onChange={(e) => setNextPlan(e.target.value as PlanId)} className="mt-1 block w-32">
              <option value="free">Free</option>
              <option value="pro">Pro</option>
              <option value="max">Max</option>
            </Select>
          </label>
          {nextPlan !== "free" && (
            <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
              Davr
              <Select value={period} onChange={(e) => setPeriod(e.target.value as BillingPeriod)} className="mt-1 block w-32">
                <option value="monthly">Oylik</option>
                <option value="yearly">Yillik</option>
              </Select>
            </label>
          )}
          <button
            type="button"
            onClick={() => setPending("plan")}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Tarifni saqlash
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Narx: {price}
            {plan !== "free" && planExpiry ? ` · Hozirgi muddat: ${formatDate(planExpiry)}` : ""}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
          <h3 className="w-full text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Hisob</h3>
          <button
            type="button"
            onClick={() => setPending("block")}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
              blocked
                ? "border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950"
                : "border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950"
            }`}
          >
            {blocked ? "Blokdan chiqarish" : "Bloklash"}
          </button>
          <button
            type="button"
            onClick={() => setPending("delete")}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
          >
            O&apos;chirish
          </button>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Bloklash vaqtincha — ma&apos;lumotlar saqlanadi. O&apos;chirishni qaytarib bo&apos;lmaydi.
          </p>
        </div>
      </div>

      <ConfirmDialog
        key={pending ?? "closed"}
        open={active !== null}
        title={active?.title ?? ""}
        description={active?.description ?? ""}
        confirmLabel={active?.label}
        danger={active?.danger}
        busy={busy}
        onConfirm={run}
        onCancel={() => setPending(null)}
      />
    </Card>
  );
}
