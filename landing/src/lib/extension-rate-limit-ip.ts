import { createHash } from "node:crypto";

export function extensionRateLimitParsedIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || headers.get("x-real-ip")?.trim() || "unknown";
}

export function extensionRateLimitIpHash(ip: string, now = new Date()): string {
  const day = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(
    now.getUTCDate(),
  ).padStart(2, "0")}`;
  return createHash("sha256").update(`${ip}:${day}`).digest("hex");
}

export function extensionRateLimitDayWindowStartIso(now = new Date()): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString();
}

export function extensionRateLimitEffectiveUsage(result: {
  count: number;
  pending: number;
}): number {
  return result.count + result.pending;
}
