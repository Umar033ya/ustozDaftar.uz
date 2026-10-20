const numberFormatter = new Intl.NumberFormat("uz-UZ");

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

export function formatUZS(value: number): string {
  return `${numberFormatter.format(Math.round(value))} so'm`;
}

export function formatDate(value: number | null | undefined, withTime = false): string {
  if (!value) return "—";
  const date = new Date(value);
  try {
    return new Intl.DateTimeFormat("uz-UZ", {
      year: "numeric",
      month: "short",
      day: "numeric",
      ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
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