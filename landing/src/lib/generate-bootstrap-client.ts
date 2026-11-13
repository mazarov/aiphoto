import {
  FALLBACK_GENERATION_MODELS,
  FALLBACK_VIDEO_GENERATION_MODELS,
  type GenerationModelOption,
} from "./generation-model-labels";
import {
  DEFAULT_IMAGE_ASPECT_RATIO,
  DEFAULT_IMAGE_SIZE,
  DEFAULT_VIDEO_ASPECT_RATIO,
  DEFAULT_VIDEO_DURATION_SECONDS,
  DEFAULT_VIDEO_MODEL,
  GPT_IMAGE_25_FLARE_CREDIT_COST,
  GPT_IMAGE_25_FLARE_IMAGE_MODEL,
  IMAGE_ASPECT_RATIO_OPTIONS,
  IMAGE_SIZE_OPTIONS,
} from "./generation/image-options";
import {
  pickFresherPreferences,
  readCachedGenerationPreferences,
  resolveComposerPreferences,
  writeCachedGenerationPreferences,
  type StoredGenerationPreferences,
} from "./generation-preferences";
import { readSessionChosenImageModel } from "./compose-image-model";
import {
  DEFAULT_CARD_REPEAT_REWARD_CONFIG,
  type CardRepeatRewardConfig,
} from "./publish-reward";
import { STICKER_PACK_DEFAULT_CREDIT_COST } from "./sticker-pack";
import {
  optimisticPhotoshootEnabled,
  readCachedPhotoshootEnabled,
  writeCachedPhotoshootEnabled,
} from "./photoshoot-availability";
import {
  optimisticStickerEnabled,
  readCachedStickerEnabled,
  writeCachedStickerEnabled,
} from "./sticker-availability";
import {
  readCachedVideoAnimateEnabled,
  writeCachedVideoAnimateEnabled,
} from "./video-animate-availability";
import {
  readCachedUserGenerationPhotosMeta,
  warmupPhotoPreviewImages,
  writeCachedUserGenerationPhotos,
  type CachedUserGenerationPhoto,
} from "./user-generation-photos-cache";
import {
  shouldAttachLibraryPhotos,
  type GenerateDockSeed,
} from "./generate-dock-seed";
import type { GenerateBootstrapPayload } from "./generate-bootstrap-server";

export const GENERATE_CONFIG_CACHE_KEY = "promptshot:generate-config:v1";
export const GENERATE_USER_STATE_CACHE_PREFIX =
  "promptshot:generate-user-state:v1:";
export const LAST_KNOWN_AUTH_USER_KEY = "promptshot:last-auth-user:v1";

export type CachedGenerateConfigSnapshot = {
  models: GenerationModelOption[];
  aspectRatios: Array<{ value: string; label: string }>;
  imageSizes: Array<{ value: string; label: string }>;
  defaults: {
    model: string;
    aspectRatio: string;
    imageSize: string;
  };
  limits: {
    maxPhotos: number;
  };
  videoModels: GenerationModelOption[];
  videoDefaults: {
    model: string;
    aspectRatio: string;
    durationSeconds: number;
  };
  videoEnabled: boolean;
  photoshootEnabled: boolean;
  stickerEnabled: boolean;
  stickerFromResultEnabled: boolean;
  stickerModelId: string;
  stickerCost: number;
  stickerPackEnabled: boolean;
  stickerPackCreditCost: number;
  listingVideoRepeatEnabled: boolean;
  preserveOutfitEnabled: boolean;
  composeExampleMatchEnabled: boolean;
  photoshootComposeExampleEnabled: boolean;
  cardRepeatReward: CardRepeatRewardConfig;
  updatedAtMs: number;
};

export type CachedGenerateUserState = {
  userId: string;
  credits: number | null;
  publishHidden: boolean;
  hasCompletedImageGeneration: boolean;
  updatedAtMs: number;
};

type LastKnownAuthUser = {
  id: string;
  isAnonymous: boolean;
  updatedAtMs: number;
};

let memoryConfig: CachedGenerateConfigSnapshot | null = null;
const memoryUserStates = new Map<string, CachedGenerateUserState>();
let memoryLastUser: LastKnownAuthUser | null = null;
const inflightBootstrap = new Map<
  string,
  Promise<GenerateBootstrapPayload | null>
>();

export function resetGenerateBootstrapClientForTests(): void {
  memoryConfig = null;
  memoryUserStates.clear();
  memoryLastUser = null;
  inflightBootstrap.clear();
}

export function hasLikelySupabaseSessionCookie(cookieHeader?: string | null): boolean {
  const raw =
    cookieHeader ??
    (typeof document !== "undefined" ? document.cookie : "");
  if (!raw) return false;
  return /(?:^|;\s*)sb-[^=;]+-auth-token(?:\.\d+)?=/.test(raw);
}

export function rememberLastKnownAuthUser(
  user: { id: string; isAnonymous?: boolean } | null,
): void {
  if (!user || !user.id.trim() || user.isAnonymous === true) {
    memoryLastUser = null;
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(LAST_KNOWN_AUTH_USER_KEY);
      } catch {
        /* ignore */
      }
    }
    return;
  }
  const entry: LastKnownAuthUser = {
    id: user.id.trim(),
    isAnonymous: false,
    updatedAtMs: Date.now(),
  };
  memoryLastUser = entry;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(LAST_KNOWN_AUTH_USER_KEY, JSON.stringify(entry));
    } catch {
      /* quota / private mode */
    }
  }
}

export function readLastKnownAuthUserId(): string | null {
  if (memoryLastUser && !memoryLastUser.isAnonymous) {
    return memoryLastUser.id;
  }
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LAST_KNOWN_AUTH_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LastKnownAuthUser>;
    const id = typeof parsed.id === "string" ? parsed.id.trim() : "";
    if (!id || parsed.isAnonymous === true) return null;
    memoryLastUser = {
      id,
      isAnonymous: false,
      updatedAtMs:
        typeof parsed.updatedAtMs === "number" ? parsed.updatedAtMs : 0,
    };
    return id;
  } catch {
    return null;
  }
}

/**
 * Resolve user id synchronously on Frame 0 even before `AuthContext` finishes
 * its network `getUser()` roundtrip.
 */
export function peekOptimisticAuthUserId(input: {
  user?: { id: string; is_anonymous?: boolean } | null;
  authLoading?: boolean;
  cookieHeader?: string | null;
}): string | null {
  if (input.user) {
    return input.user.is_anonymous === true ? null : input.user.id;
  }
  if (!input.authLoading) {
    return null;
  }
  if (!hasLikelySupabaseSessionCookie(input.cookieHeader)) {
    return null;
  }
  return readLastKnownAuthUserId();
}

function isModelOption(value: unknown): value is GenerationModelOption {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<GenerationModelOption>;
  return (
    typeof item.id === "string" &&
    item.id.length > 0 &&
    typeof item.label === "string" &&
    typeof item.cost === "number" &&
    Number.isFinite(item.cost)
  );
}

function parseConfigSnapshot(raw: unknown): CachedGenerateConfigSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<CachedGenerateConfigSnapshot>;
  if (!Array.isArray(value.models) || !value.models.every(isModelOption)) {
    return null;
  }
  if (!value.models.length) return null;
  return {
    models: value.models,
    aspectRatios: Array.isArray(value.aspectRatios) && value.aspectRatios.length
      ? value.aspectRatios
      : [...IMAGE_ASPECT_RATIO_OPTIONS],
    imageSizes: Array.isArray(value.imageSizes) && value.imageSizes.length
      ? value.imageSizes
      : [...IMAGE_SIZE_OPTIONS],
    defaults: {
      model:
        typeof value.defaults?.model === "string" && value.defaults.model
          ? value.defaults.model
          : value.models[0].id,
      aspectRatio:
        typeof value.defaults?.aspectRatio === "string" &&
        value.defaults.aspectRatio
          ? value.defaults.aspectRatio
          : DEFAULT_IMAGE_ASPECT_RATIO,
      imageSize:
        typeof value.defaults?.imageSize === "string" && value.defaults.imageSize
          ? value.defaults.imageSize
          : DEFAULT_IMAGE_SIZE,
    },
    limits: {
      maxPhotos:
        typeof value.limits?.maxPhotos === "number" &&
        Number.isFinite(value.limits.maxPhotos)
          ? Math.max(1, Math.min(10, value.limits.maxPhotos))
          : 4,
    },
    videoModels:
      Array.isArray(value.videoModels) &&
      value.videoModels.length &&
      value.videoModels.every(isModelOption)
        ? value.videoModels
        : [...FALLBACK_VIDEO_GENERATION_MODELS],
    videoDefaults: {
      model:
        typeof value.videoDefaults?.model === "string" &&
        value.videoDefaults.model
          ? value.videoDefaults.model
          : DEFAULT_VIDEO_MODEL,
      aspectRatio:
        typeof value.videoDefaults?.aspectRatio === "string" &&
        value.videoDefaults.aspectRatio
          ? value.videoDefaults.aspectRatio
          : DEFAULT_VIDEO_ASPECT_RATIO,
      durationSeconds:
        typeof value.videoDefaults?.durationSeconds === "number" &&
        Number.isFinite(value.videoDefaults.durationSeconds)
          ? value.videoDefaults.durationSeconds
          : DEFAULT_VIDEO_DURATION_SECONDS,
    },
    videoEnabled: value.videoEnabled === true,
    photoshootEnabled: value.photoshootEnabled === true,
    stickerEnabled: value.stickerEnabled === true,
    stickerFromResultEnabled: value.stickerFromResultEnabled === true,
    stickerModelId:
      typeof value.stickerModelId === "string" && value.stickerModelId.trim()
        ? value.stickerModelId.trim()
        : GPT_IMAGE_25_FLARE_IMAGE_MODEL,
    stickerCost:
      typeof value.stickerCost === "number" && Number.isFinite(value.stickerCost)
        ? value.stickerCost
        : GPT_IMAGE_25_FLARE_CREDIT_COST,
    stickerPackEnabled: value.stickerPackEnabled === true,
    stickerPackCreditCost:
      typeof value.stickerPackCreditCost === "number" &&
      Number.isFinite(value.stickerPackCreditCost)
        ? value.stickerPackCreditCost
        : STICKER_PACK_DEFAULT_CREDIT_COST,
    listingVideoRepeatEnabled: value.listingVideoRepeatEnabled === true,
    preserveOutfitEnabled: value.preserveOutfitEnabled === true,
    composeExampleMatchEnabled: value.composeExampleMatchEnabled === true,
    photoshootComposeExampleEnabled:
      value.photoshootComposeExampleEnabled === true,
    cardRepeatReward: value.cardRepeatReward
      ? { ...DEFAULT_CARD_REPEAT_REWARD_CONFIG, ...value.cardRepeatReward }
      : DEFAULT_CARD_REPEAT_REWARD_CONFIG,
    updatedAtMs:
      typeof value.updatedAtMs === "number" ? value.updatedAtMs : 0,
  };
}

export function readCachedGenerateConfig(): CachedGenerateConfigSnapshot | null {
  if (memoryConfig) return memoryConfig;
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(GENERATE_CONFIG_CACHE_KEY);
    if (!raw) return null;
    const parsed = parseConfigSnapshot(JSON.parse(raw));
    if (!parsed) return null;
    memoryConfig = parsed;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCachedGenerateConfig(
  snapshot: CachedGenerateConfigSnapshot,
): void {
  memoryConfig = snapshot;
  writeCachedVideoAnimateEnabled(snapshot.videoEnabled);
  writeCachedPhotoshootEnabled(snapshot.photoshootEnabled);
  writeCachedStickerEnabled(snapshot.stickerEnabled);
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      GENERATE_CONFIG_CACHE_KEY,
      JSON.stringify(snapshot),
    );
  } catch {
    /* quota / private mode */
  }
}

function userStateStorageKey(userId: string): string {
  return `${GENERATE_USER_STATE_CACHE_PREFIX}${userId}`;
}

export function readCachedGenerateUserState(
  userId: string | null | undefined,
): CachedGenerateUserState | null {
  const id = (userId || "").trim();
  if (!id) return null;
  const inMem = memoryUserStates.get(id);
  if (inMem) return inMem;
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(userStateStorageKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedGenerateUserState>;
    if (parsed.userId !== id) return null;
    const state: CachedGenerateUserState = {
      userId: id,
      credits:
        typeof parsed.credits === "number" && Number.isFinite(parsed.credits)
          ? parsed.credits
          : null,
      publishHidden: parsed.publishHidden === true,
      hasCompletedImageGeneration: parsed.hasCompletedImageGeneration === true,
      updatedAtMs:
        typeof parsed.updatedAtMs === "number" ? parsed.updatedAtMs : 0,
    };
    memoryUserStates.set(id, state);
    return state;
  } catch {
    return null;
  }
}

export function writeCachedGenerateUserState(
  state: CachedGenerateUserState,
): void {
  if (!state.userId.trim()) return;
  memoryUserStates.set(state.userId, state);
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      userStateStorageKey(state.userId),
      JSON.stringify(state),
    );
  } catch {
    /* quota / private mode */
  }
}

export function updateCachedGenerateUserCredits(
  userId: string | null | undefined,
  credits: number,
): void {
  const id = (userId || "").trim();
  if (!id || !Number.isFinite(credits)) return;
  const prev = readCachedGenerateUserState(id);
  writeCachedGenerateUserState({
    userId: id,
    credits,
    publishHidden: prev?.publishHidden ?? false,
    hasCompletedImageGeneration: prev?.hasCompletedImageGeneration ?? false,
    updatedAtMs: Date.now(),
  });
}

export function snapshotFromBootstrapPayload(
  payload: GenerateBootstrapPayload,
  nowMs = Date.now(),
): CachedGenerateConfigSnapshot {
  const { imageConfig, videoConfig } = payload;
  const models =
    Array.isArray(imageConfig.models) && imageConfig.models.length
      ? imageConfig.models
      : [...FALLBACK_GENERATION_MODELS];
  const videoModels =
    Array.isArray(videoConfig.models) && videoConfig.models.length
      ? videoConfig.models
      : [...FALLBACK_VIDEO_GENERATION_MODELS];

  return {
    models,
    aspectRatios:
      Array.isArray(imageConfig.aspectRatios) && imageConfig.aspectRatios.length
        ? [...imageConfig.aspectRatios]
        : [...IMAGE_ASPECT_RATIO_OPTIONS],
    imageSizes:
      Array.isArray(imageConfig.imageSizes) && imageConfig.imageSizes.length
        ? [...imageConfig.imageSizes]
        : [...IMAGE_SIZE_OPTIONS],
    defaults: {
      model: imageConfig.defaults?.model || models[0].id,
      aspectRatio:
        imageConfig.defaults?.aspectRatio || DEFAULT_IMAGE_ASPECT_RATIO,
      imageSize: imageConfig.defaults?.imageSize || DEFAULT_IMAGE_SIZE,
    },
    limits: {
      maxPhotos:
        typeof imageConfig.limits?.maxPhotos === "number"
          ? Math.max(1, Math.min(10, imageConfig.limits.maxPhotos))
          : 4,
    },
    videoModels,
    videoDefaults: {
      model: videoConfig.defaults?.model || DEFAULT_VIDEO_MODEL,
      aspectRatio:
        videoConfig.defaults?.aspectRatio || DEFAULT_VIDEO_ASPECT_RATIO,
      durationSeconds:
        videoConfig.defaults?.durationSeconds ?? DEFAULT_VIDEO_DURATION_SECONDS,
    },
    videoEnabled: Boolean(videoConfig.enabled),
    photoshootEnabled: Boolean(imageConfig.photoshootEnabled),
    stickerEnabled: Boolean(imageConfig.stickerEnabled),
    stickerFromResultEnabled: imageConfig.stickerFromResultEnabled === true,
    stickerModelId:
      typeof imageConfig.stickerModel?.id === "string" &&
      imageConfig.stickerModel.id.trim()
        ? imageConfig.stickerModel.id.trim()
        : GPT_IMAGE_25_FLARE_IMAGE_MODEL,
    stickerCost:
      typeof imageConfig.stickerModel?.cost === "number" &&
      Number.isFinite(imageConfig.stickerModel.cost)
        ? imageConfig.stickerModel.cost
        : GPT_IMAGE_25_FLARE_CREDIT_COST,
    stickerPackEnabled: imageConfig.stickerPackEnabled === true,
    stickerPackCreditCost:
      typeof imageConfig.stickerPackCreditCost === "number" &&
      Number.isFinite(imageConfig.stickerPackCreditCost)
        ? imageConfig.stickerPackCreditCost
        : STICKER_PACK_DEFAULT_CREDIT_COST,
    listingVideoRepeatEnabled: Boolean(imageConfig.listingVideoRepeatEnabled),
    preserveOutfitEnabled: Boolean(imageConfig.preserveOutfitEnabled),
    composeExampleMatchEnabled: Boolean(imageConfig.composeExampleMatchEnabled),
    photoshootComposeExampleEnabled: Boolean(
      imageConfig.photoshootComposeExampleEnabled,
    ),
    cardRepeatReward: imageConfig.cardRepeatReward
      ? { ...DEFAULT_CARD_REPEAT_REWARD_CONFIG, ...imageConfig.cardRepeatReward }
      : DEFAULT_CARD_REPEAT_REWARD_CONFIG,
    updatedAtMs: nowMs,
  };
}

/** Merge top-12 bootstrap photos without truncating an already-expanded (>12) session cache. */
export function mergeBootstrapLibraryPhotos(input: {
  incoming: CachedUserGenerationPhoto[];
  existing: CachedUserGenerationPhoto[] | null;
  incomingHasMore: boolean;
  existingHasMore: boolean;
}): { photos: CachedUserGenerationPhoto[]; hasMorePhotos: boolean } {
  if (!input.incomingHasMore || !input.existing || input.existing.length <= input.incoming.length) {
    return {
      photos: input.incoming,
      hasMorePhotos: input.incomingHasMore,
    };
  }
  const incomingIds = new Set(input.incoming.map((photo) => photo.id));
  const tail = input.existing.filter((photo) => !incomingIds.has(photo.id));
  return {
    photos: [...input.incoming, ...tail],
    hasMorePhotos: input.existingHasMore,
  };
}

export function persistGenerateBootstrapPayload(
  payload: GenerateBootstrapPayload,
  nowMs = Date.now(),
): CachedGenerateConfigSnapshot {
  const configSnapshot = snapshotFromBootstrapPayload(payload, nowMs);
  writeCachedGenerateConfig(configSnapshot);

  if (payload.user && !payload.user.isAnonymous && !payload.guestMode) {
    const userId = payload.user.id;
    rememberLastKnownAuthUser({ id: userId, isAnonymous: false });
    const existingMeta = readCachedUserGenerationPhotosMeta(userId);
    const mergedPhotos = mergeBootstrapLibraryPhotos({
      incoming: payload.photos ?? [],
      existing: existingMeta?.photos ?? null,
      incomingHasMore: payload.hasMorePhotos === true,
      existingHasMore: existingMeta?.hasMorePhotos === true,
    });
    writeCachedUserGenerationPhotos(userId, mergedPhotos.photos, {
      signedAt: nowMs,
      hasMorePhotos: mergedPhotos.hasMorePhotos,
    });
    warmupPhotoPreviewImages(mergedPhotos.photos);

    const fresherPrefs = pickFresherPreferences(
      payload.preferences,
      readCachedGenerationPreferences(userId),
    );
    if (fresherPrefs && fresherPrefs.model) {
      writeCachedGenerationPreferences(userId, fresherPrefs);
    }

    const prevUserState = readCachedGenerateUserState(userId);
    writeCachedGenerateUserState({
      userId,
      credits:
        typeof payload.credits === "number" && Number.isFinite(payload.credits)
          ? payload.credits
          : prevUserState?.credits ?? 0,
      publishHidden: payload.publishHidden === true,
      hasCompletedImageGeneration: Boolean(
        payload.hasCompletedImageGeneration ||
          prevUserState?.hasCompletedImageGeneration,
      ),
      updatedAtMs: nowMs,
    });
  } else if (!payload.user) {
    rememberLastKnownAuthUser(null);
  }

  return configSnapshot;
}

export type FrameZeroGenerateState = {
  hasCachedConfig: boolean;
  models: GenerationModelOption[];
  aspectRatios: Array<{ value: string; label: string }>;
  imageSizes: Array<{ value: string; label: string }>;
  maxPhotos: number;
  videoModels: GenerationModelOption[];
  model: string;
  aspectRatio: string;
  imageSize: string;
  videoModel: string;
  videoAspectRatio: string;
  videoDurationSeconds: number;
  preserveOutfit: boolean;
  photos: CachedUserGenerationPhoto[];
  hasMorePhotos: boolean;
  libraryHydratedFromCache: boolean;
  selectedPhotoIds: string[];
  credits: number | null;
  publishHidden: boolean;
  hasCompletedImageGeneration: boolean;
  videoEnabled: boolean;
  photoshootEnabled: boolean;
  stickerEnabled: boolean;
  stickerFromResultEnabled: boolean;
  stickerModelId: string;
  stickerCost: number;
  stickerPackEnabled: boolean;
  stickerPackCreditCost: number;
  listingVideoRepeatEnabled: boolean;
  preserveOutfitEnabled: boolean;
  composeExampleMatchEnabled: boolean;
  photoshootComposeExampleEnabled: boolean;
  cardRepeatReward: CardRepeatRewardConfig;
};

/**
 * Synchronous Frame-0 state computation from memory / localStorage / sessionStorage.
 * Ensures zero-FOUC controls (`model`, `selectedPhotoIds`, `credits`, flags) on mount.
 */
export function readFrameZeroGenerateState(input: {
  userId: string | null;
  pathname?: string | null;
  preferredModelId?: string | null;
  seed: GenerateDockSeed;
}): FrameZeroGenerateState {
  const config = readCachedGenerateConfig();
  const userId = input.userId?.trim() || null;
  const userState = userId ? readCachedGenerateUserState(userId) : null;
  const storedPrefs: StoredGenerationPreferences | null = userId
    ? readCachedGenerationPreferences(userId)
    : null;
  const photoMeta = userId ? readCachedUserGenerationPhotosMeta(userId) : null;

  const models = config?.models?.length
    ? config.models
    : [...FALLBACK_GENERATION_MODELS];
  const videoModels = config?.videoModels?.length
    ? config.videoModels
    : [...FALLBACK_VIDEO_GENERATION_MODELS];
  const aspectRatios = config?.aspectRatios?.length
    ? config.aspectRatios
    : [...IMAGE_ASPECT_RATIO_OPTIONS];
  const imageSizes = config?.imageSizes?.length
    ? config.imageSizes
    : [...IMAGE_SIZE_OPTIONS];

  const photos = photoMeta?.photos ?? [];
  const hasCompletedImageGeneration = Boolean(
    userState?.hasCompletedImageGeneration || storedPrefs?.model,
  );
  const preferredAvailable =
    input.preferredModelId &&
    models.some((item) => item.id === input.preferredModelId)
      ? input.preferredModelId
      : null;
  const sessionChosen = readSessionChosenImageModel();
  const sessionAvailable =
    sessionChosen && models.some((item) => item.id === sessionChosen)
      ? sessionChosen
      : null;

  const resolvedPrefs = resolveComposerPreferences({
    stored: storedPrefs,
    imageModelIds: models.map((item) => item.id),
    videoModelIds: videoModels.map((item) => item.id),
    availablePhotoIds: photos.map((photo) => photo.id),
    defaults: {
      model: config?.defaults.model ?? models[0]?.id,
      aspectRatio: config?.defaults.aspectRatio ?? DEFAULT_IMAGE_ASPECT_RATIO,
      imageSize: config?.defaults.imageSize ?? DEFAULT_IMAGE_SIZE,
      videoModel: config?.videoDefaults.model ?? DEFAULT_VIDEO_MODEL,
      videoAspectRatio:
        config?.videoDefaults.aspectRatio ?? DEFAULT_VIDEO_ASPECT_RATIO,
      videoDurationSeconds:
        config?.videoDefaults.durationSeconds ?? DEFAULT_VIDEO_DURATION_SECONDS,
    },
    hasCompletedImageGeneration,
    explicitImageModelId: preferredAvailable ?? sessionAvailable ?? null,
  });

  const selectedPhotoIds = shouldAttachLibraryPhotos(input.seed)
    ? resolvedPrefs.selectedPhotoIds
    : [];

  return {
    hasCachedConfig: config !== null,
    models,
    aspectRatios,
    imageSizes,
    maxPhotos: config?.limits.maxPhotos ?? 4,
    videoModels,
    model: resolvedPrefs.model,
    aspectRatio: resolvedPrefs.aspectRatio,
    imageSize: resolvedPrefs.imageSize,
    videoModel: resolvedPrefs.videoModel,
    videoAspectRatio: resolvedPrefs.videoAspectRatio,
    videoDurationSeconds: resolvedPrefs.videoDurationSeconds,
    preserveOutfit: resolvedPrefs.preserveOutfit,
    photos,
    hasMorePhotos: photoMeta?.hasMorePhotos === true,
    libraryHydratedFromCache: userId ? photoMeta !== null : true,
    selectedPhotoIds,
    credits: userId ? (userState?.credits ?? null) : null,
    publishHidden: userId ? (userState?.publishHidden ?? false) : false,
    hasCompletedImageGeneration,
    videoEnabled:
      config?.videoEnabled ?? (readCachedVideoAnimateEnabled() === true),
    photoshootEnabled: optimisticPhotoshootEnabled({
      pathname: input.pathname,
      cached: config ? config.photoshootEnabled : readCachedPhotoshootEnabled(),
    }),
    stickerEnabled: optimisticStickerEnabled({
      pathname: input.pathname,
      cached: config ? config.stickerEnabled : readCachedStickerEnabled(),
    }),
    stickerFromResultEnabled: config?.stickerFromResultEnabled ?? false,
    stickerModelId: config?.stickerModelId ?? GPT_IMAGE_25_FLARE_IMAGE_MODEL,
    stickerCost: config?.stickerCost ?? GPT_IMAGE_25_FLARE_CREDIT_COST,
    stickerPackEnabled: config?.stickerPackEnabled ?? false,
    stickerPackCreditCost:
      config?.stickerPackCreditCost ?? STICKER_PACK_DEFAULT_CREDIT_COST,
    listingVideoRepeatEnabled: config?.listingVideoRepeatEnabled ?? false,
    preserveOutfitEnabled: config?.preserveOutfitEnabled ?? false,
    composeExampleMatchEnabled: config?.composeExampleMatchEnabled ?? false,
    photoshootComposeExampleEnabled:
      config?.photoshootComposeExampleEnabled ?? false,
    cardRepeatReward:
      config?.cardRepeatReward ?? DEFAULT_CARD_REPEAT_REWARD_CONFIG,
  };
}

export type FetchGenerateBootstrapOptions = {
  userIdHint?: string | null;
  includeLastResult?: boolean;
  force?: boolean;
  fetchImpl?: typeof fetch;
  apiBaseUrl?: string;
  credentialsMode?: RequestCredentials;
  headers?: Record<string, string>;
};

function resolveBootstrapEndpoint(
  apiBaseUrl: string | undefined,
  includeLastResult: boolean,
): string {
  const path = includeLastResult
    ? "/api/generate/bootstrap?includeLastResult=1"
    : "/api/generate/bootstrap";
  const base = (apiBaseUrl || "").trim().replace(/\/+$/, "");
  return base ? `${base}${path}` : path;
}

export function fetchGenerateBootstrap(
  options?: FetchGenerateBootstrapOptions,
): Promise<GenerateBootstrapPayload | null> {
  const fetchFn =
    options?.fetchImpl ??
    (typeof fetch === "function" ? fetch : undefined);
  if (!fetchFn) return Promise.resolve(null);

  const userScope = options?.userIdHint?.trim() || "auto";
  const includeLast = Boolean(options?.includeLastResult);
  const exactKey = `${userScope}:${includeLast ? "1" : "0"}`;
  const supersetKey = `${userScope}:1`;

  if (!options?.force) {
    const exact = inflightBootstrap.get(exactKey);
    if (exact) return exact;
    if (!includeLast) {
      const superset = inflightBootstrap.get(supersetKey);
      if (superset) return superset;
    }
  }

  const endpoint = resolveBootstrapEndpoint(options?.apiBaseUrl, includeLast);
  let flight: Promise<GenerateBootstrapPayload | null> | null = null;
  const run = (async () => {
    try {
      const res = await fetchFn(endpoint, {
        credentials: options?.credentialsMode ?? "include",
        ...(options?.headers ? { headers: options.headers } : {}),
      });
      if (!res.ok) return null;
      const payload = (await res.json()) as GenerateBootstrapPayload;
      if (!payload || typeof payload !== "object" || !payload.imageConfig) {
        return null;
      }
      persistGenerateBootstrapPayload(payload);
      return payload;
    } catch {
      return null;
    } finally {
      if (flight && inflightBootstrap.get(exactKey) === flight) {
        inflightBootstrap.delete(exactKey);
      }
    }
  })();
  flight = run;

  inflightBootstrap.set(exactKey, run);
  return run;
}

export function prefetchGenerateBootstrap(options?: {
  userIdHint?: string | null;
  includeLastResult?: boolean;
}): void {
  if (typeof window === "undefined") return;
  void fetchGenerateBootstrap({
    userIdHint: options?.userIdHint,
    includeLastResult: options?.includeLastResult ?? Boolean(options?.userIdHint),
  });
}
