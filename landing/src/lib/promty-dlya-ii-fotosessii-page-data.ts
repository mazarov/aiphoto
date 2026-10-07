import { cache } from "react";
import {
  fetchPublishedPhotoshootCardsBySeoTag,
  fetchPublishedPhotoshootListingCards,
} from "./photoshoot-listing";
import type { PromptCardFull } from "./supabase";
import { findPromtyDlyaIiFotosessiiChild } from "./promty-dlya-ii-fotosessii-cluster";
import {
  FOTOSESSII_THEME_COLLAGE_LIMIT,
  collectFotosessiiCollagePhotos,
} from "./promty-dlya-ii-fotosessii-collage";
import { PROMTY_DLYA_II_FOTOSESSII_THEME_ITEMS } from "./promty-dlya-ii-fotosessii-seo-copy";

const FOTOSESSII_LISTING_LIMIT = 200;
const FOTOSESSII_CHILD_LISTING_LIMIT = 16;

export type FotosessiiThemeCollagePayload = {
  photosByHref: Record<string, string[]>;
  countByHref: Record<string, number>;
};

export const getFotosessiiThemeCollagePhotos = cache(
  async (): Promise<FotosessiiThemeCollagePayload> => {
    const photosByHref: Record<string, string[]> = {};
    const countByHref: Record<string, number> = {};

    await Promise.all(
      PROMTY_DLYA_II_FOTOSESSII_THEME_ITEMS.map(async (item) => {
        try {
          const matchingCards = await fetchPublishedPhotoshootCardsBySeoTag(
            item.dimension,
            item.tagValue,
            FOTOSESSII_THEME_COLLAGE_LIMIT
          );
          photosByHref[item.href] = collectFotosessiiCollagePhotos(
            matchingCards,
            FOTOSESSII_THEME_COLLAGE_LIMIT
          );
          countByHref[item.href] = matchingCards.length;
        } catch (error) {
          console.error(
            "[FotosessiiCluster] fetch theme photos failed",
            item.href,
            error
          );
          photosByHref[item.href] = [];
          countByHref[item.href] = 0;
        }
      })
    );

    return { photosByHref, countByHref };
  }
);

export const getFotosessiiHubCards = cache(
  async (): Promise<PromptCardFull[]> => {
    try {
      return await fetchPublishedPhotoshootListingCards(
        FOTOSESSII_LISTING_LIMIT
      );
    } catch (error) {
      console.error("[FotosessiiHub] fetch examples failed", error);
      return [];
    }
  }
);

export const getFotosessiiChildCards = cache(
  async (slug: string): Promise<PromptCardFull[]> => {
    const route = findPromtyDlyaIiFotosessiiChild(slug);
    if (!route) return [];
    try {
      return await fetchPublishedPhotoshootCardsBySeoTag(
        route.dimension,
        route.tagValue,
        FOTOSESSII_CHILD_LISTING_LIMIT
      );
    } catch (error) {
      console.error("[FotosessiiHub] fetch child examples failed", slug, error);
      return [];
    }
  }
);
