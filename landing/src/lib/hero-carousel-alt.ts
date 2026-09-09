import { buildCardImageAlt, stripCardTitlePrefix } from "./card-meta-title";

const MAX_HOOK_LEN = 80;

function cleanSlots(slots: readonly string[]): string[] {
  return slots.map((slot) => slot.trim()).filter(Boolean);
}

function cardHook(cardTitle: string): string {
  const hook = stripCardTitlePrefix(cardTitle).replace(/\.{3,}$/, "").trim();
  if (hook.length <= MAX_HOOK_LEN) return hook;
  return hook.slice(0, MAX_HOOK_LEN).trim();
}

/** H1 then explorer H2 — HowTo / FAQ stay out of the carousel queue. */
export function headingAltSlotsFromSeo(seo: {
  h1: string;
  explorerTitle?: string;
}): string[] {
  return cleanSlots([seo.h1, seo.explorerTitle ?? ""]);
}

/**
 * Live marquee tile alt: rotate heading slots, then a short card hook.
 * Empty slots → listing card alt. Decorative copy is handled by the tile.
 */
export function buildHeroCarouselImageAlt(
  index: number,
  slots: readonly string[],
  cardTitle: string,
): string {
  const cleaned = cleanSlots(slots);
  if (cleaned.length === 0) return buildCardImageAlt(cardTitle);
  const slot = cleaned[((index % cleaned.length) + cleaned.length) % cleaned.length];
  const hook = cardHook(cardTitle);
  return hook ? `${slot}. ${hook}` : slot;
}
