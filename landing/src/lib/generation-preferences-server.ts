import type { SupabaseClient } from "@supabase/supabase-js";
import { serializeUnknownError } from "@/lib/analyze-history";
import {
  parseStoredGenerationPreferences,
  type StoredGenerationPreferences,
} from "@/lib/generation-preferences";

export function isMissingPreferencesTable(error: unknown): boolean {
  const serialized = serializeUnknownError(error);
  return /does not exist|42P01|PGRST205/i.test(
    `${serialized.message} ${serialized.code} ${serialized.details}`,
  );
}

export function isMissingVideoPreferenceColumns(error: unknown): boolean {
  const serialized = serializeUnknownError(error);
  return /video_model|video_aspect_ratio|video_duration_seconds|42703|PGRST204/i.test(
    `${serialized.message} ${serialized.code} ${serialized.details}`,
  );
}

export function isMissingPreserveOutfitColumn(error: unknown): boolean {
  const serialized = serializeUnknownError(error);
  return /preserve_outfit/i.test(
    `${serialized.message} ${serialized.code} ${serialized.details}`,
  );
}

const PREFS_SELECT_FULL =
  "model,aspect_ratio,image_size,selected_photo_ids,video_model,video_aspect_ratio,video_duration_seconds,preserve_outfit,updated_at";
const PREFS_SELECT_VIDEO =
  "model,aspect_ratio,image_size,selected_photo_ids,video_model,video_aspect_ratio,video_duration_seconds,updated_at";
const PREFS_SELECT_CORE =
  "model,aspect_ratio,image_size,selected_photo_ids,updated_at";

type PreferencesTableRow = Record<string, unknown>;

function asPreferencesTableRow(row: object | null): PreferencesTableRow | null {
  return row ? ({ ...row } as PreferencesTableRow) : null;
}

export function mapPreferencesRow(
  data: PreferencesTableRow | null,
): StoredGenerationPreferences | null {
  if (!data) return null;
  return parseStoredGenerationPreferences({
    model: data.model,
    aspectRatio: data.aspect_ratio,
    imageSize: data.image_size,
    selectedPhotoIds: data.selected_photo_ids,
    videoModel: data.video_model,
    videoAspectRatio: data.video_aspect_ratio,
    videoDurationSeconds: data.video_duration_seconds,
    preserveOutfit: data.preserve_outfit,
    updatedAt: data.updated_at,
  });
}

export async function loadPreferencesRow(
  supabase: SupabaseClient,
  authUserId: string,
) {
  const full = await supabase
    .from("landing_generation_preferences")
    .select(PREFS_SELECT_FULL)
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (!full.error) {
    return { data: asPreferencesTableRow(full.data), error: full.error };
  }
  if (isMissingPreserveOutfitColumn(full.error)) {
    const video = await supabase
      .from("landing_generation_preferences")
      .select(PREFS_SELECT_VIDEO)
      .eq("auth_user_id", authUserId)
      .maybeSingle();
    if (!video.error || !isMissingVideoPreferenceColumns(video.error)) {
      return { data: asPreferencesTableRow(video.data), error: video.error };
    }
  } else if (!isMissingVideoPreferenceColumns(full.error)) {
    return { data: asPreferencesTableRow(full.data), error: full.error };
  }

  const core = await supabase
    .from("landing_generation_preferences")
    .select(PREFS_SELECT_CORE)
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  return { data: asPreferencesTableRow(core.data), error: core.error };
}

export async function readUserGenerationPreferences(
  supabase: SupabaseClient,
  authUserId: string,
): Promise<StoredGenerationPreferences | null> {
  const { data, error } = await loadPreferencesRow(supabase, authUserId);
  if (error) {
    if (isMissingPreferencesTable(error)) {
      return null;
    }
    throw error;
  }
  return mapPreferencesRow(data);
}
