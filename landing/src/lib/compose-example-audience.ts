import { findTagBySlug } from "./tag-registry";

export const COMPOSE_EXAMPLE_MATCH_CONFIG_KEY =
  "compose_example_match_enabled";
export const COMPOSE_EXAMPLE_MATCH_IP_DAILY_LIMIT_KEY =
  "compose_example_match_ip_daily_limit";
export const COMPOSE_EXAMPLE_MATCH_GLOBAL_DAILY_LIMIT_KEY =
  "compose_example_match_global_daily_limit";

export const COMPOSE_EXAMPLE_CHILD_AUDIENCE_TAGS = [
  "malchik",
  "devochka",
  "malysh",
] as const;

export const COMPOSE_EXAMPLE_AUDIENCE_TAGS = [
  "devushka",
  "muzhchina",
  "para",
  "semya",
  ...COMPOSE_EXAMPLE_CHILD_AUDIENCE_TAGS,
] as const;

export type ComposeExampleAudienceTag =
  (typeof COMPOSE_EXAMPLE_AUDIENCE_TAGS)[number];

export const COMPOSE_EXAMPLE_AUDIENCE_CONFIDENCE_MIN = 0.7;
export const COMPOSE_EXAMPLE_MATCH_IP_DAILY_LIMIT_DEFAULT = 40;
export const COMPOSE_EXAMPLE_MATCH_GLOBAL_DAILY_LIMIT_DEFAULT = 4000;
export const COMPOSE_EXAMPLE_MATCH_USER_DAILY_LIMIT_DEFAULT = 80;
export const COMPOSE_EXAMPLE_MATCH_CHIP_DISMISS_LABEL = "Показать все примеры";

const AUDIENCE_TAG_SET = new Set<string>(COMPOSE_EXAMPLE_AUDIENCE_TAGS);
const CHILD_TAG_SET = new Set<string>(COMPOSE_EXAMPLE_CHILD_AUDIENCE_TAGS);

function mapSoloChildAudience(
  audience: string,
): ComposeExampleAudienceTag | null {
  if (audience === "malchik" || audience === "devochka" || audience === "malysh") {
    return audience;
  }
  if (audience === "devushka") return "devochka";
  if (audience === "muzhchina") return "malchik";
  return "malysh";
}

export function isComposeExampleAudienceTag(
  value: unknown,
): value is ComposeExampleAudienceTag {
  return typeof value === "string" && AUDIENCE_TAG_SET.has(value);
}

export type ComposeAudienceClassificationInput = {
  audience?: unknown;
  peopleCount?: unknown;
  hasVisibleFace?: unknown;
  hasChild?: unknown;
  confidence?: unknown;
};

function asFiniteNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  return null;
}

/**
 * Narrow catalog audience from a vision JSON. Solo child maps to
 * malchik / devochka / malysh — not adult gender and not unfiltered newest.
 */
export function mapComposeAudienceClassification(
  input: ComposeAudienceClassificationInput,
): ComposeExampleAudienceTag | null {
  const confidence = asFiniteNumber(input.confidence);
  if (confidence == null || confidence < COMPOSE_EXAMPLE_AUDIENCE_CONFIDENCE_MIN) {
    return null;
  }
  const hasFace = asBoolean(input.hasVisibleFace);
  if (hasFace === false) return null;
  const peopleCount = asFiniteNumber(input.peopleCount);
  if (peopleCount == null || peopleCount < 1) return null;
  const hasChild = asBoolean(input.hasChild) === true;
  const audience =
    typeof input.audience === "string" ? input.audience.trim() : "";

  if (peopleCount === 1) {
    if (hasChild || CHILD_TAG_SET.has(audience)) {
      return mapSoloChildAudience(audience);
    }
    if (audience === "devushka" || audience === "muzhchina") return audience;
    return null;
  }

  if (audience === "para") return "para";
  if (audience === "semya" || hasChild) return "semya";
  return null;
}

export function composeExamplePickerListingAudience(input: {
  query: string;
  dismissed: boolean;
  audienceMatch: string | null | undefined;
}): ComposeExampleAudienceTag | null {
  if (input.dismissed) return null;
  if (input.query.trim().length >= 2) return null;
  return isComposeExampleAudienceTag(input.audienceMatch)
    ? input.audienceMatch
    : null;
}

export function parseComposeExampleMatchDailyLimit(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, 100_000);
}

export function composeExampleAudienceChipLabel(
  tag: ComposeExampleAudienceTag,
): string {
  return findTagBySlug("audience_tag", tag)?.labelRu ?? tag;
}
