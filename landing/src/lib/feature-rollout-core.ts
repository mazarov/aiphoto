import { createHash } from "node:crypto";

export const PROMPT_CARD_GENERATION_FEATURE = "prompt_card_generation";
export const FEATURE_VISITOR_COOKIE = "promptshot_vid";
export const FEATURE_VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidFeatureVisitorId(value?: string | null): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function createFeatureVisitorId(): string {
  return crypto.randomUUID();
}

export function bucketFeatureSubject(featureKey: string, subjectId: string): number {
  const digest = createHash("sha256")
    .update(`${featureKey}:${subjectId}`)
    .digest();
  return digest.readUInt32BE(0) % 10_000;
}

export function isBucketEnabled(bucket: number, rolloutBps: number): boolean {
  return bucket >= 0 && bucket < Math.max(0, Math.min(10_000, rolloutBps));
}
