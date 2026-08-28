import type { SupabaseClient } from "@supabase/supabase-js";

const DATASET_SLUG = "web_generation_ugc";

function sourceMessageId(): number {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}

function title(prompt: string): string {
  const normalized = String(prompt || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "Моя генерация";
  return normalized.length > 90 ? `${normalized.slice(0, 87).trim()}...` : normalized;
}

async function ensureDataset(supabase: SupabaseClient): Promise<string> {
  const { data: existing } = await supabase
    .from("import_datasets")
    .select("id")
    .eq("dataset_slug", DATASET_SLUG)
    .maybeSingle();
  if (existing?.id) return existing.id as string;
  const { data, error } = await supabase
    .from("import_datasets")
    .insert({
      dataset_slug: DATASET_SLUG,
      channel_title: "Web generation UGC",
      source_type: "web_generation",
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !data?.id) throw new Error(`web_ugc_dataset_create_failed:${error?.message || "unknown"}`);
  return data.id as string;
}

async function createSourceGroup(
  supabase: SupabaseClient,
  datasetId: string,
  prompt: string,
  generationId: string,
): Promise<{ id: string; messageId: number }> {
  const now = new Date().toISOString();
  const { data: run, error: runError } = await supabase
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
  if (runError || !run?.id) throw new Error(`import_run_create_failed:${runError?.message || "unknown"}`);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const messageId = sourceMessageId();
    const { data, error } = await supabase
      .from("source_message_groups")
      .insert({
        dataset_id: datasetId,
        run_id: run.id,
        source_group_key: `web_gen:${generationId}:${messageId}`,
        source_message_id: messageId,
        source_message_ids: [messageId],
        source_published_at: now,
        raw_text_plain: prompt,
        raw_payload: { source: "web_generation", generationId },
      })
      .select("id,source_message_id")
      .single();
    if (!error && data?.id) return { id: data.id as string, messageId };
  }
  throw new Error("source_group_create_failed:conflict");
}

export async function createUgcCard(
  supabase: SupabaseClient,
  params: {
    generationId: string;
    generationOwnerUserId: string;
    promptText: string;
    resultBucket: string;
    resultPath?: string;
    resultPaths?: string[];
  },
): Promise<{ cardId: string; slug: string | null } | null> {
  const {
    generationId,
    generationOwnerUserId,
    promptText,
    resultBucket,
  } = params;
  const resultPaths = (params.resultPaths?.length
    ? params.resultPaths
    : params.resultPath
      ? [params.resultPath]
      : []
  )
    .map((path) => String(path || "").trim())
    .filter(Boolean);
  if (!resultPaths.length) return null;
  const { data: generation, error: generationError } = await supabase
    .from("landing_generations")
    .select("user_id,requester_auth_user_id,status,ugc_card_id")
    .eq("id", generationId)
    .single();
  if (generationError) {
    throw new Error(`generation_lookup_failed:${generationError.message}`);
  }
  if (
    !generation ||
    generation.user_id !== generationOwnerUserId ||
    generation.status !== "completed"
  ) {
    return null;
  }
  const authorAuthUserId = generation.requester_auth_user_id as string | null;
  if (!authorAuthUserId) {
    throw new Error("ugc_author_auth_user_missing");
  }
  if (generation.ugc_card_id) {
    const { data } = await supabase
      .from("prompt_cards")
      .select("id,slug")
      .eq("id", generation.ugc_card_id)
      .maybeSingle();
    if (data?.id) return { cardId: data.id as string, slug: (data.slug as string) ?? null };
  }

  const datasetId = await ensureDataset(supabase);
  const source = await createSourceGroup(supabase, datasetId, promptText, generationId);
  const { data: card, error: cardError } = await supabase
    .from("prompt_cards")
    .insert({
      source_group_id: source.id,
      title_ru: title(promptText),
      title_en: null,
      hashtags: [],
      tags: [],
      seo_tags: {},
      seo_readiness_score: 0,
      source_channel: "web_generation",
      source_dataset_slug: DATASET_SLUG,
      source_message_id: source.messageId,
      source_date: new Date().toISOString(),
      parse_status: "parsed",
      parse_warnings: [],
      is_published: false,
      // prompt_cards.author_user_id FK → auth.users, never imageprompt_users.
      author_user_id: authorAuthUserId,
    })
    .select("id,slug")
    .single();
  if (cardError || !card?.id) {
    throw new Error(`prompt_card_create_failed:${cardError?.message || "unknown"}`);
  }
  const cardId = card.id as string;

  const { error: mediaError } = await supabase.from("prompt_card_media").insert(
    resultPaths.map((path, index) => ({
      card_id: cardId,
      media_index: index,
      media_type: "photo",
      storage_bucket: resultBucket,
      storage_path: path,
      original_relative_path: path,
      is_primary: index === 0,
    })),
  );
  const { error: variantError } = mediaError
    ? { error: mediaError }
    : await supabase.from("prompt_variants").insert({
        card_id: cardId,
        variant_index: 0,
        label_raw: "web",
        prompt_text_ru: promptText,
        prompt_text_en: null,
        match_strategy: "web_generation",
      });
  if (mediaError || variantError) {
    await supabase.from("prompt_cards").delete().eq("id", cardId);
    throw new Error(
      `prompt_card_content_create_failed:${mediaError?.message || variantError?.message || "unknown"}`,
    );
  }

  const { data: linked, error: linkError } = await supabase
    .from("landing_generations")
    .update({ ugc_card_id: cardId, updated_at: new Date().toISOString() })
    .eq("id", generationId)
    .is("ugc_card_id", null)
    .select("id");
  if (linkError || !linked?.length) {
    await supabase.from("prompt_cards").delete().eq("id", cardId);
    throw new Error(`generation_card_link_failed:${linkError?.message || "link_conflict"}`);
  }
  return { cardId, slug: (card.slug as string) ?? null };
}
