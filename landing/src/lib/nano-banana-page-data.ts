import { cache } from "react";
import type { Metadata } from "next";
import {
  createSupabaseServer,
  enrichCardsWithDetails,
  fetchRouteCards,
  getFirstCardPhotoUrl,
  type PromptCardFull,
  type RouteCardsResult,
} from "@/lib/supabase";
import {
  FALLBACK_GENERATION_MODELS,
  filterNanoBananaFamilyModels,
  parseEnabledGenerationModels,
  type GenerationModelOption,
} from "@/lib/generation-model-labels";
import type { NanoBananaSeoCopy } from "@/lib/nano-banana-seo-copy";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://promptshot.ru";

const BASE_RPC_PARAMS: Record<string, string | null> = {
  audience_tag: null,
  style_tag: null,
  occasion_tag: null,
  object_tag: null,
  doc_task_tag: null,
};

const EMPTY_RESULT: RouteCardsResult = {
  cards: [],
  tier_used: "error",
  cards_count: 0,
  total_count: 0,
  has_minimum: false,
  dimension_count: 0,
};

export function nanoBananaSiteUrl(): string {
  return SITE_URL;
}

const getGenerationExamples = cache(async (): Promise<RouteCardsResult> => {
  try {
    return await fetchRouteCards({
      ...BASE_RPC_PARAMS,
      limit: 50,
      offset: 0,
      min_cards: 1,
      sort: "new",
    });
  } catch (error) {
    console.error("[NanoBananaPage] fetch examples failed", error);
    return EMPTY_RESULT;
  }
});

const getCompletedImageGenerationCount = cache(async (): Promise<number> => {
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
    console.error(
      "[NanoBananaPage] fetch completed image generation count failed",
      error
    );
    return 0;
  }
});

const getGenerationModels = cache(
  async (): Promise<GenerationModelOption[]> => {
    try {
      const supabase = createSupabaseServer();
      const { data, error } = await supabase
        .from("landing_generation_config")
        .select("value")
        .eq("key", "models")
        .maybeSingle();
      if (error) throw error;
      const filtered = filterNanoBananaFamilyModels(
        parseEnabledGenerationModels(data?.value)
      );
      return filtered.length
        ? filtered
        : filterNanoBananaFamilyModels(FALLBACK_GENERATION_MODELS);
    } catch (error) {
      console.error("[NanoBananaPage] fetch models failed", error);
      return filterNanoBananaFamilyModels(FALLBACK_GENERATION_MODELS);
    }
  }
);

export const loadNanoBananaOgImage = cache(async (): Promise<string | null> => {
  const result = await getGenerationExamples();
  if (!result.cards.length) return null;
  try {
    return await getFirstCardPhotoUrl(result.cards.map((card) => card.id));
  } catch (error) {
    console.error("[NanoBananaPage] fetch OG image failed", error);
    return null;
  }
});

export async function loadNanoBananaPageData(): Promise<{
  cards: PromptCardFull[];
  models: GenerationModelOption[];
  completedImageCount: number;
  ogImage: string | null;
}> {
  const [result, models, completedImageCount] = await Promise.all([
    getGenerationExamples(),
    getGenerationModels(),
    getCompletedImageGenerationCount(),
  ]);
  const [enrichedCards, fallbackOgImage] = await Promise.all([
    enrichCardsWithDetails(result.cards).catch((error) => {
      console.error("[NanoBananaPage] enrich examples failed", error);
      return [] as PromptCardFull[];
    }),
    loadNanoBananaOgImage(),
  ]);
  const cardsById = new Map(enrichedCards.map((card) => [card.id, card]));
  const cards = result.cards
    .map((card) => cardsById.get(card.id))
    .filter((card): card is PromptCardFull => Boolean(card));
  const ogImage = cards[0]?.photoUrls[0] || fallbackOgImage;
  return { cards, models, completedImageCount, ogImage };
}

export function buildNanoBananaMetadata(
  seo: Pick<NanoBananaSeoCopy, "metaTitle" | "metaDescription">,
  path: string,
  ogImage: string | null
): Metadata {
  const pageUrl = `${SITE_URL}${path}`;
  return {
    title: seo.metaTitle,
    description: seo.metaDescription,
    robots: {
      index: true,
      follow: true,
      "max-image-preview": "large" as const,
      "max-snippet": -1,
      "max-video-preview": -1,
    },
    alternates: { canonical: pageUrl },
    openGraph: {
      title: seo.metaTitle,
      description: seo.metaDescription,
      url: pageUrl,
      type: "website",
      siteName: "PromptShot",
      locale: "ru_RU",
      ...(ogImage
        ? { images: [{ url: ogImage, width: 1200, height: 630 }] }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: seo.metaTitle,
      description: seo.metaDescription,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}
