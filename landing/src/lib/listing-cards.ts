/**
 * Listing card identity: `id` is unique across ranked pages + sibling expansion.
 * `expandCardGroups` can pull a sibling that later appears as a ranked row —
 * appends must keep the first occurrence so React keys and swipe order stay stable.
 */

export type ListingCardIdentity = {
  id: string;
  sourceGroupKey: string | null;
  cardSplitTotal: number;
};

export type ListingGridItem<T extends ListingCardIdentity> =
  | { type: "single"; card: T }
  | { type: "group"; key: string; cards: T[] };

function isSplitGroupCard<T extends ListingCardIdentity>(card: T): boolean {
  return Boolean(card.sourceGroupKey && card.cardSplitTotal > 1);
}

/** Keep first occurrence of each `id`. Used when concatenating listing pages. */
export function appendUniqueCardsById<T extends { id: string }>(
  prev: readonly T[],
  incoming: readonly T[]
): T[] {
  const seen = new Set(prev.map((card) => card.id));
  const extra: T[] = [];
  for (const card of incoming) {
    if (seen.has(card.id)) continue;
    seen.add(card.id);
    extra.push(card);
  }
  if (extra.length === 0) return prev as T[];
  if (prev.length === 0) return extra;
  return [...prev, ...extra];
}

/**
 * Append an infinite-scroll batch without merging it into earlier masonry DOM.
 * CSS columns rebalance every child when one container grows; preserving page
 * boundaries keeps already-visible cards in their original positions.
 */
export function appendUniqueCardPage<T extends { id: string }>(
  pages: readonly (readonly T[])[],
  incoming: readonly T[]
): T[][] {
  const seen = new Set(pages.flatMap((page) => page.map((card) => card.id)));
  const page: T[] = [];
  for (const card of incoming) {
    if (seen.has(card.id)) continue;
    seen.add(card.id);
    page.push(card);
  }
  if (page.length === 0) return pages as T[][];
  return [...pages.map((existing) => existing as T[]), page];
}

/**
 * Optional grouped DOM order: split siblings collapse into one group cell;
 * leftover / duplicate ids are skipped so React keys stay unique.
 * Public listings no longer group — they render one masonry tile per card id.
 */
export function buildListingGridItems<T extends ListingCardIdentity>(
  cards: readonly T[]
): ListingGridItem<T>[] {
  const groupMap = new Map<string, T[]>();
  for (const card of cards) {
    if (!isSplitGroupCard(card) || !card.sourceGroupKey) continue;
    const arr = groupMap.get(card.sourceGroupKey) || [];
    if (!arr.some((existing) => existing.id === card.id)) arr.push(card);
    groupMap.set(card.sourceGroupKey, arr);
  }

  const items: ListingGridItem<T>[] = [];
  const seenGroups = new Set<string>();
  const seenCardIds = new Set<string>();

  for (const card of cards) {
    if (isSplitGroupCard(card) && card.sourceGroupKey) {
      if (seenGroups.has(card.sourceGroupKey)) continue;
      seenGroups.add(card.sourceGroupKey);
      const group = groupMap.get(card.sourceGroupKey) || [];
      for (const member of group) seenCardIds.add(member.id);
      items.push({ type: "group", key: card.sourceGroupKey, cards: group });
      continue;
    }
    if (seenCardIds.has(card.id)) continue;
    seenCardIds.add(card.id);
    items.push({ type: "single", card });
  }

  return items;
}
