import { cache } from "react";
import {
  fetchRouteCards,
  getCardPhotosBySlugs,
  type RouteCardsResult,
} from "./supabase";
import { findPromtyDlyaIiFotosessiiChild } from "./promty-dlya-ii-fotosessii-cluster";
import { PROMTY_DLYA_II_FOTOSESSII_THEME_ITEMS } from "./promty-dlya-ii-fotosessii-seo-copy";

export const FOTOSESSII_BASE_RPC_PARAMS: Record<string, string | null> = {
  audience_tag: null,
  style_tag: null,
  occasion_tag: null,
  object_tag: null,
  doc_task_tag: null,
};

export const FOTOSESSII_EMPTY_ROUTE_RESULT: RouteCardsResult = {
  cards: [],
  tier_used: "error",
  cards_count: 0,
  total_count: 0,
  has_minimum: false,
  dimension_count: 0,
};

export type FotosessiiThemeCollagePayload = {
  photosByHref: Record<string, string[]>;
  countByHref: Record<string, number>;
};

export const getFotosessiiThemeCollagePhotos = cache(
  async (): Promise<FotosessiiThemeCollagePayload> => {
    const empty: FotosessiiThemeCollagePayload = {
      photosByHref: {},
      countByHref: {},
    };
    try {
      const results = await Promise.all(
        PROMTY_DLYA_II_FOTOSESSII_THEME_ITEMS.map((item) =>
          fetchRouteCards({
            ...FOTOSESSII_BASE_RPC_PARAMS,
            [item.dimension]: item.tagValue,
            limit: 10,
            offset: 0,
            min_cards: 1,
            sort: "new",
          }).catch((error) => {
            console.error(
              `[FotosessiiCluster] fetch theme ${item.tagValue} failed`,
              error
            );
            return FOTOSESSII_EMPTY_ROUTE_RESULT;
          })
        )
      );
      const photos = await getCardPhotosBySlugs(
        results.flatMap((result) => result.cards.map((card) => card.slug))
      );
      const photosByHref: Record<string, string[]> = {};
      const countByHref: Record<string, number> = {};

      for (const [index, item] of PROMTY_DLYA_II_FOTOSESSII_THEME_ITEMS.entries()) {
        const urls: string[] = [];
        for (const card of results[index].cards) {
          const url = photos.get(card.slug)?.photoUrl;
          if (!url || urls.includes(url)) continue;
          urls.push(url);
          if (urls.length >= 6) break;
        }
        photosByHref[item.href] = urls;
        countByHref[item.href] =
          results[index].total_count || results[index].cards_count || 0;
      }

      return { photosByHref, countByHref };
    } catch (error) {
      console.error("[FotosessiiCluster] fetch theme photos failed", error);
      return empty;
    }
  }
);

export const getFotosessiiHubCards = cache(
  async (): Promise<RouteCardsResult> => {
    try {
      return await fetchRouteCards({
        ...FOTOSESSII_BASE_RPC_PARAMS,
        limit: 50,
        offset: 0,
        min_cards: 1,
        sort: "new",
      });
    } catch (error) {
      console.error("[FotosessiiHub] fetch examples failed", error);
      return FOTOSESSII_EMPTY_ROUTE_RESULT;
    }
  }
);

export const getFotosessiiChildCards = cache(
  async (slug: string): Promise<RouteCardsResult> => {
    const route = findPromtyDlyaIiFotosessiiChild(slug);
    if (!route) return FOTOSESSII_EMPTY_ROUTE_RESULT;

    try {
      return await fetchRouteCards({
        ...FOTOSESSII_BASE_RPC_PARAMS,
        [route.dimension]: route.tagValue,
        limit: 50,
        offset: 0,
        min_cards: 1,
        sort: "new",
      });
    } catch (error) {
      console.error(`[FotosessiiChild] fetch examples failed: ${slug}`, error);
      return FOTOSESSII_EMPTY_ROUTE_RESULT;
    }
  }
);
