export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function addDays(date: Date, days: number): string {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy.toISOString();
}

export function normalizePhone(input?: string | null): string | null {
  if (!input) return null;
  const digits = input.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}

export function firstPresent(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (value && value.trim()) return value.trim();
  }
  return null;
}

export function isFulfilled(status?: string | null): boolean {
  if (!status) return false;
  const normalized = status.toLowerCase();
  return normalized === "fulfilled" || normalized === "shipped";
}

export function isCancelled(cancelledAt?: string | null): boolean {
  return Boolean(cancelledAt && cancelledAt.trim());
}

export function asOrderId(value: string | number): string {
  return String(value);
}
