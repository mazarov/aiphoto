/** One chip per listing URL — birthday aliases collapse several tags onto one href. */
export function uniqueListingChipsByHref<T extends { href: string }>(
  items: T[],
  prefer: (kept: T, next: T) => T = (kept) => kept
): T[] {
  const byHref = new Map<string, T>();
  for (const item of items) {
    const existing = byHref.get(item.href);
    byHref.set(item.href, existing ? prefer(existing, item) : item);
  }
  return [...byHref.values()];
}
