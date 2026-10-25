// Display helpers for the admin finance pages. All dates are shown in
// Asia/Tashkent, matching how the server buckets daily/monthly revenue.

const TZ = "Asia/Tashkent";

const numberFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const dateTimeFormat = new Intl.DateTimeFormat("ru-RU", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const MONTHS = ["Yan", "Fev", "Mar", "Apr", "May", "Iyn", "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek"];

/** 1250000 -> "1 250 000 so'm" (plain spaces, never NaN). */
export function formatUZS(amount) {
  const n = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  return `${numberFormat.format(n).replace(/\s/g, " ")} so'm`;
}

/** Compact axis label: 1250000 -> "1,3 mln", 45000 -> "45 ming". */
export function compactUZS(amount) {
  const n = Number(amount) || 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",").replace(",0", "")} mln`;
  if (n >= 1_000) return `${Math.round(n / 1_000)} ming`;
  return String(n);
}

export function formatDateTime(ms) {
  return ms ? dateTimeFormat.format(new Date(ms)) : "—";
}

/** "2026-10-25" -> "25.10" ; "2026-10" -> "Okt 2026" */
export function dayLabel(key) {
  return `${key.slice(8, 10)}.${key.slice(5, 7)}`;
}
export function monthLabel(key) {
  return `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
}

/** Today in Tashkent as YYYY-MM-DD (for date inputs). */
export function tashkentToday() {
  return new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export const STATUS_STYLES = {
  success: { label: "Muvaffaqiyatli", className: "bg-emerald-100 text-emerald-800" },
  pending: { label: "Kutilmoqda", className: "bg-amber-100 text-amber-800" },
  creating: { label: "Yaratilmoqda", className: "bg-amber-100 text-amber-800" },
  failed: { label: "Muvaffaqiyatsiz", className: "bg-red-100 text-red-800" },
  cancelled: { label: "Bekor qilingan", className: "bg-gray-200 text-gray-700" },
  expired: { label: "Muddati o'tgan", className: "bg-gray-200 text-gray-700" },
  rejected: { label: "Rad etilgan", className: "bg-red-100 text-red-800" },
  review: { label: "Tekshiruvda", className: "bg-orange-100 text-orange-800" },
  refunded: { label: "Qaytarilgan", className: "bg-purple-100 text-purple-800" },
};

export const PROVIDER_LABELS = { inpay: "inPAY", manual: "Karta o'tkazmasi" };
export const PLAN_LABELS = { pro: "Pro", max: "Max" };
export const PERIOD_LABELS = { monthly: "1 oy", yearly: "1 yil" };
