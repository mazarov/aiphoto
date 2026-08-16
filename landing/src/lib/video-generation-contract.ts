import {
  DEFAULT_VIDEO_ASPECT_RATIO,
  DEFAULT_VIDEO_DURATION_SECONDS,
  DEFAULT_VIDEO_MODEL,
  DEFAULT_VIDEO_RESOLUTION,
  VIDEO_GENERATION_MODALITY,
  isVideoAspectRatio,
  isVideoDurationSeconds,
  isVideoResolution,
} from "@/lib/generation/image-options";

export const VIDEO_RESULT_MIME = "video/mp4";

export type VideoGenerationSourceError =
  | "video_source_required"
  | "video_source_conflict"
  | "video_text_only_forbidden"
  | "video_edit_forbidden"
  | "video_parent_must_be_image";

export function normalizeVideoDurationSeconds(value: unknown): number {
  const parsed = typeof value === "string" ? Number(value) : value;
  return isVideoDurationSeconds(parsed) ? parsed : DEFAULT_VIDEO_DURATION_SECONDS;
}

export function resolveVideoAspectRatio(value: unknown): string {
  return isVideoAspectRatio(value) ? value : DEFAULT_VIDEO_ASPECT_RATIO;
}

export function resolveVideoResolution(value: unknown): string {
  return isVideoResolution(value) ? value : DEFAULT_VIDEO_RESOLUTION;
}

export function resolveVideoModelId(
  requested: unknown,
  enabledIds: readonly string[]
): string | null {
  if (typeof requested === "string" && enabledIds.includes(requested)) {
    return requested;
  }
  if (enabledIds.includes(DEFAULT_VIDEO_MODEL)) return DEFAULT_VIDEO_MODEL;
  return enabledIds[0] ?? null;
}

export function validateVideoGenerationSource(input: {
  hasParentGeneration: boolean;
  photoCount: number;
  editInstruction?: string;
  parentModality?: string | null;
}): VideoGenerationSourceError | null {
  if (input.editInstruction) return "video_edit_forbidden";
  if (input.hasParentGeneration && input.photoCount > 0) return "video_source_conflict";
  if (!input.hasParentGeneration && input.photoCount === 0) {
    return "video_text_only_forbidden";
  }
  if (!input.hasParentGeneration && input.photoCount !== 1) {
    return "video_source_required";
  }
  if (
    input.hasParentGeneration &&
    input.parentModality &&
    input.parentModality !== "image"
  ) {
    return "video_parent_must_be_image";
  }
  return null;
}

export function videoSourceErrorMessage(error: VideoGenerationSourceError): string {
  switch (error) {
    case "video_edit_forbidden":
      return "Оживление не совмещается с локальным изменением картинки";
    case "video_source_conflict":
      return "Укажите либо исходное фото, либо предыдущую генерацию";
    case "video_text_only_forbidden":
      return "Для оживления нужно одно фото";
    case "video_source_required":
      return "Для оживления нужно ровно одно фото";
    case "video_parent_must_be_image":
      return "Оживить можно только готовое фото";
  }
}

export function isVideoModality(value: unknown): boolean {
  return value === VIDEO_GENERATION_MODALITY;
}

export function isVideoAnimateFlagOn(value: string | undefined): boolean {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

/** Prod follows `video_animate_enabled`. Local `next dev` unlocks the CTA so we can smoke-test. */
export function isVideoAnimateUnlocked(value: string | undefined): boolean {
  return isVideoAnimateFlagOn(value) || process.env.NODE_ENV === "development";
}
