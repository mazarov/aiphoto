import type { SupabaseClient } from "@supabase/supabase-js";
import { looksLikePhotoshootInstruction } from "@/lib/photoshoot";
import {
  buildUgcCardMediaInserts,
  cleanUgcCardMediaPaths,
  planUgcCardMediaSync,
  type UgcMediaItem,
} from "@/lib/ugc-card-media";

export const WEB_UGC_DATASET_SLUG = "web_generation_ugc";
const WEB_UGC_CHANNEL = "Web generation UGC";

function makeSourceMessageId(): number {
  const base = Date.now() * 1000;
  const suffix = Math.floor(Math.random() * 1000);
  return base + suffix;
}

export function buildUgcCardTitle(prompt: string): string {
  const normalized = String(prompt || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "Моя генерация";
  return normalized.length > 90 ? `${normalized.slice(0, 87).trim()}...` : normalized;
}

/** Idempotent variant_index=0 write — used to replace motion-only video UGC prompts. */
export async function syncUgcCardPromptText(
  supabase: SupabaseClient,
  cardId: string,
  promptText: string,
): Promise<void> {
  const text = String(promptText || "").trim();
  if (!text || !cardId.trim()) return;

  const { data: existing, error } = await supabase
    .from("prompt_variants")
    .select("id,prompt_text_ru")
    .eq("card_id", cardId)
    .eq("variant_index", 0)
    .maybeSingle();
  if (error) {
    console.error("[web-ugc-card] variant lookup failed", {
      cardId,
      error: error.message,
    });
    return;
  }

  if (!existing?.id) {
    const { error: insertError } = await supabase.from("prompt_variants").insert({
      card_id: cardId,
      variant_index: 0,
      label_raw: "web",
      prompt_text_ru: text,
      prompt_text_en: null,
      match_strategy: "web_generation",
    });
    if (insertError) {
      console.error("[web-ugc-card] variant insert failed", {
        cardId,
        error: insertError.message,
      });
    }
    return;
  }

  if (String(existing.prompt_text_ru || "").trim() === text) return;
  const { error: updateError } = await supabase
    .from("prompt_variants")
    .update({ prompt_text_ru: text })
    .eq("id", existing.id);
  if (updateError) {
    console.error("[web-ugc-card] variant update failed", {
      cardId,
      error: updateError.message,
    });
  }
}

async function ensureWebUgcDataset(supabase: SupabaseClient): Promise<string> {
  const { data: existing } = await supabase
    .from("import_datasets")
    .select("id")
    .eq("dataset_slug", WEB_UGC_DATASET_SLUG)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const { data: created, error } = await supabase
    .from("import_datasets")
    .insert({
      dataset_slug: WEB_UGC_DATASET_SLUG,
      channel_title: WEB_UGC_CHANNEL,
      source_type: "web_generation",
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !created?.id) {
    throw new Error(`web_ugc_dataset_create_failed:${error?.message || "unknown"}`);
  }
  return created.id as string;
}

async function createSyntheticUgcSourceGroup(
  supabase: SupabaseClient,
  datasetId: string,
  prompt: string,
  generationId: string,
): Promise<{ sourceGroupId: string; sourceMessageId: number }> {
  const now = new Date().toISOString();
  const { data: runRow, error: runError } = await supabase
    .from("import_runs")
    .insert({
      dataset_id: datasetId,
      mode: "incremental",
      status: "success",
      finished_at: now,
      html_files_total: 1,
      groups_total: 1,
      groups_parsed: 1,
    })
    .select("id")
    .single();
  if (runError || !runRow?.id) {
    throw new Error(`import_run_create_failed:${runError?.message || "unknown"}`);
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const sourceMessageId = makeSourceMessageId();
    const { data: groupRow, error: groupError } = await supabase
      .from("source_message_groups")
      .insert({
        dataset_id: datasetId,
        run_id: runRow.id,
        source_group_key: `web_gen:${generationId}:${sourceMessageId}`,
        source_message_id: sourceMessageId,
        source_message_ids: [sourceMessageId],
        source_published_at: now,
        raw_text_plain: prompt,
        raw_payload: {
          source: "web_generation",
          generationId,
        },
      })
      .select("id,source_message_id")
      .single();

    if (!groupError && groupRow?.id) {
      return {
        sourceGroupId: groupRow.id as string,
        sourceMessageId: Number(groupRow.source_message_id || sourceMessageId),
      };
    }
  }
  throw new Error("source_group_create_failed:conflict");
}

/**
 * After a generation completes: create draft prompt_cards row + media + variant, set landing_generations.ugc_card_id.
 * Idempotent if ugc_card_id already set.
 */
export async function createUgcCardForCompletedGeneration(
  supabase: SupabaseClient,
  params: {
    generationId: string;
    generationOwnerUserId: string;
    promptText: string;
    resultBucket: string;
    resultPath?: string;
    resultPaths?: string[];
    mediaItems?: UgcMediaItem[];
  },
): Promise<{ cardId: string; slug: string | null } | null> {
  const {
    generationId,
    generationOwnerUserId,
    promptText,
    resultBucket,
  } = params;
  const mediaItems = (params.mediaItems || []).filter((item) =>
    String(item.path || "").trim(),
  );
  const resultPaths = mediaItems.length
    ? mediaItems.map((item) => item.path)
    : cleanUgcCardMediaPaths(
        params.resultPaths?.length
          ? params.resultPaths
          : params.resultPath
            ? [params.resultPath]
            : [],
      );
  if (!resultPaths.length) return null;

  const { data: genRow, error: genErr } = await supabase
    .from("landing_generations")
    .select("id,user_id,requester_auth_user_id,status,ugc_card_id")
    .eq("id", generationId)
    .single();

  if (
    genErr ||
    !genRow ||
    genRow.user_id !== generationOwnerUserId ||
    genRow.status !== "completed"
  ) {
    return null;
  }
  const authorAuthUserId = genRow.requester_auth_user_id as string | null;
  if (!authorAuthUserId) {
    console.error("[web-ugc-card] requester auth user missing", {
      generationId,
      generationOwnerUserId,
    });
    return null;
  }

  if (genRow.ugc_card_id) {
    const { data: existingCard } = await supabase
      .from("prompt_cards")
      .select("id,slug")
      .eq("id", genRow.ugc_card_id)
      .maybeSingle();
    if (existingCard?.id) {
      return { cardId: existingCard.id as string, slug: (existingCard.slug as string) ?? null };
    }
  }

  const datasetId = await ensureWebUgcDataset(supabase);
  const { sourceGroupId, sourceMessageId } = await createSyntheticUgcSourceGroup(
    supabase,
    datasetId,
    promptText,
    generationId,
  );

  const photoshootDraft = looksLikePhotoshootInstruction(promptText);
  const titleRu = photoshootDraft ? "Моя фотосессия" : buildUgcCardTitle(promptText);

  const { data: createdCard, error: createCardError } = await supabase
    .from("prompt_cards")
    .insert({
      source_group_id: sourceGroupId,
      title_ru: titleRu,
      title_en: null,
      hashtags: [],
      tags: [],
      seo_tags: {},
      seo_readiness_score: 0,
      source_channel: "web_generation",
      source_dataset_slug: WEB_UGC_DATASET_SLUG,
      source_message_id: sourceMessageId,
      source_date: new Date().toISOString(),
      parse_status: "parsed",
      parse_warnings: [],
      is_published: false,
      // prompt_cards.author_user_id FK → auth.users, never imageprompt_users.
      author_user_id: authorAuthUserId,
    })
    .select("id,slug")
    .single();

  if (createCardError || !createdCard?.id) {
    console.error("[web-ugc-card] prompt_cards insert failed", {
      generationId,
      error: createCardError?.message ?? null,
    });
    return null;
  }

  const cardId = createdCard.id as string;

  const { error: mediaInsertError } = await supabase
    .from("prompt_card_media")
    .insert(
      buildUgcCardMediaInserts({
        cardId,
        bucket: resultBucket,
        paths: resultPaths,
        items: mediaItems.length ? mediaItems : undefined,
      }),
    );
  if (mediaInsertError) {
    console.error("[web-ugc-card] media insert failed", {
      generationId,
      cardId,
      error: mediaInsertError.message,
    });
    await supabase.from("prompt_cards").delete().eq("id", cardId);
    return null;
  }

  if (!photoshootDraft) {
    const { error: variantInsertError } = await supabase.from("prompt_variants").insert({
      card_id: cardId,
      variant_index: 0,
      label_raw: "web",
      prompt_text_ru: promptText,
      prompt_text_en: null,
      match_strategy: "web_generation",
    });
    if (variantInsertError) {
      console.error("[web-ugc-card] variant insert failed", {
        generationId,
        cardId,
        error: variantInsertError.message,
      });
      await supabase.from("prompt_cards").delete().eq("id", cardId);
      return null;
    }
  }

  const { data: linkedRows, error: linkError } = await supabase
    .from("landing_generations")
    .update({ ugc_card_id: cardId, updated_at: new Date().toISOString() })
    .eq("id", generationId)
    .is("ugc_card_id", null)
    .select("id");

  if (linkError) {
    console.error("[web-ugc-card] generation link failed", {
      generationId,
      cardId,
      error: linkError.message,
    });
    await supabase.from("prompt_cards").delete().eq("id", cardId);
    return null;
  }

  if (!linkedRows || linkedRows.length === 0) {
    await supabase.from("prompt_cards").delete().eq("id", cardId);
    const { data: other } = await supabase
      .from("landing_generations")
      .select("ugc_card_id")
      .eq("id", generationId)
      .maybeSingle();
    const existingId = other?.ugc_card_id as string | undefined;
    if (existingId) {
      const { data: c } = await supabase.from("prompt_cards").select("id,slug").eq("id", existingId).maybeSingle();
      if (c?.id) {
        return { cardId: c.id as string, slug: (c.slug as string) ?? null };
      }
    }
    return null;
  }

  return { cardId, slug: (createdCard.slug as string) ?? null };
}

/** Align an existing draft/published card to the full user-facing photoset. */
export async function syncUgcCardMedia(
  supabase: SupabaseClient,
  params: {
    cardId: string;
    resultBucket: string;
    resultPaths: string[];
  },
): Promise<void> {
  const desired = cleanUgcCardMediaPaths(params.resultPaths);
  if (!desired.length) return;

  const { data, error } = await supabase
    .from("prompt_card_media")
    .select("media_index,storage_path")
    .eq("card_id", params.cardId)
    .order("media_index", { ascending: true });
  if (error) {
    throw new Error(`ugc_media_lookup_failed:${error.message}`);
  }

  const plan = planUgcCardMediaSync(
    (data || []).map((row) => ({
      media_index: Number(row.media_index),
      storage_path: String(row.storage_path || ""),
    })),
    desired,
  );

  if (plan.action === "noop") return;

  if (plan.action === "replace") {
    const { error: deleteError } = await supabase
      .from("prompt_card_media")
      .delete()
      .eq("card_id", params.cardId);
    if (deleteError) {
      throw new Error(`ugc_media_replace_failed:${deleteError.message}`);
    }
  }

  const insertPaths = plan.action === "append" ? plan.paths : plan.paths;
  const startIndex = plan.action === "append" ? plan.startIndex : 0;
  const { error: insertError } = await supabase.from("prompt_card_media").insert(
    buildUgcCardMediaInserts({
      cardId: params.cardId,
      bucket: params.resultBucket,
      paths: insertPaths,
      startIndex,
    }),
  );
  if (insertError) {
    throw new Error(`ugc_media_sync_failed:${insertError.message}`);
  }
}

/** Create and atomically link a draft card for a private analyze-history image. */
export async function createUgcCardForAnalyzeHistory(
  supabase: SupabaseClient,
  params: {
    analyzeHistoryId: string;
    authorAuthUserId: string;
    promptText: string;
    resultBucket: string;
    resultPath: string;
  },
): Promise<{ cardId: string; slug: string | null } | null> {
  const { data: history } = await supabase
    .from("analyze_history")
    .select("id,ugc_card_id")
    .eq("id", params.analyzeHistoryId)
    .maybeSingle();
  if (!history) return null;
  if (history.ugc_card_id) {
    const { data: existing } = await supabase
      .from("prompt_cards").select("id,slug").eq("id", history.ugc_card_id).maybeSingle();
    if (existing?.id) return { cardId: existing.id as string, slug: existing.slug as string | null };
  }

  const datasetId = await ensureWebUgcDataset(supabase);
  const { sourceGroupId, sourceMessageId } = await createSyntheticUgcSourceGroup(
    supabase, datasetId, params.promptText, `analyze:${params.analyzeHistoryId}`,
  );
  const { data: card, error: cardError } = await supabase.from("prompt_cards").insert({
    source_group_id: sourceGroupId,
    title_ru: buildUgcCardTitle(params.promptText),
    title_en: null,
    hashtags: [],
    tags: [],
    seo_tags: {},
    seo_readiness_score: 0,
    source_channel: "admin_analyze",
    source_dataset_slug: WEB_UGC_DATASET_SLUG,
    source_message_id: sourceMessageId,
    source_date: new Date().toISOString(),
    parse_status: "parsed",
    parse_warnings: [],
    is_published: false,
    author_user_id: params.authorAuthUserId,
  }).select("id,slug").single();
  if (cardError || !card?.id) throw new Error(`analyze_card_create_failed:${cardError?.message || "unknown"}`);

  const cardId = card.id as string;
  const [media, variant] = await Promise.all([
    supabase.from("prompt_card_media").insert({
      card_id: cardId, media_index: 0, media_type: "photo",
      storage_bucket: params.resultBucket, storage_path: params.resultPath,
      original_relative_path: params.resultPath, is_primary: true,
    }),
    supabase.from("prompt_variants").insert({
      card_id: cardId, variant_index: 0, label_raw: "admin_analyze",
      prompt_text_ru: params.promptText, prompt_text_en: null, match_strategy: "admin_analyze",
    }),
  ]);
  if (media.error || variant.error) {
    await supabase.from("prompt_cards").delete().eq("id", cardId);
    throw new Error(`analyze_card_children_failed:${media.error?.message || variant.error?.message}`);
  }

  const { data: linked, error: linkError } = await supabase.from("analyze_history")
    .update({ ugc_card_id: cardId }).eq("id", params.analyzeHistoryId).is("ugc_card_id", null).select("id");
  if (linkError) throw new Error(`analyze_card_link_failed:${linkError.message}`);
  if (!linked?.length) {
    await supabase.from("prompt_cards").delete().eq("id", cardId);
    const { data: current } = await supabase.from("analyze_history")
      .select("ugc_card_id").eq("id", params.analyzeHistoryId).maybeSingle();
    if (current?.ugc_card_id) {
      const { data: existing } = await supabase.from("prompt_cards")
        .select("id,slug").eq("id", current.ugc_card_id).maybeSingle();
      if (existing?.id) return { cardId: existing.id as string, slug: existing.slug as string | null };
    }
    return null;
  }
  return { cardId, slug: card.slug as string | null };
}
