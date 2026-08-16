import {
  primeListingNavigationCardData,
  toListingCardPageData,
  writeListingNavigationContext,
} from "@/lib/listing-card-navigation-context";
import type { CardPageData, PromptCardFull } from "@/lib/supabase";

export type GenerationExampleCard = {
  id: string;
  slug: string;
  title: string;
  seoTags: Record<string, string[]>;
  photoUrl: string | null;
  photoWidth: number | null;
  photoHeight: number | null;
  photoCount: number;
  hasPrompt: boolean;
  navigationData: CardPageData;
};

export function toGenerationExampleCard(
  card: PromptCardFull
): GenerationExampleCard {
  const rawTags =
    card.seo_tags && typeof card.seo_tags === "object" ? card.seo_tags : {};

  return {
    id: card.id,
    slug: card.slug,
    title: card.title_ru || card.title_en || "Промт для фото",
    seoTags: rawTags as Record<string, string[]>,
    photoUrl: card.photoUrls[0] || null,
    photoWidth: card.photoMeta[0]?.width ?? null,
    photoHeight: card.photoMeta[0]?.height ?? null,
    photoCount: card.photoUrls.length,
    hasPrompt: card.promptTexts.some((prompt) => prompt.trim().length > 0),
    navigationData: toListingCardPageData(card),
  };
}

export function writeGenerationExampleNavigation(
  cards: GenerationExampleCard[]
): void {
  primeListingNavigationCardData(cards.map((card) => card.navigationData));
  writeListingNavigationContext(cards.map((card) => card.slug));
}
