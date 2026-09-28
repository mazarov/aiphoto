import { stripCardTitlePrefix } from "./card-meta-title";

export const GENERACIYA_SEO_ALT_MIN = 60;
export const GENERACIYA_SEO_ALT_MAX = 125;

const PROMPT_PREFIX = /^промт для фото:\s*/i;

export function cleanGeneraciyaCardTitle(title: string): string {
  return stripCardTitlePrefix(title).replace(PROMPT_PREFIX, "").replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function stripGeneraciyaPageHeadings(
  text: string,
  headings: readonly string[],
): string {
  let out = text;
  const sorted = [...headings]
    .map((heading) => heading.trim())
    .filter((heading) => heading.length >= 3)
    .sort((a, b) => b.length - a.length);
  for (const heading of sorted) {
    out = out.replace(new RegExp(escapeRegExp(heading), "ig"), " ");
  }
  return out.replace(/\s+/g, " ").trim();
}

/** Stored alt is used only when it already fits. Short titles are not padded. */
export function acceptStoredSeoAlt(
  raw: string | null | undefined,
  headings: readonly string[],
): string | null {
  const text = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (text.length < GENERACIYA_SEO_ALT_MIN || text.length > GENERACIYA_SEO_ALT_MAX) {
    return null;
  }
  if (stripGeneraciyaPageHeadings(text, headings) !== text) return null;
  if (PROMPT_PREFIX.test(text)) return null;
  return text;
}

export function resolveGeneraciyaFrameAlt(input: {
  stored?: string | null;
  title: string;
  headings: readonly string[];
}): string {
  const stored = acceptStoredSeoAlt(input.stored, input.headings);
  if (stored) return stored;
  return stripGeneraciyaPageHeadings(
    cleanGeneraciyaCardTitle(input.title),
    input.headings,
  );
}

export function buildGeneraciyaPhotoshootAlts(
  frames: readonly { stored?: string | null }[],
  title: string,
  headings: readonly string[],
): string[] {
  const stored = frames.map((frame) => acceptStoredSeoAlt(frame.stored, headings));
  const filled = stored.filter((alt): alt is string => Boolean(alt));
  if (
    stored.length > 1 &&
    stored.every((alt) => Boolean(alt)) &&
    new Set(filled).size === filled.length
  ) {
    return stored as string[];
  }
  const representative = resolveGeneraciyaFrameAlt({
    stored: frames[0]?.stored,
    title,
    headings,
  });
  return frames.map((_, index) => (index === 0 ? representative : ""));
}

export function generaciyaPromptLinkLabel(title: string): string {
  const clean = cleanGeneraciyaCardTitle(title);
  return `Открыть промт «${clean || "промт"}»`;
}

/** Marquee duplicate stays empty. Live tiles use the frame alt when the flag is on. */
export function generaciyaLiveTileAlt(input: {
  decorative: boolean;
  frameAlts: readonly string[] | null | undefined;
  fallback: string;
}): string {
  if (input.decorative) return "";
  if (input.frameAlts) return input.frameAlts[0] ?? "";
  return input.fallback;
}
