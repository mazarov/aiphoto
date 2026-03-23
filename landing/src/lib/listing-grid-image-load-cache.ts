/**
 * In-memory (per browser tab) cache: promo image URL was successfully decoded at least once.
 * Survives PromptCard/GroupedCard remounts (e.g. InfiniteGrid key change) so we don't
 * flash opacity-0 + skeleton again on scroll-back.
 */
const MAX_URLS = 6000;
const urls: string[] = [];
const set = new Set<string>();

export function rememberListingGridImageUrl(url: string): void {
  if (!url || set.has(url)) return;
  set.add(url);
  urls.push(url);
  while (urls.length > MAX_URLS) {
    const old = urls.shift();
    if (old) set.delete(old);
  }
}

export function hasListingGridImageLoaded(url: string | null): boolean {
  return Boolean(url && set.has(url));
}
