import { cache } from "react";
import {
  createSupabaseServer,
  enrichCardsWithDetails,
  fetchRouteCards,
  getFirstCardPhotoUrl,
  type PromptCardFull,
  type RouteCardsResult,
} from "@/lib/supabase";
import { flattenGeneraciyaFotoFaqAnswer, type GeneraciyaFaqEntry } from "@/lib/generaciya-foto-seo-copy";
import {
  toGenerationExampleCard,
  withGenerationExampleFallbackTitle,
  type GenerationExampleCard,
} from "@/lib/generation/example-card";
import type { GeneraciyaSeoImageFlags } from "@/lib/generaciya-seo-image-flags";
import {
  applyGeneraciyaFirstScreenRank,
  attachGeneraciyaSeoFrames,
  GENERACIYA_SEO_GALLERY_LIMIT,
  generaciyaRepresentativeAlt,
  generaciyaSeoRepresentativeImage,
} from "@/lib/generaciya-seo-examples";
import {
  generaciyaKartinkaPerTag,
  generaciyaNewestFetchParams,
  generaciyaPopularPageParams,
  interleaveGeneraciyaColumns,
} from "@/lib/generaciya-seo-fetch";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://promptshot.ru";

export const GENERACIYA_BASE_RPC_PARAMS: Record<string, string | null> = {
  audience_tag: null,
  style_tag: null,
  occasion_tag: null,
  object_tag: null,
  doc_task_tag: null,
};

export const GENERACIYA_EMPTY_RESULT: RouteCardsResult = {
  cards: [],
  tier_used: "error",
  cards_count: 0,
  total_count: 0,
  has_minimum: false,
  dimension_count: 0,
};

/** One `sort=popular` page. Hero and the examples grid share this order. */
export const getGeneraciyaPopularPage = cache(
  async (
    route?: { dimension: string; tagValue: string } | null,
  ): Promise<RouteCardsResult> => {
    try {
      return await fetchRouteCards(generaciyaPopularPageParams(route));
    } catch (error) {
      console.error("[generaciya] fetch popular page failed", error);
      return GENERACIYA_EMPTY_RESULT;
    }
  },
);

/** Newest published cards — shared by the text and photo hubs. */
export const getGeneraciyaNewestExamples = cache(
  async (rank = false): Promise<RouteCardsResult> => {
    try {
      return await fetchRouteCards(generaciyaNewestFetchParams(rank));
    } catch (error) {
      console.error("[generaciya] fetch newest examples failed", error);
      return GENERACIYA_EMPTY_RESULT;
    }
  }
);

/**
 * `/kartinka-po-opisaniyu` examples: illustration / art styles only, so the
 * gallery is not the photoreal feed of the sibling hubs. One RPC per tag,
 * interleaved so no single style dominates the first screen.
 */
export const KARTINKA_EXAMPLE_STYLE_TAGS = [
  "anime",
  "3d",
  "piksar",
  "multyashnoe",
  "disney",
  "kollazh",
] as const;

export const getGeneraciyaKartinkaExamples = cache(
  async (rank = false): Promise<RouteCardsResult> => {
    const perTag = generaciyaKartinkaPerTag(rank);
    const sort = rank ? "popular" : "new";
    const results = await Promise.all(
      KARTINKA_EXAMPLE_STYLE_TAGS.map(async (styleTag) => {
        try {
          return await fetchRouteCards({
            ...GENERACIYA_BASE_RPC_PARAMS,
            style_tag: styleTag,
            limit: perTag,
            offset: 0,
            min_cards: 1,
            sort,
          });
        } catch (error) {
          console.error(`[generaciya] fetch kartinka examples failed: ${styleTag}`, error);
          return GENERACIYA_EMPTY_RESULT;
        }
      })
    );
    const cards = interleaveGeneraciyaColumns(
      results.map((result) => result.cards),
      perTag,
    );
    const total = results.reduce((sum, r) => sum + (r.total_count ?? r.cards_count), 0);
    return {
      cards,
      tier_used: cards.length ? "style_mix" : "error",
      cards_count: cards.length,
      total_count: total,
      has_minimum: cards.length >= 6,
      dimension_count: 1,
    };
  }
);

export const getGeneraciyaCompletedImageCount = cache(async (): Promise<number> => {
  try {
    const supabase = createSupabaseServer();
    const { count, error } = await supabase
      .from("landing_generations")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed")
      .eq("modality", "image");
    if (error) throw error;
    return count ?? 0;
  } catch (error) {
    console.error("[generaciya] fetch completed image generation count failed", error);
    return 0;
  }
});

export async function enrichGeneraciyaCards(
  result: RouteCardsResult,
  label: string
): Promise<PromptCardFull[]> {
  let enriched: PromptCardFull[] = [];
  try {
    enriched = await enrichCardsWithDetails(result.cards);
  } catch (error) {
    console.error(`[generaciya] enrich examples failed: ${label}`, error);
    return [];
  }
  const byId = new Map(enriched.map((card) => [card.id, card]));
  return result.cards
    .map((card) => byId.get(card.id))
    .filter((card): card is PromptCardFull => Boolean(card));
}

export async function prepareGeneraciyaSeoCards(input: {
  result: RouteCardsResult;
  label: string;
  flags: GeneraciyaSeoImageFlags;
  headings: readonly string[];
  fallbackTitle: (index: number) => string;
}): Promise<{
  cards: PromptCardFull[];
  exampleCards: GenerationExampleCard[];
  ogImage: string | null;
  imageCaption: string | null;
}> {
  const enriched = await enrichGeneraciyaCards(input.result, input.label);
  const ranked = applyGeneraciyaFirstScreenRank(enriched, input.flags.firstScreenRank);
  const cards = input.flags.firstScreenRank
    ? ranked.slice(0, GENERACIYA_SEO_GALLERY_LIMIT)
    : ranked;
  const titled = cards
    .map(toGenerationExampleCard)
    .map((card, index) =>
      withGenerationExampleFallbackTitle(card, input.fallbackTitle(index)),
    );
  const exampleCards = attachGeneraciyaSeoFrames(
    cards,
    titled,
    input.flags,
    input.headings,
  );
  let ogImage = generaciyaSeoRepresentativeImage(cards[0], input.flags, SITE_URL);
  if (!ogImage) {
    ogImage = await firstGeneraciyaOgImage(input.result, cards);
  }
  return {
    cards,
    exampleCards,
    ogImage,
    imageCaption: generaciyaRepresentativeAlt(
      cards[0],
      exampleCards[0]?.title,
      input.flags,
      input.headings,
    ),
  };
}

export async function firstGeneraciyaOgImage(
  result: RouteCardsResult,
  cards: PromptCardFull[]
): Promise<string | null> {
  const fromCards = cards[0]?.photoUrls[0];
  if (fromCards) return fromCards;
  if (!result.cards.length) return null;
  try {
    return await getFirstCardPhotoUrl(result.cards.map((card) => card.id));
  } catch (error) {
    console.error("[generaciya] fetch OG image failed", error);
    return null;
  }
}

export function buildGeneraciyaHubJsonLd({
  pageUrl,
  name,
  description,
  ogImage,
  imageCaption = null,
  breadcrumbs,
  howTo,
  faq,
  itemList,
}: {
  pageUrl: string;
  name: string;
  description: string;
  ogImage: string | null;
  imageCaption?: string | null;
  breadcrumbs: readonly { name: string; item: string }[];
  howTo?: { name: string; steps: readonly { title: string; text: string }[] };
  faq: readonly GeneraciyaFaqEntry[];
  itemList?: {
    name: string;
    cards: PromptCardFull[];
    names?: readonly (string | null | undefined)[];
  };
}) {
  const image = ogImage
    ? imageCaption
      ? { "@type": "ImageObject", url: ogImage, caption: imageCaption }
      : ogImage
    : undefined;
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name,
      description,
      url: pageUrl,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Web",
      inLanguage: "ru",
      ...(image ? { image } : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: breadcrumbs.map((crumb, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: crumb.name,
        item: crumb.item,
      })),
    },
    ...(howTo
      ? [
          {
            "@context": "https://schema.org",
            "@type": "HowTo",
            name: howTo.name,
            step: howTo.steps.map((step, index) => ({
              "@type": "HowToStep",
              position: index + 1,
              name: step.title,
              text: step.text,
            })),
          },
        ]
      : []),
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: flattenGeneraciyaFotoFaqAnswer(item.a),
        },
      })),
    },
    ...(itemList && itemList.cards.length
      ? [
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: itemList.name,
            numberOfItems: itemList.cards.length,
            itemListElement: itemList.cards.map((card, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name:
                itemList.names?.[index]?.trim() ||
                card.title_ru ||
                card.title_en ||
                "Промт для фото",
              ...(card.slug ? { url: `${SITE_URL}/p/${card.slug}` } : {}),
            })),
          },
        ]
      : []),
  ];
}
