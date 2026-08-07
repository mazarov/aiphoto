import type { SupabaseClient } from "@supabase/supabase-js";
import { landingGenerationsOwnerOrFilter } from "@/lib/landing-generations-access";
import { createUgcCardForCompletedGeneration } from "@/lib/web-ugc-card";

export type OwnedGenerationForCardAction = {
  id: string;
  user_id: string;
  status: string;
  prompt_text: string;
  result_storage_bucket: string | null;
  result_storage_path: string | null;
  ugc_card_id: string | null;
};

export type GenerationCardMetadata = {
  cardId: string;
  slug: string;
  isPublished: boolean;
};

export async function getOwnedGenerationForCardAction(
  supabase: SupabaseClient,
  params: {
    generationId: string;
    authUserId: string;
    dbUserId: string;
  }
): Promise<OwnedGenerationForCardAction | null> {
  const { data, error } = await supabase
    .from("landing_generations")
    .select(
      "id,user_id,status,prompt_text,result_storage_bucket,result_storage_path,ugc_card_id"
    )
    .eq("id", params.generationId)
    .or(landingGenerationsOwnerOrFilter(params.authUserId, params.dbUserId))
    .maybeSingle();

  if (error) {
    throw new Error(`generation_lookup_failed:${error.message}`);
  }

  return (data as OwnedGenerationForCardAction | null) ?? null;
}

async function readGenerationCard(
  supabase: SupabaseClient,
  cardId: string
): Promise<GenerationCardMetadata | null> {
  const { data, error } = await supabase
    .from("prompt_cards")
    .select("id,slug,is_published")
    .eq("id", cardId)
    .maybeSingle();

  if (error) {
    throw new Error(`generation_card_lookup_failed:${error.message}`);
  }
  if (!data?.id || !data.slug) return null;

  return {
    cardId: data.id as string,
    slug: data.slug as string,
    isPublished: Boolean(data.is_published),
  };
}

export async function ensureCardForCompletedGeneration(
  supabase: SupabaseClient,
  generation: OwnedGenerationForCardAction
): Promise<GenerationCardMetadata> {
  if (
    generation.status !== "completed" ||
    !generation.result_storage_bucket ||
    !generation.result_storage_path
  ) {
    throw new Error("generation_result_not_available");
  }

  if (generation.ugc_card_id) {
    const existing = await readGenerationCard(supabase, generation.ugc_card_id);
    if (existing) return existing;
  }

  const created = await createUgcCardForCompletedGeneration(supabase, {
    generationId: generation.id,
    userId: generation.user_id,
    promptText: generation.prompt_text || "",
    resultBucket: generation.result_storage_bucket,
    resultPath: generation.result_storage_path,
  });

  if (!created?.cardId) {
    throw new Error("generation_card_create_failed");
  }

  const card = await readGenerationCard(supabase, created.cardId);
  if (!card) {
    throw new Error("generation_card_missing_after_create");
  }
  return card;
}
