import { restoreSelectedPhotoIds } from "@/lib/generation-enqueue-core";
import {
  DEFAULT_IMAGE_ASPECT_RATIO,
  DEFAULT_IMAGE_SIZE,
  DEFAULT_VIDEO_ASPECT_RATIO,
  DEFAULT_VIDEO_DURATION_SECONDS,
  DEFAULT_VIDEO_MODEL,
  clampImageSizeForModel,
  isImageAspectRatio,
  isImageSize,
  isVideoAspectRatio,
  isVideoDurationSeconds,
} from "@/lib/generation/image-options";
import {
  normalizeVideoDurationSeconds,
  resolveVideoModelId,
} from "@/lib/video-generation-contract";

export const GENERATION_PREFS_STORAGE_PREFIX = "promptshot:generation-prefs:v1:";

export type StoredGenerationPreferences = {
  model: string;
  aspectRatio: string;
  imageSize: string;
  selectedPhotoIds: string[];
  videoModel: string;
  videoAspectRatio: string;
  videoDurationSeconds: number;
  updatedAt: string;
};

export type ComposerPreferenceDefaults = {
  model: string;
  aspectRatio: string;
  imageSize: string;
  videoModel: string;
  videoAspectRatio: string;
  videoDurationSeconds: number;
};

export const FALLBACK_COMPOSER_DEFAULTS: ComposerPreferenceDefaults = {
  model: "gemini-2.5-flash-image",
  aspectRatio: DEFAULT_IMAGE_ASPECT_RATIO,
  imageSize: DEFAULT_IMAGE_SIZE,
  videoModel: DEFAULT_VIDEO_MODEL,
  videoAspectRatio: DEFAULT_VIDEO_ASPECT_RATIO,
  videoDurationSeconds: DEFAULT_VIDEO_DURATION_SECONDS,
};

export function generationPrefsStorageKey(userId: string): string {
  return `${GENERATION_PREFS_STORAGE_PREFIX}${userId}`;
}

export function parseStoredGenerationPreferences(
  raw: unknown
): StoredGenerationPreferences | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const model = typeof value.model === "string" ? value.model.trim() : "";
  if (!model) return null;
  const selectedPhotoIds = Array.isArray(value.selectedPhotoIds)
    ? value.selectedPhotoIds.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];
  const videoDurationRaw = value.videoDurationSeconds;
  const videoDurationSeconds =
    typeof videoDurationRaw === "number"
      ? videoDurationRaw
      : typeof videoDurationRaw === "string"
        ? Number(videoDurationRaw)
        : NaN;
  return {
    model,
    aspectRatio:
      typeof value.aspectRatio === "string" ? value.aspectRatio : FALLBACK_COMPOSER_DEFAULTS.aspectRatio,
    imageSize:
      typeof value.imageSize === "string" ? value.imageSize : FALLBACK_COMPOSER_DEFAULTS.imageSize,
    selectedPhotoIds,
    videoModel:
      typeof value.videoModel === "string" && value.videoModel.trim()
        ? value.videoModel.trim()
        : FALLBACK_COMPOSER_DEFAULTS.videoModel,
    videoAspectRatio:
      typeof value.videoAspectRatio === "string"
        ? value.videoAspectRatio
        : FALLBACK_COMPOSER_DEFAULTS.videoAspectRatio,
    videoDurationSeconds: Number.isFinite(videoDurationSeconds)
      ? videoDurationSeconds
      : FALLBACK_COMPOSER_DEFAULTS.videoDurationSeconds,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : "",
  };
}

export function pickFresherPreferences(
  server: StoredGenerationPreferences | null,
  cached: StoredGenerationPreferences | null
): StoredGenerationPreferences | null {
  if (!server) return cached;
  if (!cached) return server;
  const serverAt = Date.parse(server.updatedAt || "");
  const cachedAt = Date.parse(cached.updatedAt || "");
  if (Number.isFinite(cachedAt) && (!Number.isFinite(serverAt) || cachedAt > serverAt)) {
    return cached;
  }
  return server;
}

export function resolveComposerPreferences(input: {
  stored: StoredGenerationPreferences | null;
  imageModelIds: readonly string[];
  videoModelIds: readonly string[];
  availablePhotoIds: readonly string[];
  defaults?: Partial<ComposerPreferenceDefaults>;
}): StoredGenerationPreferences {
  const defaults = { ...FALLBACK_COMPOSER_DEFAULTS, ...input.defaults };
  const stored = input.stored;
  const imageIds = input.imageModelIds;
  const model =
    stored && imageIds.includes(stored.model)
      ? stored.model
      : imageIds.includes(defaults.model)
        ? defaults.model
        : imageIds[0] || defaults.model;
  const aspectRatio =
    stored && isImageAspectRatio(stored.aspectRatio)
      ? stored.aspectRatio
      : isImageAspectRatio(defaults.aspectRatio)
        ? defaults.aspectRatio
        : FALLBACK_COMPOSER_DEFAULTS.aspectRatio;
  const rawSize =
    stored && isImageSize(stored.imageSize) ? stored.imageSize : defaults.imageSize;
  const videoModel =
    resolveVideoModelId(stored?.videoModel || defaults.videoModel, input.videoModelIds) ||
    defaults.videoModel;
  const videoAspectRatio =
    stored && isVideoAspectRatio(stored.videoAspectRatio)
      ? stored.videoAspectRatio
      : isVideoAspectRatio(defaults.videoAspectRatio)
        ? defaults.videoAspectRatio
        : FALLBACK_COMPOSER_DEFAULTS.videoAspectRatio;
  const rawDuration =
    stored && isVideoDurationSeconds(stored.videoDurationSeconds)
      ? stored.videoDurationSeconds
      : isVideoDurationSeconds(defaults.videoDurationSeconds)
        ? defaults.videoDurationSeconds
        : FALLBACK_COMPOSER_DEFAULTS.videoDurationSeconds;

  return {
    model,
    aspectRatio,
    imageSize: clampImageSizeForModel(model, rawSize),
    selectedPhotoIds: restoreSelectedPhotoIds({
      availablePhotoIds: [...input.availablePhotoIds],
      storedPhotoIds: stored ? stored.selectedPhotoIds : undefined,
    }),
    videoModel,
    videoAspectRatio,
    videoDurationSeconds: normalizeVideoDurationSeconds(rawDuration, videoModel),
    updatedAt: stored?.updatedAt || "",
  };
}

export function readCachedGenerationPreferences(
  userId: string
): StoredGenerationPreferences | null {
  if (typeof window === "undefined" || !userId) return null;
  try {
    const raw = window.localStorage.getItem(generationPrefsStorageKey(userId));
    if (!raw) return null;
    return parseStoredGenerationPreferences(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeCachedGenerationPreferences(
  userId: string,
  prefs: StoredGenerationPreferences
): void {
  if (typeof window === "undefined" || !userId) return;
  try {
    window.localStorage.setItem(
      generationPrefsStorageKey(userId),
      JSON.stringify(prefs)
    );
  } catch {
    // Quota / private mode — server row remains the durable copy.
  }
}
