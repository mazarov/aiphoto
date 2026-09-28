export type GeneraciyaRankCandidate = {
  id: string;
  sourceGroupKey: string | null;
  cardSplitTotal: number;
  mediaPath: string | null;
  width: number | null;
  height: number | null;
};

export const GENERACIYA_FIRST_SCREEN_TARGET = 16;
export const GENERACIYA_FIRST_SCREEN_MIN = 12;

function hasSize(card: GeneraciyaRankCandidate): boolean {
  return (
    typeof card.width === "number" &&
    typeof card.height === "number" &&
    Number.isFinite(card.width) &&
    Number.isFinite(card.height) &&
    card.width > 0 &&
    card.height > 0
  );
}

/**
 * Order of `cards` is the only weight (popular RPC order, or the kartinka
 * interleave of per-style popular lists). Dedup is inside this pool.
 * Below 12 accepted cards, rejected rows fill the rest without repeating
 * an id or a media path.
 */
export function rankGeneraciyaFirstScreen<T>(
  cards: readonly T[],
  pick: (card: T) => GeneraciyaRankCandidate,
  limit = GENERACIYA_FIRST_SCREEN_TARGET,
): T[] {
  const accepted: T[] = [];
  const rejected: T[] = [];
  const seenIds = new Set<string>();
  const seenGroups = new Set<string>();
  const seenPaths = new Set<string>();

  for (const card of cards) {
    if (accepted.length >= limit) break;
    const meta = pick(card);
    const path = meta.mediaPath?.trim() || null;
    const duplicateGroup = Boolean(meta.sourceGroupKey && seenGroups.has(meta.sourceGroupKey));
    if (
      !meta.id ||
      seenIds.has(meta.id) ||
      !hasSize(meta) ||
      duplicateGroup ||
      (path !== null && seenPaths.has(path))
    ) {
      rejected.push(card);
      continue;
    }
    seenIds.add(meta.id);
    if (meta.sourceGroupKey) seenGroups.add(meta.sourceGroupKey);
    if (path) seenPaths.add(path);
    accepted.push(card);
  }

  if (accepted.length >= GENERACIYA_FIRST_SCREEN_MIN || accepted.length >= limit) {
    return accepted;
  }

  for (const card of rejected) {
    if (accepted.length >= limit) break;
    const meta = pick(card);
    const path = meta.mediaPath?.trim() || null;
    if (!meta.id || seenIds.has(meta.id)) continue;
    if (path && seenPaths.has(path)) continue;
    seenIds.add(meta.id);
    if (path) seenPaths.add(path);
    accepted.push(card);
  }

  return accepted;
}
