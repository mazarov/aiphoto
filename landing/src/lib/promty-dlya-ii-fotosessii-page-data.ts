import { cache } from "react";
import {
  fetchPublishedPhotoshootListingCards,
  filterPhotoshootListingCardsBySeoTag,
} from "./photoshoot-listing";
import type { PromptCardFull } from "./supabase";
import { findPromtyDlyaIiFotosessiiChild } from "./promty-dlya-ii-fotosessii-cluster";
import { PROMTY_DLYA_II_FOTOSESSII_THEME_ITEMS } from "./promty-dlya-ii-fotosessii-seo-copy";

const FOTOSESSII_LISTING_LIMIT = 200;

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
      const cards = await getFotosessiiHubCards();
      const photosByHref: Record<string, string[]> = {};
      const countByHref: Record<string, number> = {};

      for (const item of PROMTY_DLYA_II_FOTOSESSII_THEME_ITEMS) {
        const matchingCards = filterPhotoshootListingCardsBySeoTag(
          cards,
          item.dimension,
          item.tagValue
        );
        const urls: string[] = [];
        for (const card of matchingCards) {
          const url = card.photoUrls[0];
          if (!url || urls.includes(url)) continue;
          urls.push(url);
          if (urls.length >= 6) break;
        }
        photosByHref[item.href] = urls;
        countByHref[item.href] = matchingCards.length;
      }

      return { photosByHref, countByHref };
    } catch (error) {
      console.error("[FotosessiiCluster] fetch theme photos failed", error);
      return empty;
    }
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
    const cards = await getFotosessiiHubCards();
    return filterPhotoshootListingCardsBySeoTag(
      cards,
      route.dimension,
      route.tagValue
    );
  }
);
