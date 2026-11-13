import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  buildImageGenerationConfigPayload,
  buildVideoGenerationConfigPayload,
  readGenerationConfigMap,
  type ImageGenerationConfigPayload,
  type VideoGenerationConfigPayload,
} from "@/lib/generation-config-cache";
import { readUserGenerationPreferences } from "@/lib/generation-preferences-server";
import type { StoredGenerationPreferences } from "@/lib/generation-preferences";
import { isStvGuestUser, STV_GUEST_VIRTUAL_CREDITS } from "@/lib/stv-guest-mode";
import { resolveSharedDbUserId } from "@/lib/resolve-db-user-id";
import { anyPublishHidden } from "@/lib/publish-access";
import {
  toUserGenerationPhotos,
  USER_GENERATION_PHOTO_ROW_SELECT,
  type UserGenerationPhoto,
  type UserGenerationPhotoRow,
} from "@/lib/user-generation-photos";
import { landingGenerationsOwnerOrFilter } from "@/lib/landing-generations-access";
import { listUserGenerations } from "@/lib/list-user-generations";
import { hasCompletedImageGenerationFromList } from "@/lib/compose-image-model";

export const BOOTSTRAP_PHOTOS_LIMIT = 12;

export type GenerateBootstrapLastGeneration = {
  id: string;
  status: string;
  prompt: string;
  model: string;
  aspectRatio: string;
  resultUrl: string;
  isPublished: boolean;
  moderationStatus: string;
  modality: string;
  resultMimeType: string | null;
  editKind: string | null;
  photoshootTileUrls: string[] | null;
};

export type GenerateBootstrapPayload = {
  user: {
    id: string;
    email: string | null;
    isAnonymous: boolean;
  } | null;
  credits: number | null;
  guestMode: boolean;
  publishHidden: boolean;
  preferences: StoredGenerationPreferences | null;
  photos: UserGenerationPhoto[];
  hasMorePhotos: boolean;
  hasCompletedImageGeneration: boolean;
  lastCompletedGeneration: GenerateBootstrapLastGeneration | null;
  imageConfig: ImageGenerationConfigPayload;
  videoConfig: VideoGenerationConfigPayload;
};

async function checkHasCompletedImageGeneration(
  supabase: SupabaseClient,
  authUserId: string,
  dbUserId: string,
): Promise<boolean> {
  const ownerFilter = landingGenerationsOwnerOrFilter(authUserId, dbUserId);
  const { data, error } = await supabase
    .from("landing_generations")
    .select("id")
    .or(ownerFilter)
    .eq("status", "completed")
    .neq("modality", "video")
    .limit(1);
  if (error) {
    console.warn("[generate-bootstrap] completed image check failed", error.message);
    return false;
  }
  return Array.isArray(data) && data.length > 0;
}

async function readBootstrapAccountAndGenerations(input: {
  supabase: SupabaseClient;
  user: User;
  includeLastResult: boolean;
}): Promise<{
  credits: number;
  publishHidden: boolean;
  hasCompletedImageGeneration: boolean;
  lastCompletedGeneration: GenerateBootstrapLastGeneration | null;
}> {
  const resolved = await resolveSharedDbUserId(input.supabase, input.user);
  const profileId = resolved?.dbUserId ?? input.user.id;
  const userIds = [...new Set([input.user.id, profileId].filter(Boolean))];

  const [usersResult, generationsResult] = await Promise.all([
    input.supabase
      .from("landing_users")
      .select("id, credits, publish_hidden")
      .in("id", userIds),
    input.includeLastResult
      ? listUserGenerations({
          supabase: input.supabase,
          authUserId: input.user.id,
          dbUserId: profileId,
          limit: 12,
          offset: 0,
        }).catch((err: unknown) => {
          console.warn(
            "[generate-bootstrap] listUserGenerations failed",
            err instanceof Error ? err.message : "unknown",
          );
          return null;
        })
      : Promise.resolve(null),
  ]);

  const userRows = (usersResult.data ?? []) as Array<{
    id?: string;
    credits?: number | null;
    publish_hidden?: boolean | null;
  }>;
  const billingRow = userRows.find((row) => row.id === profileId);
  const credits =
    typeof billingRow?.credits === "number" && Number.isFinite(billingRow.credits)
      ? billingRow.credits
      : 0;
  const publishHidden = anyPublishHidden(userRows);

  let hasCompletedImageGeneration = false;
  let lastCompletedGeneration: GenerateBootstrapLastGeneration | null = null;

  if (generationsResult) {
    hasCompletedImageGeneration = hasCompletedImageGenerationFromList(
      generationsResult.generations,
    );
    const completed = generationsResult.generations.find(
      (item) =>
        item.status === "completed" &&
        Boolean(item.resultUrl) &&
        Boolean(item.id),
    );
    if (completed && completed.resultUrl) {
      lastCompletedGeneration = {
        id: completed.id,
        status: completed.status,
        prompt: completed.prompt,
        model: completed.model,
        aspectRatio: completed.aspectRatio,
        resultUrl: completed.resultUrl,
        isPublished: completed.isPublished,
        moderationStatus: completed.moderationStatus,
        modality: completed.modality ?? "image",
        resultMimeType: completed.resultMimeType ?? null,
        editKind: completed.editKind ?? null,
        photoshootTileUrls: completed.photoshootTileUrls ?? null,
      };
    }
    if (!hasCompletedImageGeneration && generationsResult.hasMore) {
      hasCompletedImageGeneration = await checkHasCompletedImageGeneration(
        input.supabase,
        input.user.id,
        profileId,
      );
    }
  } else {
    hasCompletedImageGeneration = await checkHasCompletedImageGeneration(
      input.supabase,
      input.user.id,
      profileId,
    );
  }

  return {
    credits,
    publishHidden,
    hasCompletedImageGeneration,
    lastCompletedGeneration,
  };
}

async function readBootstrapPhotos(input: {
  supabase: SupabaseClient;
  authUserId: string;
  selectedPhotoIds: readonly string[];
  topRows: UserGenerationPhotoRow[];
  hasMorePhotos: boolean;
}): Promise<UserGenerationPhoto[]> {
  let rowsToSign = input.topRows;

  if (input.hasMorePhotos && input.selectedPhotoIds.length > 0) {
    const presentIds = new Set(rowsToSign.map((row) => row.id));
    const missingIds = input.selectedPhotoIds.filter((id) => !presentIds.has(id));
    if (missingIds.length > 0) {
      const { data: extraRows, error } = await input.supabase
        .from("landing_user_photos")
        .select(USER_GENERATION_PHOTO_ROW_SELECT)
        .eq("auth_user_id", input.authUserId)
        .in("id", missingIds.slice(0, 10));
      if (!error && Array.isArray(extraRows) && extraRows.length > 0) {
        rowsToSign = [...rowsToSign, ...(extraRows as UserGenerationPhotoRow[])];
      }
    }
  }

  return toUserGenerationPhotos(input.supabase, rowsToSign);
}

export async function loadGenerateBootstrapPayload(input: {
  supabase: SupabaseClient;
  user: User | null;
  includeLastResult?: boolean;
}): Promise<GenerateBootstrapPayload> {
  const { supabase, user, includeLastResult = false } = input;

  if (!user) {
    const configMap = await readGenerationConfigMap(supabase);
    return {
      user: null,
      credits: null,
      guestMode: false,
      publishHidden: false,
      preferences: null,
      photos: [],
      hasMorePhotos: false,
      hasCompletedImageGeneration: false,
      lastCompletedGeneration: null,
      imageConfig: buildImageGenerationConfigPayload(configMap, null),
      videoConfig: buildVideoGenerationConfigPayload(configMap, null),
    };
  }

  const guestMode = isStvGuestUser(user);
  if (guestMode) {
    const configMap = await readGenerationConfigMap(supabase);
    return {
      user: {
        id: user.id,
        email: user.email ?? null,
        isAnonymous: user.is_anonymous === true,
      },
      credits: STV_GUEST_VIRTUAL_CREDITS,
      guestMode: true,
      publishHidden: false,
      preferences: null,
      photos: [],
      hasMorePhotos: false,
      hasCompletedImageGeneration: false,
      lastCompletedGeneration: null,
      imageConfig: buildImageGenerationConfigPayload(configMap, user.email),
      videoConfig: buildVideoGenerationConfigPayload(configMap, user.email),
    };
  }

  const [configMap, preferences, photosQuery, accountAndGenerations] =
    await Promise.all([
      readGenerationConfigMap(supabase),
      readUserGenerationPreferences(supabase, user.id).catch((err: unknown) => {
        console.warn(
          "[generate-bootstrap] preferences read failed",
          err instanceof Error ? err.message : "unknown",
        );
        return null;
      }),
      supabase
        .from("landing_user_photos")
        .select(USER_GENERATION_PHOTO_ROW_SELECT)
        .eq("auth_user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(BOOTSTRAP_PHOTOS_LIMIT + 1),
      readBootstrapAccountAndGenerations({
        supabase,
        user,
        includeLastResult,
      }),
    ]);

  if (photosQuery.error) {
    console.warn(
      "[generate-bootstrap] user photos list failed",
      photosQuery.error.message,
    );
  }
  const rawPhotoRows = (photosQuery.data ?? []) as UserGenerationPhotoRow[];
  const hasMorePhotos = rawPhotoRows.length > BOOTSTRAP_PHOTOS_LIMIT;
  const topRows = rawPhotoRows.slice(0, BOOTSTRAP_PHOTOS_LIMIT);
  const photos = await readBootstrapPhotos({
    supabase,
    authUserId: user.id,
    selectedPhotoIds: preferences?.selectedPhotoIds ?? [],
    topRows,
    hasMorePhotos,
  });

  return {
    user: {
      id: user.id,
      email: user.email ?? null,
      isAnonymous: user.is_anonymous === true,
    },
    credits: accountAndGenerations.credits,
    guestMode: false,
    publishHidden: accountAndGenerations.publishHidden,
    preferences,
    photos,
    hasMorePhotos,
    hasCompletedImageGeneration: accountAndGenerations.hasCompletedImageGeneration,
    lastCompletedGeneration: accountAndGenerations.lastCompletedGeneration,
    imageConfig: buildImageGenerationConfigPayload(configMap, user.email),
    videoConfig: buildVideoGenerationConfigPayload(configMap, user.email),
  };
}
