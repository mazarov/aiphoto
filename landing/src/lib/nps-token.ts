import { createHmac, timingSafeEqual } from "node:crypto";
import { mailUnsubscribeSecret } from "@/lib/mail-unsubscribe";

const TOKEN_PREFIX = "v1";
const HMAC_PREFIX = "nps:v1";

export const NPS_SCORE_MIN = 1;
export const NPS_SCORE_MAX = 10;
export const NPS_COMMENT_MAX = 2000;
export const NPS_TRIGGERS = ["after_2", "credits_empty"] as const;

export type NpsTrigger = (typeof NPS_TRIGGERS)[number];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isNpsSurveyId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function isNpsTrigger(value: string): value is NpsTrigger {
  return (NPS_TRIGGERS as readonly string[]).includes(value);
}

export function parseNpsScore(raw: unknown): number | null {
  const value = typeof raw === "number" ? raw : Number(String(raw ?? "").trim());
  if (!Number.isInteger(value) || value < NPS_SCORE_MIN || value > NPS_SCORE_MAX) {
    return null;
  }
  return value;
}

export function parseNpsComment(raw: unknown): string | null {
  if (raw == null) return null;
  const text = String(raw).trim().slice(0, NPS_COMMENT_MAX);
  return text || null;
}

export function signNpsToken(surveyId: string, secret = mailUnsubscribeSecret()): string {
  const id = String(surveyId || "").trim().toLowerCase();
  if (!isNpsSurveyId(id) || !secret) return "";
  const digest = createHmac("sha256", secret).update(`${HMAC_PREFIX}:${id}`).digest("base64url");
  return `${TOKEN_PREFIX}.${Buffer.from(id, "utf8").toString("base64url")}.${digest}`;
}

export function verifyNpsToken(
  token: string | null | undefined,
  secret = mailUnsubscribeSecret(),
): string | null {
  const raw = String(token || "").trim();
  if (!raw || !secret) return null;
  const parts = raw.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) return null;
  let surveyId: string;
  try {
    surveyId = Buffer.from(parts[1], "base64url").toString("utf8").trim().toLowerCase();
  } catch {
    return null;
  }
  if (!isNpsSurveyId(surveyId)) return null;
  const expected = signNpsToken(surveyId, secret);
  if (!expected) return null;
  const left = Buffer.from(raw);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  return surveyId;
}

export function npsOcenkaUrl(
  surveyId: string,
  score?: number,
  origin = process.env.NEXT_PUBLIC_SITE_URL || "https://promptshot.ru",
): string {
  const base = origin.replace(/\/+$/, "");
  const token = signNpsToken(surveyId);
  const params = new URLSearchParams();
  if (token) params.set("t", token);
  if (score != null) params.set("s", String(score));
  const query = params.toString();
  return query ? `${base}/ocenka?${query}` : `${base}/ocenka`;
}

export function npsScoreLines(
  surveyId: string | null | undefined,
  origin = process.env.NEXT_PUBLIC_SITE_URL || "https://promptshot.ru",
): string[] {
  const id = String(surveyId || "").trim();
  return Array.from({ length: NPS_SCORE_MAX }, (_, index) => {
    const score = index + 1;
    return `${score} — ${npsOcenkaUrl(id, score, origin)}`;
  });
}
