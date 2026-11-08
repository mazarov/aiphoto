/**
 * Hero example strip on generation hubs. 50 tiles × 2 copies was ~100 images
 * (and autoplaying mp4) in the first viewport. 12 stills loop cleanly.
 */
export const HERO_MARQUEE_MAX_CARDS = 12;

/** Tile CSS width: 7.25rem / 9.25rem. Do not use listing grid `sizes` (25–50vw). */
export const SIZES_HERO_MARQUEE = "(max-width: 639px) 116px, 148px";

export function takeHeroMarqueeCards<T>(cards: readonly T[]): T[] {
  return cards.slice(0, HERO_MARQUEE_MAX_CARDS);
}

/** globals.css loops 12 tiles in 110s; longer curated strips keep the same speed. */
const HERO_MARQUEE_BASE_SECONDS = 110;

export function heroMarqueeDurationSeconds(count: number): number {
  const tiles = Math.max(count, HERO_MARQUEE_MAX_CARDS);
  return Math.round((HERO_MARQUEE_BASE_SECONDS * tiles) / HERO_MARQUEE_MAX_CARDS);
}
