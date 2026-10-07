import "server-only";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { usableCatalogPrompt } from "@/lib/photoshoot";
import {
  hydratePhotoshootCardPrompts,
  photoshootCardNeedsPromptHydration,
} from "@/lib/photoshoot-publish";
import {
  EXCLUSIVE_AUDIENCE_SLUGS,
  type ExclusiveAudienceSlug,
} from "@/lib/audience-exclusive";
import { scheduleCardSubjectAudience } from "@/lib/card-subject-audience";
import {
  catalogPathsForSeoTags,
  classifySeoTagsForPublish,
  pinSeoTags,
  unionKnownRegistryTags,
  type PinnedSeoTag,
} from "@/lib/seo-tags-classify";
import { processPublishedCardEmbedding } from "@/lib/visual-embedding-publish";

export type PromptCardPublicationResult = {
  cardId: string;
  slug: string;
  isPublished: true;
  alreadyPublished: boolean;
  seoReadinessScore: number | null;
  promptsReady: boolean;
  firstPublishedAt: string | null;
};

export type PublishPromptCardOptions = {
  /**
   * Tags the admin chose for this card (e.g. the `/ii-fotosessiya` scenario).
   * Re-applied after every classifier pass so background hydration cannot drop them.
   */
  pinnedTags?: readonly PinnedSeoTag[];
  /** Listing paths beyond the tag-registry hubs to revalidate (e.g. `/ii-fotosessiya`). */
  extraRevalidatePaths?: readonly string[];
};

const NO_OPTIONS: PublishPromptCardOptions = {};

/**
 * Exclusive audience slugs are owned by `subject_audience` (vision), and the
 * `prompt_cards_apply_subject_audience` trigger rewrites `seo_tags.audience_tag`
 * from it on every update. An admin pin for such a slug therefore has to become
 * the manual subject — otherwise the next vision pass or any seo_tags write drops it.
 */
export function manualSubjectFromPins(
  pins: readonly PinnedSeoTag[] | undefined,
): ExclusiveAudienceSlug | null {
  for (const pin of pins ?? []) {
    if (pin.dimension !== "audience_tag") continue;
    if ((EXCLUSIVE_AUDIENCE_SLUGS as readonly string[]).includes(pin.slug)) {
      return pin.slug as ExclusiveAudienceSlug;
    }
  }
  return null;
}

async function applyManualSubjectAudience(
  supabase: SupabaseClient,
  cardId: string,
  pins: readonly PinnedSeoTag[] | undefined,
): Promise<void> {
  const subject = manualSubjectFromPins(pins);
  if (!subject) return;
  const { error } = await supabase
    .from("prompt_cards")
    .update({
      subject_audience: subject,
      subject_confidence: 1,
      subject_source: "manual",
      subject_classified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", cardId);
  if (error) {
    throw new Error(`card_subject_pin_failed:${error.message}`);
  }
}

function applyPins(
  classified: { seo_tags: Record<string, unknown>; seo_readiness_score: number },
  pins: readonly PinnedSeoTag[] | undefined,
): { seo_tags: Record<string, unknown>; seo_readiness_score: number } {
  if (!pins?.length) return classified;
  const pinned = pinSeoTags(classified.seo_tags, pins);
  return {
    seo_tags: pinned.seo_tags as unknown as Record<string, unknown>,
    seo_readiness_score: pinned.seo_readiness_score,
  };
}

function schedulePhotoshootPromptHydration(
  supabase: SupabaseClient,
  cardId: string,
  slug: string,
  options: PublishPromptCardOptions,
): void {
  after(async () => {
    try {
      const hydration = await hydratePhotoshootCardPrompts(supabase, cardId);
      if (!hydration.replaced) return;
      const { data: card, error: cardError } = await supabase
        .from("prompt_cards")
        .select("title_ru")
        .eq("id", cardId)
        .maybeSingle();
      if (cardError) {
        throw new Error(`card_lookup_failed:${cardError.message}`);
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
          return (
            usableCatalogPrompt(row.prompt_text_ru) ||
            usableCatalogPrompt(row.prompt_text_en)
          );
        })
        .filter((text): text is string => Boolean(text));
      const classified = applyPins(
        await classifySeoTagsForPublish(
          (card?.title_ru as string | null) ?? null,
          promptTexts,
        ),
        options.pinnedTags,
      );
      const { error: seoError } = await supabase
        .from("prompt_cards")
        .update({
          seo_tags: classified.seo_tags,
          seo_readiness_score: classified.seo_readiness_score,
          updated_at: new Date().toISOString(),
        })
        .eq("id", cardId);
      if (seoError) {
        throw new Error(`card_seo_refresh_failed:${seoError.message}`);
      }
      revalidatePublishedSurfaces(slug, classified.seo_tags, options);
      console.info("[photoshoot.publish.analyze] after hydrate ok", {
        cardId,
        promptCount: hydration.promptCount,
      });
    } catch (error) {
      console.warn("[photoshoot.publish.analyze] after hydrate failed", {
        cardId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

function revalidatePublishedSurfaces(
  slug: string,
  seoTags: unknown,
  options: PublishPromptCardOptions = NO_OPTIONS,
): void {
  revalidatePath(`/p/${slug}`);
  revalidatePath("/sitemap.xml");
  const paths = new Set([
    ...catalogPathsForSeoTags(seoTags),
    ...(options.extraRevalidatePaths ?? []),
  ]);
  for (const path of paths) {
    revalidatePath(path);
  }
}

function promptTextsFromVariants(
  variants: Array<{ prompt_text_ru: string | null; prompt_text_en: string | null }> | null,
): string[] {
  return (variants || [])
    .map(
      (variant) =>
        usableCatalogPrompt(variant.prompt_text_ru) ||
        usableCatalogPrompt(variant.prompt_text_en),
    )
    .filter((text): text is string => Boolean(text));
}

/**
 * Repeat publish must not call the model again.
 * It only unions occasion slugs the registry regex already matches, then drops hub ISR.
 */
async function mergeKnownTagsOnPublishedCard(
  supabase: SupabaseClient,
  card: { id: string; slug: string; title_ru: string | null; seo_tags: unknown },
  options: PublishPromptCardOptions,
): Promise<number | null> {
  const { data: variants, error: variantsError } = await supabase
    .from("prompt_variants")
    .select("prompt_text_ru,prompt_text_en")
    .eq("card_id", card.id)
    .order("variant_index", { ascending: true });
  if (variantsError) {
    throw new Error(`card_variants_failed:${variantsError.message}`);
  }

  const known = unionKnownRegistryTags(
    card.seo_tags,
    card.title_ru,
    promptTextsFromVariants(variants),
  );
  const pinned = pinSeoTags(known.seo_tags, options.pinnedTags ?? []);
  const merged = {
    seo_tags: pinned.seo_tags,
    seo_readiness_score: pinned.seo_readiness_score,
    changed: known.changed || pinned.changed,
  };
  if (merged.changed) {
    const { error: seoError } = await supabase
      .from("prompt_cards")
      .update({
        seo_tags: merged.seo_tags,
        seo_readiness_score: merged.seo_readiness_score,
        updated_at: new Date().toISOString(),
      })
      .eq("id", card.id)
      .eq("is_published", true);
    if (seoError) {
      throw new Error(`card_seo_refresh_failed:${seoError.message}`);
    }
  }
  revalidatePublishedSurfaces(card.slug, merged.seo_tags, options);
  return merged.seo_readiness_score;
}

function scheduleSubjectAudience(supabase: SupabaseClient, cardId: string): void {
  scheduleCardSubjectAudience({
    supabase,
    cardId,
    afterImpl: after,
  });
}

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
  cardId: string,
  options: PublishPromptCardOptions = NO_OPTIONS,
): Promise<PromptCardPublicationResult> {
  const needsPhotoshootHydration = await photoshootCardNeedsPromptHydration(
    supabase,
    cardId,
  );

  const { data: card, error: cardError } = await supabase
    .from("prompt_cards")
    .select("id,slug,title_ru,is_published,seo_tags,seo_readiness_score")
    .eq("id", cardId)
    .maybeSingle();

  if (cardError) {
    throw new Error(`card_lookup_failed:${cardError.message}`);
  }
  if (!card?.id || !card.slug) {
    throw new Error("card_not_found");
  }

  if (card.is_published && !needsPhotoshootHydration) {
    const seoReadinessScore = await mergeKnownTagsOnPublishedCard(
      supabase,
      {
        id: card.id as string,
        slug: card.slug as string,
        title_ru: (card.title_ru as string | null) ?? null,
        seo_tags: card.seo_tags,
      },
      options,
    );
    await applyManualSubjectAudience(supabase, card.id as string, options.pinnedTags);
    scheduleVisualEmbeddingProcessing(supabase, card.id as string);
    scheduleSubjectAudience(supabase, card.id as string);
    return {
      cardId: card.id as string,
      slug: card.slug as string,
      isPublished: true,
      alreadyPublished: true,
      seoReadinessScore,
      promptsReady: true,
      firstPublishedAt: await readFirstPublishedAt(supabase, card.id as string),
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

  const promptTexts = promptTextsFromVariants(variants);

  const classified = applyPins(
    await classifySeoTagsForPublish(
      (card.title_ru as string | null) ?? null,
      promptTexts
    ),
    options.pinnedTags,
  );

  if (card.is_published) {
    const { error: seoError } = await supabase
      .from("prompt_cards")
      .update({
        seo_tags: classified.seo_tags,
        seo_readiness_score: classified.seo_readiness_score,
        updated_at: new Date().toISOString(),
      })
      .eq("id", cardId)
      .eq("is_published", true);
    if (seoError) {
      throw new Error(`card_seo_refresh_failed:${seoError.message}`);
    }
    await applyManualSubjectAudience(supabase, cardId, options.pinnedTags);

    const slug = card.slug as string;
    revalidatePublishedSurfaces(slug, classified.seo_tags, options);
    if (needsPhotoshootHydration) {
      schedulePhotoshootPromptHydration(supabase, card.id as string, slug, options);
    }
    scheduleVisualEmbeddingProcessing(supabase, card.id as string);
    scheduleSubjectAudience(supabase, card.id as string);

    return {
      cardId: card.id as string,
      slug,
      isPublished: true,
      alreadyPublished: true,
      seoReadinessScore: classified.seo_readiness_score,
      promptsReady: !needsPhotoshootHydration,
      firstPublishedAt: await readFirstPublishedAt(supabase, card.id as string),
    };
  }

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
  await applyManualSubjectAudience(supabase, cardId, options.pinnedTags);

  const slug = card.slug as string;
  revalidatePublishedSurfaces(slug, classified.seo_tags, options);
  if (needsPhotoshootHydration) {
    schedulePhotoshootPromptHydration(supabase, card.id as string, slug, options);
  }
  scheduleVisualEmbeddingProcessing(supabase, card.id as string);
  scheduleSubjectAudience(supabase, card.id as string);

  return {
    cardId: card.id as string,
    slug,
    isPublished: true,
    alreadyPublished,
    seoReadinessScore: classified.seo_readiness_score,
    promptsReady: !needsPhotoshootHydration,
    firstPublishedAt: await readFirstPublishedAt(supabase, card.id as string),
  };
}

async function readFirstPublishedAt(
  supabase: SupabaseClient,
  cardId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("prompt_cards")
    .select("first_published_at")
    .eq("id", cardId)
    .maybeSingle();
  if (error) return null;
  return typeof data?.first_published_at === "string"
    ? data.first_published_at
    : null;
}
