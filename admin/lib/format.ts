// Formatting is done by hand, not with Intl: the "uz" locale data differs
// between Node and browsers ("23-okt, 2026" vs "2026 M10 23"), which made the
// server and client render different text (hydration mismatch).

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "—";
  // at most 3 fraction digits, as Intl.NumberFormat did
  const [int, frac] = String(Math.round(value * 1000) / 1000).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return frac ? `${grouped},${frac}` : grouped;
}

export function formatUZS(value: number): string {
  return `${formatNumber(Math.round(value))} so'm`;
}

const MONTHS = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];
// Uzbekistan time (UTC+5, no daylight saving), so server and browser agree.
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

export function formatDate(value: number | null | undefined, withTime = false): string {
  if (!value) return "—";
  const d = new Date(value + TASHKENT_OFFSET_MS);
  if (Number.isNaN(d.getTime())) return "—";
  const date = `${d.getUTCDate()}-${MONTHS[d.getUTCMonth()]}, ${d.getUTCFullYear()}`;
  if (!withTime) return date;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function formatDateTime(value: number | null | undefined): string {
  return formatDate(value, true);
}

export function formatName(user: { firstName?: string; lastName?: string; email?: string }): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return name || user.email || "Noma'lum foydalanuvchi";
}

export function fullName(firstName?: string, lastName?: string): string {
  return [firstName, lastName].filter(Boolean).join(" ").trim();
}

export function initialsOf(user: { firstName?: string; lastName?: string; email?: string }): string {
  const first = user.firstName?.[0] ?? "";
  const last = user.lastName?.[0] ?? "";
  return (first + last).toUpperCase() || (user.email?.[0]?.toUpperCase() ?? "U");
}

export function toMillis(value: unknown): number | null {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (value && typeof (value as { toMillis?: () => number }).toMillis === "function") {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

export function clampRange(value: string | undefined, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}