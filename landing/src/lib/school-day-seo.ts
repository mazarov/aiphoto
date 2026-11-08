import { GENERACIYA_SEO_POOL_LIMIT } from "./generaciya-seo-fetch";
import {
  applyGeneraciyaFirstScreenRank,
  attachGeneraciyaSeoFrames,
  GENERACIYA_SEO_GALLERY_LIMIT,
  generaciyaRepresentativeAlt,
  generaciyaSeoRepresentativeImage,
  type GeneraciyaSeoCardSlice,
} from "./generaciya-seo-examples";
import {
  generaciyaSeoImageMode,
  type GeneraciyaSeoImageFlags,
} from "./generaciya-seo-image-flags";
import {
  toGenerationExampleCard,
  type GenerationExampleCard,
} from "./generation/example-card";
import {
  isSchoolDaySeoImagePath,
  schoolDayHubHeroFetchParams,
  toSchoolDayHeroCarouselCards,
} from "./school-day-hubs";
import type { PromptCardFull } from "./supabase";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://promptshot.ru";

type SchoolDayQuery = {
  audience?: string;
  style?: string;
  occasion?: string;
  object?: string;
  sort?: string;
} | null | undefined;

/** Clean hub URL only. Filters and an explicit sort stay on the catalog image path. */
export function schoolDaySeoApplies(pathname: string, search: SchoolDayQuery): boolean {
  if (!isSchoolDaySeoImagePath(pathname)) return false;
  if (!search) return true;
  return !search.audience && !search.style && !search.occasion && !search.object && !search.sort;
}

export function schoolDaySeoHeadings(seo: {
  h1: string;
  explorerTitle?: string;
}): string[] {
  return [seo.h1, seo.explorerTitle ?? ""].map((slot) => slot.trim()).filter(Boolean);
}

/** Rank off: the existing 16 newest. Rank on: a popular pool the ranker can thin. */
export function schoolDaySeoHeroFetchParams(slug: string, rank: boolean) {
  const params = schoolDayHubHeroFetchParams(slug)({
    audience_tag: null,
    style_tag: null,
    occasion_tag: null,
    object_tag: null,
    doc_task_tag: null,
  });
  if (!rank) return params;
  return {
    ...params,
    limit: GENERACIYA_SEO_POOL_LIMIT,
    sort: "popular" as const,
  };
}

export function rankSchoolDayHeroCards(
  cards: readonly PromptCardFull[],
  rank: boolean,
): PromptCardFull[] {
  return applyGeneraciyaFirstScreenRank(cards, rank);
}

function stackActive(flags: GeneraciyaSeoImageFlags): boolean {
  return generaciyaSeoImageMode(flags) !== "current" || flags.descriptiveAlt;
}

/**
 * Hero live tiles come first in the HTML, then the listing fills the rest of
 * the 16-frame cap. Load-more pages stay on the catalog preset.
 */
export function presentSchoolDaySeoCards(input: {
  heroCards: readonly PromptCardFull[];
  listingCards: readonly PromptCardFull[];
  flags: GeneraciyaSeoImageFlags;
  headings: readonly string[];
  siteUrl?: string;
}): {
  heroExamples: GenerationExampleCard[];
  listingCards: PromptCardFull[];
  ogImage: string | null;
  imageCaption: string | null;
} {
  const heroExamples = toSchoolDayHeroCarouselCards(
    input.heroCards.map(toGenerationExampleCard),
  );
  if (!stackActive(input.flags)) {
    return {
      heroExamples,
      listingCards: input.listingCards as PromptCardFull[],
      ogImage: null,
      imageCaption: null,
    };
  }

  const heroFramed = toSchoolDayHeroCarouselCards(
    attachGeneraciyaSeoFrames(
      input.heroCards,
      input.heroCards.map(toGenerationExampleCard),
      input.flags,
      input.headings,
    ),
  );
  const frameById = new Map<string, GenerationExampleCard["seoFrame"]>();
  for (const card of heroFramed) {
    if (card.seoFrame) frameById.set(card.id, card.seoFrame);
  }

  let room = GENERACIYA_SEO_GALLERY_LIMIT - frameById.size;
  const extras: PromptCardFull[] = [];
  for (const card of input.listingCards) {
    if (room <= 0) break;
    if (frameById.has(card.id)) continue;
    if (!card.photoMeta[0] && !card.photoUrls[0]) continue;
    extras.push(card);
    room -= 1;
  }
  const extraFramed = attachGeneraciyaSeoFrames(
    extras,
    extras.map(toGenerationExampleCard),
    input.flags,
    input.headings,
  );
  for (const card of extraFramed) {
    if (card.seoFrame) frameById.set(card.id, card.seoFrame);
  }

  const listingCards = input.listingCards.map((card) => {
    const seoFrame = frameById.get(card.id);
    if (!seoFrame) return card;
    return { ...card, seoFrame };
  });

  const lead =
    input.heroCards.find((card) => card.id === heroFramed[0]?.id) ??
    input.listingCards.find((card) => card.photoMeta[0]);
  const mode = generaciyaSeoImageMode(input.flags);
  const ogImage =
    mode === "current" || !lead?.photoMeta[0]
      ? null
      : generaciyaSeoRepresentativeImage(
          lead as GeneraciyaSeoCardSlice,
          input.flags,
          input.siteUrl ?? SITE_URL,
        );
  const imageCaption = generaciyaRepresentativeAlt(
    lead as GeneraciyaSeoCardSlice | undefined,
    heroFramed[0]?.title,
    input.flags,
    input.headings,
  );

  return { heroExamples: heroFramed, listingCards, ogImage, imageCaption };
}
