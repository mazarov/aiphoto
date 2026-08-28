import type { SupabaseClient } from "@supabase/supabase-js";
import { landingGenerationsOwnerOrFilter } from "@/lib/landing-generations-access";
import { createUgcCardForCompletedGeneration, syncUgcCardMedia } from "@/lib/web-ugc-card";
import {
  photoshootUserFacingMediaPaths,
  resolvePhotoshootUserFacingResult,
} from "@/lib/photoshoot";

export type OwnedGenerationForCardAction = {
  id: string;
  user_id: string;
  requester_auth_user_id: string | null;
  status: string;
  prompt_text: string;
  result_storage_bucket: string | null;
  result_storage_path: string | null;
  edit_kind: string | null;
  photoshoot_tile_paths: unknown;
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
      "id,user_id,requester_auth_user_id,status,prompt_text,result_storage_bucket,result_storage_path,edit_kind,photoshoot_tile_paths,ugc_card_id"
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
  const facing = resolvePhotoshootUserFacingResult({
    editKind: generation.edit_kind,
    sheetPath: generation.result_storage_path,
    tilePaths: generation.photoshoot_tile_paths,
  });
  const mediaPaths = photoshootUserFacingMediaPaths(facing);
  if (
    generation.status !== "completed" ||
    !generation.result_storage_bucket ||
    !mediaPaths.length
  ) {
    throw new Error("generation_result_not_available");
  }

  if (generation.ugc_card_id) {
    const existing = await readGenerationCard(supabase, generation.ugc_card_id);
    if (existing) {
      await syncUgcCardMedia(supabase, {
        cardId: existing.cardId,
        resultBucket: generation.result_storage_bucket,
        resultPaths: mediaPaths,
      });
      return existing;
    }
  }

  const created = await createUgcCardForCompletedGeneration(supabase, {
    generationId: generation.id,
    generationOwnerUserId: generation.user_id,
    promptText: generation.prompt_text || "",
    resultBucket: generation.result_storage_bucket,
    resultPaths: mediaPaths,
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
