import type { SupabaseClient } from "@supabase/supabase-js";
import { landingGenerationsOwnerOrFilter } from "@/lib/landing-generations-access";
import {
  createUgcCardForCompletedGeneration,
  syncUgcCardMedia,
  syncUgcCardPromptText,
} from "@/lib/web-ugc-card";
import {
  assembleVideoCatalogPrompt,
  canUseGenerationAsVideoCatalogImageSource,
  videoCatalogSourceGenerationIds,
} from "@/lib/video-catalog-prompt";
import {
  photoshootUserFacingMediaPaths,
  resolvePhotoshootUserFacingResult,
} from "@/lib/photoshoot";
import {
  buildVideoUgcMediaItems,
  firstInputPhotoPath,
  videoUgcPosterStoragePath,
} from "@/lib/ugc-card-media";
import { USER_GENERATION_PHOTOS_BUCKET } from "@/lib/user-generation-photos";

const PUBLIC_RESULTS_BUCKET = "web-generation-results";

export const OWNED_GENERATION_CARD_ACTION_SELECT =
  "id,user_id,requester_auth_user_id,status,prompt_text,result_storage_bucket,result_storage_path,edit_kind,modality,parent_generation_id,input_photo_paths,photoshoot_tile_paths,ugc_card_id";

export type OwnedGenerationForCardAction = {
  id: string;
  user_id: string;
  requester_auth_user_id: string | null;
  status: string;
  prompt_text: string;
  result_storage_bucket: string | null;
  result_storage_path: string | null;
  edit_kind: string | null;
  modality: string | null;
  parent_generation_id: string | null;
  input_photo_paths: unknown;
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
    .select(OWNED_GENERATION_CARD_ACTION_SELECT)
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

async function copyPosterToVideoResults(
  supabase: SupabaseClient,
  source: { bucket: string; path: string },
  videoPath: string,
): Promise<{ path: string; bucket: string } | null> {
  const destPath = videoUgcPosterStoragePath(videoPath);
  if (source.bucket === PUBLIC_RESULTS_BUCKET && source.path === destPath) {
    return source;
  }
  const { data: image, error: downloadError } = await supabase.storage
    .from(source.bucket)
    .download(source.path);
  if (downloadError || !image) {
    console.error("[generation-card] video poster download failed", {
      bucket: source.bucket,
      path: source.path,
      error: downloadError?.message ?? null,
    });
    return null;
  }
  const { error: uploadError } = await supabase.storage
    .from(PUBLIC_RESULTS_BUCKET)
    .upload(destPath, image, {
      contentType: image.type || "image/jpeg",
      upsert: true,
    });
  if (uploadError) {
    console.error("[generation-card] video poster upload failed", {
      destPath,
      error: uploadError.message,
    });
    return null;
  }
  return { path: destPath, bucket: PUBLIC_RESULTS_BUCKET };
}

async function resolveVideoPoster(
  supabase: SupabaseClient,
  generation: OwnedGenerationForCardAction,
): Promise<{ path: string; bucket: string } | null> {
  if (generation.parent_generation_id) {
    const { data: parent } = await supabase
      .from("landing_generations")
      .select("result_storage_bucket,result_storage_path,status")
      .eq("id", generation.parent_generation_id)
      .maybeSingle();
    const path = String(parent?.result_storage_path || "").trim();
    const bucket = String(parent?.result_storage_bucket || "").trim();
    if (parent?.status === "completed" && path && bucket) {
      return { path, bucket };
    }
  }
  const inputPath = firstInputPhotoPath(generation.input_photo_paths);
  if (!inputPath) return null;

  if (generation.requester_auth_user_id) {
    const { data: library } = await supabase
      .from("landing_user_photos")
      .select("source_generation_id")
      .eq("auth_user_id", generation.requester_auth_user_id)
      .eq("storage_path", inputPath)
      .maybeSingle();
    const sourceGenerationId = library?.source_generation_id as string | null;
    if (sourceGenerationId) {
      const { data: source } = await supabase
        .from("landing_generations")
        .select("result_storage_bucket,result_storage_path,status")
        .eq("id", sourceGenerationId)
        .maybeSingle();
      const path = String(source?.result_storage_path || "").trim();
      const bucket = String(source?.result_storage_bucket || "").trim();
      if (source?.status === "completed" && path && bucket) {
        return { path, bucket };
      }
    }
  }

  return {
    path: inputPath,
    bucket: USER_GENERATION_PHOTOS_BUCKET,
  };
}

async function resolveLibrarySourceGenerationId(
  supabase: SupabaseClient,
  generation: OwnedGenerationForCardAction,
): Promise<string | null> {
  const inputPath = firstInputPhotoPath(generation.input_photo_paths);
  if (!inputPath || !generation.requester_auth_user_id) return null;
  const { data: library } = await supabase
    .from("landing_user_photos")
    .select("source_generation_id")
    .eq("auth_user_id", generation.requester_auth_user_id)
    .eq("storage_path", inputPath)
    .maybeSingle();
  return (library?.source_generation_id as string | null) || null;
}

async function resolveVideoCatalogPrompt(
  supabase: SupabaseClient,
  generation: OwnedGenerationForCardAction,
): Promise<string> {
  const sourceIds = videoCatalogSourceGenerationIds({
    parentGenerationId: generation.parent_generation_id,
    librarySourceGenerationId: await resolveLibrarySourceGenerationId(
      supabase,
      generation,
    ),
  });
  let imagePrompt = "";
  for (const sourceId of sourceIds) {
    const { data: source } = await supabase
      .from("landing_generations")
      .select("prompt_text,modality,status")
      .eq("id", sourceId)
      .maybeSingle();
    if (
      canUseGenerationAsVideoCatalogImageSource({
        status: source?.status,
        modality: source?.modality,
        promptText: source?.prompt_text,
      })
    ) {
      imagePrompt = String(source?.prompt_text || "").trim();
      break;
    }
  }
  return assembleVideoCatalogPrompt({
    imagePrompt,
    motionPrompt: generation.prompt_text,
  });
}

export async function ensureCardForCompletedGeneration(
  supabase: SupabaseClient,
  generation: OwnedGenerationForCardAction
): Promise<GenerationCardMetadata> {
  const isVideo = generation.modality === "video";
  const facing = resolvePhotoshootUserFacingResult({
    editKind: generation.edit_kind,
    sheetPath: generation.result_storage_path,
    tilePaths: generation.photoshoot_tile_paths,
  });
  const mediaPaths = isVideo
    ? [generation.result_storage_path || ""]
    : photoshootUserFacingMediaPaths(facing);
  if (
    generation.status !== "completed" ||
    !generation.result_storage_bucket ||
    !mediaPaths.filter(Boolean).length
  ) {
    throw new Error("generation_result_not_available");
  }

  let videoItems: ReturnType<typeof buildVideoUgcMediaItems> | undefined;
  if (isVideo) {
    const videoPath = String(generation.result_storage_path || "").trim();
    const posterSource = await resolveVideoPoster(supabase, generation);
    const poster =
      posterSource && videoPath
        ? await copyPosterToVideoResults(supabase, posterSource, videoPath)
        : null;
    if (!poster || !videoPath) {
      throw new Error("video_poster_unavailable");
    }
    videoItems = buildVideoUgcMediaItems({
      posterPath: poster.path,
      videoPath,
    }).map((item) => ({
      ...item,
      bucket:
        item.mediaType === "photo"
          ? poster.bucket
          : generation.result_storage_bucket!,
    }));
    if (!videoItems.length) {
      throw new Error("video_poster_unavailable");
    }
  }

  const promptText = isVideo
    ? await resolveVideoCatalogPrompt(supabase, generation)
    : generation.prompt_text || "";

  if (generation.ugc_card_id) {
    const existing = await readGenerationCard(supabase, generation.ugc_card_id);
    if (existing) {
      if (!isVideo) {
        await syncUgcCardMedia(supabase, {
          cardId: existing.cardId,
          resultBucket: generation.result_storage_bucket,
          resultPaths: mediaPaths,
        });
      } else if (promptText) {
        await syncUgcCardPromptText(supabase, existing.cardId, promptText);
      }
      return existing;
    }
  }

  const created = await createUgcCardForCompletedGeneration(supabase, {
    generationId: generation.id,
    generationOwnerUserId: generation.user_id,
    promptText,
    resultBucket: generation.result_storage_bucket,
    resultPaths: mediaPaths,
    mediaItems: videoItems,
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
