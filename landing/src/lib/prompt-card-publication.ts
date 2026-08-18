import "server-only";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { classifySeoTagsForPublish } from "@/lib/seo-tags-classify";
import { processPublishedCardEmbedding } from "@/lib/visual-embedding-publish";

export type PromptCardPublicationResult = {
  cardId: string;
  slug: string;
  isPublished: true;
  alreadyPublished: boolean;
  seoReadinessScore: number | null;
};

function scheduleVisualEmbeddingProcessing(
  supabase: SupabaseClient,
  cardId: string,
): void {
  after(async () => {
    try {
      const result = await processPublishedCardEmbedding({
        supabase,
        cardId,
      });
      console.info("[visual-embeddings] publish kick completed", {
        cardId,
        ...result,
      });
    } catch (error) {
      // Publication is already committed. The recurring cron remains the
      // source of truth for retrying pending embedding jobs.
      console.warn("[visual-embeddings] publish kick failed", {
        cardId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

export async function publishPromptCard(
  supabase: SupabaseClient,
  cardId: string
): Promise<PromptCardPublicationResult> {
  const { data: card, error: cardError } = await supabase
    .from("prompt_cards")
    .select("id,slug,title_ru,is_published,seo_readiness_score")
    .eq("id", cardId)
    .maybeSingle();

  if (cardError) {
    throw new Error(`card_lookup_failed:${cardError.message}`);
  }
  if (!card?.id || !card.slug) {
    throw new Error("card_not_found");
  }

  if (card.is_published) {
    scheduleVisualEmbeddingProcessing(supabase, card.id as string);
    return {
      cardId: card.id as string,
      slug: card.slug as string,
      isPublished: true,
      alreadyPublished: true,
      seoReadinessScore:
        typeof card.seo_readiness_score === "number"
          ? card.seo_readiness_score
          : null,
    };
  }

  const { data: variants, error: variantsError } = await supabase
    .from("prompt_variants")
    .select("prompt_text_ru,prompt_text_en")
    .eq("card_id", cardId)
    .order("variant_index", { ascending: true });

  if (variantsError) {
    throw new Error(`card_variants_failed:${variantsError.message}`);
  }

  const promptTexts = (variants || [])
    .map((variant) => {
      const row = variant as {
        prompt_text_ru: string | null;
        prompt_text_en: string | null;
      };
      return row.prompt_text_ru?.trim() || row.prompt_text_en?.trim() || null;
    })
    .filter((text): text is string => Boolean(text));

  const classified = await classifySeoTagsForPublish(
    (card.title_ru as string | null) ?? null,
    promptTexts
  );

  const { data: publishedRows, error: publishError } = await supabase
    .from("prompt_cards")
    .update({
      is_published: true,
      seo_tags: classified.seo_tags,
      seo_readiness_score: classified.seo_readiness_score,
      updated_at: new Date().toISOString(),
    })
    .eq("id", cardId)
    .eq("is_published", false)
    .select("id");

  if (publishError) {
    throw new Error(`card_publish_failed:${publishError.message}`);
  }

  const alreadyPublished = !publishedRows || publishedRows.length === 0;
  if (alreadyPublished) {
    const { data: concurrentCard } = await supabase
      .from("prompt_cards")
      .select("is_published")
      .eq("id", cardId)
      .maybeSingle();
    if (!concurrentCard?.is_published) {
      throw new Error("card_publish_conflict");
    }
  }

  const slug = card.slug as string;
  revalidatePath(`/p/${slug}`);
  revalidatePath("/sitemap.xml");
  scheduleVisualEmbeddingProcessing(supabase, card.id as string);

  return {
    cardId: card.id as string,
    slug,
    isPublished: true,
    alreadyPublished,
    seoReadinessScore: classified.seo_readiness_score,
  };
}
