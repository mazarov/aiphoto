import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  generatePhotorealPromptFromImage,
  PhotorealAnalyzeError,
} from "@/lib/image-prompt-analyze-gemini";
import { parseAnalyzeImageBuffer } from "@/lib/image-prompt-analyze-image";
import {
  isPhotoshootUgcListing,
  PHOTOSHOOT_FRAME_COUNT,
  shouldReplacePhotoshootVariants,
} from "@/lib/photoshoot";
import type { createSupabaseServer } from "@/lib/supabase";
import { buildUgcCardTitle } from "@/lib/web-ugc-card";

export type PhotoshootPromptHydration = {
  skipped: boolean;
  replaced: boolean;
  promptCount: number;
};

export class PhotoshootPublishAnalyzeError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "PhotoshootPublishAnalyzeError";
  }
}

type PhotoshootMediaRow = {
  id: string;
  storage_bucket: string;
  storage_path: string;
  media_index: number;
};

/**
 * On photoshoot publish: analyze each tile with the same photoreal extract
 * as `/api/extension/analyze`. Does not touch user analyze quota.
 */
export async function hydratePhotoshootCardPrompts(
  supabase: SupabaseClient,
  cardId: string,
): Promise<PhotoshootPromptHydration> {
  const { data: card, error: cardError } = await supabase
    .from("prompt_cards")
    .select("id,source_dataset_slug")
    .eq("id", cardId)
    .maybeSingle();
  if (cardError) {
    throw new Error(`photoshoot_card_lookup_failed:${cardError.message}`);
  }
  if (!card?.id) {
    return { skipped: true, replaced: false, promptCount: 0 };
  }

  const { data: mediaRows, error: mediaError } = await supabase
    .from("prompt_card_media")
    .select("id,storage_bucket,storage_path,media_index")
    .eq("card_id", cardId)
    .eq("media_type", "photo")
    .order("media_index", { ascending: true });
  if (mediaError) {
    throw new Error(`photoshoot_media_lookup_failed:${mediaError.message}`);
  }

  const media = (mediaRows || []) as PhotoshootMediaRow[];
  if (
    media.length !== PHOTOSHOOT_FRAME_COUNT ||
    !isPhotoshootUgcListing({
      datasetSlug: card.source_dataset_slug as string | null,
      photoCount: media.length,
      storagePaths: media.map((row) => row.storage_path),
    })
  ) {
    return { skipped: true, replaced: false, promptCount: 0 };
  }

  const { data: variants, error: variantsError } = await supabase
    .from("prompt_variants")
    .select("prompt_text_ru,prompt_text_en")
    .eq("card_id", cardId)
    .order("variant_index", { ascending: true });
  if (variantsError) {
    throw new Error(`photoshoot_variants_lookup_failed:${variantsError.message}`);
  }

  const texts = (variants || []).map((row) => {
    const variant = row as {
      prompt_text_ru: string | null;
      prompt_text_en: string | null;
    };
    return variant.prompt_text_ru?.trim() || variant.prompt_text_en?.trim() || "";
  });
  if (!shouldReplacePhotoshootVariants(texts)) {
    return { skipped: true, replaced: false, promptCount: texts.length };
  }

  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    throw new PhotoshootPublishAnalyzeError("photoshoot_analyze_missing_key");
  }

  const analyzeClient = supabase as ReturnType<typeof createSupabaseServer>;
  const prompts = await Promise.all(
    media.map(async (row, index) => {
      const { data: file, error } = await supabase.storage
        .from(row.storage_bucket)
        .download(row.storage_path);
      if (error || !file) {
        throw new PhotoshootPublishAnalyzeError(`photoshoot_analyze_download:${index}`);
      }
      const image = parseAnalyzeImageBuffer(Buffer.from(await file.arrayBuffer()));
      if (!image) {
        throw new PhotoshootPublishAnalyzeError(`photoshoot_analyze_image:${index}`);
      }
      try {
        const result = await generatePhotorealPromptFromImage({
          image,
          locale: "ru",
          supabase: analyzeClient,
          apiKey,
          logPrefix: "photoshoot.publish.analyze",
          requestId: crypto.randomUUID(),
          correlationId: cardId,
        });
        return result.promptText;
      } catch (error) {
        if (error instanceof PhotorealAnalyzeError) {
          throw new PhotoshootPublishAnalyzeError(
            `photoshoot_analyze_${error.code}:${index}`,
          );
        }
        throw error;
      }
    }),
  );

  const { error: deleteError } = await supabase
    .from("prompt_variants")
    .delete()
    .eq("card_id", cardId);
  if (deleteError) {
    throw new Error(`photoshoot_variants_replace_failed:${deleteError.message}`);
  }

  const { data: created, error: insertError } = await supabase
    .from("prompt_variants")
    .insert(
      prompts.map((text, index) => ({
        card_id: cardId,
        variant_index: index,
        label_raw: `photoshoot-${index + 1}`,
        prompt_text_ru: text,
        prompt_text_en: null,
        match_strategy: "photoshoot_analyze",
      })),
    )
    .select("id,variant_index");
  if (insertError || !created?.length) {
    throw new Error(
      `photoshoot_variants_insert_failed:${insertError?.message || "empty"}`,
    );
  }

  const links = (created as Array<{ id: string; variant_index: number }>).map(
    (variant) => ({
      variant_id: variant.id,
      media_id: media[variant.variant_index].id,
    }),
  );
  const { error: linkError } = await supabase
    .from("prompt_variant_media")
    .insert(links);
  if (linkError) {
    throw new Error(`photoshoot_variant_media_failed:${linkError.message}`);
  }

  const { error: titleError } = await supabase
    .from("prompt_cards")
    .update({
      title_ru: buildUgcCardTitle(prompts[0] || ""),
      updated_at: new Date().toISOString(),
    })
    .eq("id", cardId);
  if (titleError) {
    throw new Error(`photoshoot_title_update_failed:${titleError.message}`);
  }

  console.info("[photoshoot.publish.analyze] hydrated", {
    cardId,
    promptCount: prompts.length,
  });

  return { skipped: false, replaced: true, promptCount: prompts.length };
}
