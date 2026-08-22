import { createHmac, timingSafeEqual } from "node:crypto";
import { normalizeMailEmail } from "@/lib/mail-email";

const TOKEN_PREFIX = "v1";

export function mailUnsubscribeSecret(): string {
  return (process.env.MAIL_UNSUBSCRIBE_SECRET || "").trim();
}

export function signMailUnsubscribeToken(email: string, secret = mailUnsubscribeSecret()): string {
  const normalized = normalizeMailEmail(email);
  if (!normalized || !secret) return "";
  const digest = createHmac("sha256", secret).update(`${TOKEN_PREFIX}:${normalized}`).digest("base64url");
  return `${TOKEN_PREFIX}.${Buffer.from(normalized, "utf8").toString("base64url")}.${digest}`;
}

export function verifyMailUnsubscribeToken(
  token: string | null | undefined,
  secret = mailUnsubscribeSecret(),
): string | null {
  const raw = String(token || "").trim();
  if (!raw || !secret) return null;
  const parts = raw.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) return null;
  let email: string;
  try {
    email = Buffer.from(parts[1], "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expected = signMailUnsubscribeToken(email, secret);
  if (!expected) return null;
  const left = Buffer.from(raw);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  return normalizeMailEmail(email);
}

export function mailUnsubscribeUrl(email: string, origin = process.env.NEXT_PUBLIC_SITE_URL || "https://promptshot.ru"): string {
  const token = signMailUnsubscribeToken(email);
  const base = origin.replace(/\/+$/, "");
  if (!token) return `${base}/unsubscribe`;
  return `${base}/unsubscribe?t=${encodeURIComponent(token)}`;
}

export function mailOneClickUnsubscribeUrl(
  email: string,
  origin = process.env.NEXT_PUBLIC_SITE_URL || "https://promptshot.ru",
): string {
  const token = signMailUnsubscribeToken(email);
  const base = origin.replace(/\/+$/, "");
  if (!token) return "";
  return `${base}/api/mail/unsubscribe?t=${encodeURIComponent(token)}`;
}
