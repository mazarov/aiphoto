import {
  fetchRouteCards,
  getCardPhotosBySlugs,
  pickDeduplicatedPhotos,
  type HomepageSectionItemWithUrls,
  type RouteCardsResult,
} from "@/lib/supabase";
import { TAG_REGISTRY, DIMENSION_LABELS, type Dimension } from "@/lib/tag-registry";
import { MENU } from "@/lib/menu";

export type SectionBlockItem = {
  label: string;
  href: string;
  data: {
    dimension: Dimension;
    slug: string;
    total_count: number;
    photoUrl: string | null;
    secondPhotoUrl: string | null;
  };
};

export type SectionBlock = {
  title: string;
  dimension: Dimension;
  items: SectionBlockItem[];
};

export const SECTION_ORDER: Dimension[] = [
  "audience_tag",
  "style_tag",
  "occasion_tag",
  "object_tag",
];

export type ThemeCollageItemInput = {
  href: string;
  dimension: Dimension;
  tagValue: string;
};

export type ThemeCollagePayload = {
  photosByHref: Record<string, string[]>;
  countByHref: Record<string, number>;
};

const EMPTY_ROUTE_RESULT: RouteCardsResult = {
  cards: [],
  tier_used: "error",
  cards_count: 0,
  total_count: 0,
  has_minimum: false,
  dimension_count: 0,
};

const THEME_COLLAGE_PHOTO_LIMIT = 6;

export function buildThemeCollageFromNewestResults(
  items: readonly ThemeCollageItemInput[],
  results: readonly RouteCardsResult[],
  photosBySlug: ReadonlyMap<string, { photoUrl: string | null }>
): ThemeCollagePayload {
  const photosByHref: Record<string, string[]> = {};
  const countByHref: Record<string, number> = {};

  for (const [index, item] of items.entries()) {
    const result = results[index] ?? EMPTY_ROUTE_RESULT;
    const urls: string[] = [];
    for (const card of result.cards) {
      const url = photosBySlug.get(card.slug)?.photoUrl;
      if (!url || urls.includes(url)) continue;
      urls.push(url);
      if (urls.length >= THEME_COLLAGE_PHOTO_LIMIT) break;
    }
    photosByHref[item.href] = urls;
    countByHref[item.href] = result.total_count || result.cards_count || 0;
  }

  return { photosByHref, countByHref };
}

export async function fetchNewestThemeCollagePhotos(
  items: readonly ThemeCollageItemInput[]
): Promise<ThemeCollagePayload> {
  const empty: ThemeCollagePayload = { photosByHref: {}, countByHref: {} };
  if (!items.length) return empty;

  try {
    const results = await Promise.all(
      items.map((item) =>
        fetchRouteCards({
          audience_tag: null,
          style_tag: null,
          occasion_tag: null,
          object_tag: null,
          doc_task_tag: null,
          [item.dimension]: item.tagValue,
          limit: 10,
          offset: 0,
          min_cards: 1,
          sort: "new",
        }).catch((error) => {
          console.error(
            `[theme-collage] fetch newest theme ${item.tagValue} failed`,
            error
          );
          return EMPTY_ROUTE_RESULT;
        })
      )
    );
    const photos = await getCardPhotosBySlugs(
      results.flatMap((result) => result.cards.map((card) => card.slug))
    );
    return buildThemeCollageFromNewestResults(items, results, photos);
  } catch (error) {
    console.error("[theme-collage] fetch newest theme photos failed", error);
    return empty;
  }
}

export function buildCategorySectionBlocks(
  sections: HomepageSectionItemWithUrls[]
): SectionBlock[] {
  const sectionsByDimSlug = new Map<string, HomepageSectionItemWithUrls>();
  for (const s of sections) {
    sectionsByDimSlug.set(`${s.dimension}:${s.slug}`, s);
  }

  const usedCardIds = new Set<string>();

  return SECTION_ORDER.map((dim) => {
    const menuSection = MENU.find((m) => m.dimension === dim);
    if (!menuSection) return null;

    const tagSlugs = menuSection.groups
      .flatMap((g) =>
        g.items.map((item) => {
          const tag = TAG_REGISTRY.find((t) => t.urlPath === item.href);
          return tag ?? null;
        })
      )
      .filter((t): t is NonNullable<typeof t> => t !== null);

    const items: SectionBlockItem[] = tagSlugs.map((tag) => {
      const raw = sectionsByDimSlug.get(`${dim}:${tag.slug}`);
      const { photoUrl, secondPhotoUrl, usedIds } = pickDeduplicatedPhotos(
        raw?.cards ?? [],
        usedCardIds
      );
      for (const id of usedIds) usedCardIds.add(id);

      return {
        label: tag.labelRu,
        href: tag.urlPath,
        data: {
          dimension: dim,
          slug: tag.slug,
          total_count: raw?.total_count ?? 0,
          photoUrl,
          secondPhotoUrl,
        },
      };
    });

    return {
      title: DIMENSION_LABELS[dim],
      dimension: dim,
      items,
    };
  }).filter((block): block is SectionBlock => block !== null);
}
