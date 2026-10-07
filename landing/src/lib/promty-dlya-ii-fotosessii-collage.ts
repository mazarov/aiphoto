import { PHOTOSHOOT_FRAME_COUNT } from "./photoshoot";

export const FOTOSESSII_THEME_COLLAGE_LIMIT = 6;

/**
 * A scenario card in the hub collage needs at least one full album (4 frames).
 * Scenarios below this stay reachable as chips in the examples navigation,
 * but the hub never renders an empty gradient tile.
 */
export const FOTOSESSII_THEME_COLLAGE_MIN_PHOTOS = PHOTOSHOOT_FRAME_COUNT;

/**
 * Collage frames for one scenario: walk albums newest-first and take every
 * frame, so two albums already fill six cells. Lead frame per album comes
 * first so a one-album scenario still shows four distinct looks.
 */
export function collectFotosessiiCollagePhotos(
  cards: readonly { photoUrls: readonly string[] }[],
  limit: number = FOTOSESSII_THEME_COLLAGE_LIMIT
): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  const maxFrames = Math.max(0, ...cards.map((card) => card.photoUrls.length));
  for (let frame = 0; frame < maxFrames && urls.length < limit; frame += 1) {
    for (const card of cards) {
      const url = card.photoUrls[frame];
      if (!url || seen.has(url)) continue;
      seen.add(url);
      urls.push(url);
      if (urls.length >= limit) break;
    }
  }
  // One full album (4 frames) still leaves two cells. Cycle frames instead
  // of rendering gradient placeholders; a scenario below the minimum is
  // filtered out by filterFotosessiiCollageItems before this matters.
  if (urls.length >= FOTOSESSII_THEME_COLLAGE_MIN_PHOTOS) {
    for (let i = 1; urls.length < limit; i += 1) {
      urls.push(urls[i % FOTOSESSII_THEME_COLLAGE_MIN_PHOTOS]);
    }
  }
  return urls;
}

export function filterFotosessiiCollageItems<T extends { href: string }>(
  items: readonly T[],
  photosByHref: Record<string, string[]>,
  minPhotos: number = FOTOSESSII_THEME_COLLAGE_MIN_PHOTOS
): T[] {
  return items.filter(
    (item) => (photosByHref[item.href]?.length ?? 0) >= minPhotos
  );
}
