import { LISTING_INFINITE_PAGE_SIZE } from "./listing-pagination";

export const GENERACIYA_SEO_POOL_LIMIT = 64;
export const GENERACIYA_SEO_KARTINKA_PER_TAG = 8;
export const GENERACIYA_SEO_UNRANKED_LIMIT = 24;
export const GENERACIYA_SEO_UNRANKED_PER_TAG = 6;

export function generaciyaNewestFetchParams(rank: boolean): {
  audience_tag: null;
  style_tag: null;
  occasion_tag: null;
  object_tag: null;
  doc_task_tag: null;
  limit: number;
  offset: number;
  min_cards: number;
  sort: "popular" | "new";
} {
  return {
    audience_tag: null,
    style_tag: null,
    occasion_tag: null,
    object_tag: null,
    doc_task_tag: null,
    limit: rank ? GENERACIYA_SEO_POOL_LIMIT : GENERACIYA_SEO_UNRANKED_LIMIT,
    offset: 0,
    min_cards: 1,
    sort: rank ? "popular" : "new",
  };
}

export function generaciyaKartinkaPerTag(rank: boolean): number {
  return rank ? GENERACIYA_SEO_KARTINKA_PER_TAG : GENERACIYA_SEO_UNRANKED_PER_TAG;
}

export function generaciyaScenarioFetchParams(
  route: { dimension: string; tagValue: string },
  rank: boolean,
): {
  audience_tag: string | null;
  style_tag: string | null;
  occasion_tag: string | null;
  object_tag: string | null;
  doc_task_tag: string | null;
  limit: number;
  offset: number;
  min_cards: number;
  sort: "popular" | "new";
} {
  const params = {
    audience_tag: null as string | null,
    style_tag: null as string | null,
    occasion_tag: null as string | null,
    object_tag: null as string | null,
    doc_task_tag: null as string | null,
    limit: rank ? GENERACIYA_SEO_POOL_LIMIT : GENERACIYA_SEO_UNRANKED_LIMIT,
    offset: 0,
    min_cards: 1,
    sort: (rank ? "popular" : "new") as "popular" | "new",
  };
  if (
    route.dimension === "audience_tag" ||
    route.dimension === "style_tag" ||
    route.dimension === "occasion_tag" ||
    route.dimension === "object_tag" ||
    route.dimension === "doc_task_tag"
  ) {
    params[route.dimension] = route.tagValue;
  }
  return params;
}

/**
 * One page of `sort=popular`. The next `/api/listing` call continues at
 * `offset = limit`, so the hero and the examples block stay one sequence.
 */
export function generaciyaPopularPageParams(route?: {
  dimension: string;
  tagValue: string;
} | null): ReturnType<typeof generaciyaScenarioFetchParams> {
  return {
    ...generaciyaScenarioFetchParams(
      route ?? { dimension: "", tagValue: "" },
      false,
    ),
    limit: LISTING_INFINITE_PAGE_SIZE,
    sort: "popular",
  };
}

/** Round-robin so one style tag cannot occupy the whole first screen. */
export function interleaveGeneraciyaColumns<T extends { id: string }>(
  columns: readonly (readonly T[])[],
  perColumn: number,
): T[] {
  const seen = new Set<string>();
  const cards: T[] = [];
  for (let index = 0; index < perColumn; index += 1) {
    for (const column of columns) {
      const card = column[index];
      if (!card || seen.has(card.id)) continue;
      seen.add(card.id);
      cards.push(card);
    }
  }
  return cards;
}
