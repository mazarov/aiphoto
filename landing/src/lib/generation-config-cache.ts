import { createSingleFlight } from "@/lib/visual-search-cache";
import {
  parseEnabledGenerationModels,
  parseEnabledVideoGenerationModels,
  type GenerationModelOption,
} from "@/lib/generation-model-labels";
import {
  isVideoAnimateUnlocked,
  resolveVideoModelId,
} from "@/lib/video-generation-contract";
import {
  isCameraOrbitUnlocked,
  resolveCameraOrbitModel,
} from "@/lib/camera-orbit-access";
import { PHOTOSHOOT_CREDIT_COST } from "@/lib/photoshoot";
import {
  isPhotoshootUnlocked,
  resolvePhotoshootModel,
} from "@/lib/photoshoot-access";
import {
  STICKER_CONFIG_ENABLED_KEY,
  STICKER_CONFIG_MODEL_KEY,
  STICKER_FROM_RESULT_CONFIG_ENABLED_KEY,
  resolveStickerModel,
} from "@/lib/sticker";
import {
  isStickerFromResultUnlocked,
  isStickerPackUnlocked,
  isStickerUnlocked,
} from "@/lib/sticker-access";
import {
  EXTENSION_LITE_GENERATE_CONFIG_KEY,
  isExtensionLiteGenerateUnlocked,
} from "@/lib/extension-lite-access";
import {
  STICKER_PACK_CONFIG_COST_KEY,
  STICKER_PACK_CONFIG_ENABLED_KEY,
  STICKER_PACK_CONFIG_MODEL_KEY,
  STICKER_PACK_COUNT,
  parseStickerPackCreditCost,
} from "@/lib/sticker-pack";
import {
  parseCardRepeatRewardConfig,
  parsePublishRewardConfig,
  type CardRepeatRewardConfig,
  type PublishRewardConfig,
} from "@/lib/publish-reward";
import { LISTING_VIDEO_REPEAT_CONFIG_KEY } from "@/lib/listing-video-repeat";
import { isListingVideoRepeatUnlocked } from "@/lib/listing-video-repeat-access";
import { PRESERVE_OUTFIT_CONFIG_KEY } from "@/lib/wardrobe-policy";
import { isPreserveOutfitUnlocked } from "@/lib/wardrobe-policy-access";
import { COMPOSE_EXAMPLE_MATCH_CONFIG_KEY } from "@/lib/compose-example-audience";
import { isComposeExampleMatchUnlocked } from "@/lib/compose-example-match-access";
import {
  PHOTOSHOOT_COMPOSE_EXAMPLE_CONFIG_KEY,
  isPhotoshootComposeExampleUnlocked,
} from "@/lib/photoshoot-compose-example";
import {
  DEFAULT_IMAGE_ASPECT_RATIO,
  DEFAULT_IMAGE_SIZE,
  DEFAULT_VIDEO_ASPECT_RATIO,
  DEFAULT_VIDEO_DURATION_SECONDS,
  DEFAULT_VIDEO_MODEL,
  DEFAULT_VIDEO_RESOLUTION,
  IMAGE_ASPECT_RATIO_OPTIONS,
  IMAGE_GENERATION_MODALITY,
  IMAGE_SIZE_OPTIONS,
  VIDEO_ASPECT_RATIO_OPTIONS,
  VIDEO_DURATION_OPTIONS,
  VIDEO_GENERATION_MODALITY,
  VIDEO_QUANTITY,
  VIDEO_RESOLUTION_OPTIONS,
} from "@/lib/generation/image-options";

export const GENERATION_CONFIG_CACHE_TTL_MS = 30_000;
export const GENERATION_CONFIG_ERROR_RETRY_MS = 5_000;

export const GENERATION_CONFIG_KEYS = [
  "models",
  "default_model",
  "default_aspect_ratio",
  "default_image_size",
  "max_photos",
  "max_file_size_mb",
  "min_prompt_length",
  "video_models",
  "video_animate_enabled",
  "default_video_model",
  "camera_orbit_enabled",
  "camera_orbit_model",
  "photoshoot_enabled",
  "photoshoot_model",
  STICKER_CONFIG_ENABLED_KEY,
  STICKER_CONFIG_MODEL_KEY,
  STICKER_FROM_RESULT_CONFIG_ENABLED_KEY,
  STICKER_PACK_CONFIG_ENABLED_KEY,
  STICKER_PACK_CONFIG_COST_KEY,
  STICKER_PACK_CONFIG_MODEL_KEY,
  "publish_reward_enabled",
  "publish_reward_photo",
  "publish_reward_video",
  "publish_reward_photoshoot",
  "publish_reward_daily_cap",
  "card_repeat_reward_enabled",
  "card_repeat_reward_credits",
  "card_repeat_reward_max_per_card",
  LISTING_VIDEO_REPEAT_CONFIG_KEY,
  PRESERVE_OUTFIT_CONFIG_KEY,
  COMPOSE_EXAMPLE_MATCH_CONFIG_KEY,
  PHOTOSHOOT_COMPOSE_EXAMPLE_CONFIG_KEY,
  EXTENSION_LITE_GENERATE_CONFIG_KEY,
] as const;

type ConfigRow = {
  key?: unknown;
  value?: unknown;
};

type ConfigSelectChain = {
  in(
    column: string,
    values: readonly string[],
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export type GenerationConfigTableReader = {
  from: (table: string) => {
    select(columns: string): ConfigSelectChain;
  };
};

export type ImageGenerationConfigPayload = {
  modality: typeof IMAGE_GENERATION_MODALITY;
  cameraOrbitEnabled: boolean;
  cameraOrbitModel: GenerationModelOption | null;
  photoshootEnabled: boolean;
  photoshootCreditCost: number;
  photoshootModel: GenerationModelOption | null;
  stickerEnabled: boolean;
  stickerFromResultEnabled: boolean;
  stickerModel: GenerationModelOption | null;
  stickerPackEnabled: boolean;
  stickerPackCreditCost: number;
  stickerPackCount: number;
  stickerPackModel: GenerationModelOption | null;
  models: GenerationModelOption[];
  aspectRatios: typeof IMAGE_ASPECT_RATIO_OPTIONS;
  imageSizes: typeof IMAGE_SIZE_OPTIONS;
  defaults: {
    model: string;
    aspectRatio: string;
    imageSize: string;
  };
  limits: {
    maxPhotos: number;
    maxFileSizeMb: number;
    minPromptLength: number;
  };
  listingVideoRepeatEnabled: boolean;
  preserveOutfitEnabled: boolean;
  composeExampleMatchEnabled: boolean;
  photoshootComposeExampleEnabled: boolean;
  extensionLiteGenerateEnabled: boolean;
  publishReward: PublishRewardConfig;
  cardRepeatReward: CardRepeatRewardConfig;
};

export type VideoGenerationConfigPayload = {
  modality: typeof VIDEO_GENERATION_MODALITY;
  enabled: boolean;
  models: GenerationModelOption[];
  aspectRatios: typeof VIDEO_ASPECT_RATIO_OPTIONS;
  durations: typeof VIDEO_DURATION_OPTIONS;
  resolutions: typeof VIDEO_RESOLUTION_OPTIONS;
  imageSizes: typeof VIDEO_RESOLUTION_OPTIONS;
  defaults: {
    model: string;
    aspectRatio: string;
    imageSize: string;
    durationSeconds: number;
  };
  limits: {
    maxPhotos: number;
    quantity: number;
    minPromptLength: number;
  };
  listingVideoRepeatEnabled: boolean;
  preserveOutfitEnabled: boolean;
  composeExampleMatchEnabled: boolean;
  photoshootComposeExampleEnabled: boolean;
  extensionLiteGenerateEnabled: boolean;
  publishReward: PublishRewardConfig;
  cardRepeatReward: CardRepeatRewardConfig;
};

let cachedConfig: { value: Record<string, string>; expiresAt: number } | null = null;
let lastKnownConfig: Record<string, string> | null = null;
const configFlight = createSingleFlight<Record<string, string>>();

export function invalidateGenerationConfigCache(): void {
  cachedConfig = null;
}

export function resetGenerationConfigCacheForTests(): void {
  cachedConfig = null;
  lastKnownConfig = null;
}

export async function readGenerationConfigMap(
  supabase: unknown,
  nowMs = Date.now(),
): Promise<Record<string, string>> {
  if (cachedConfig && cachedConfig.expiresAt > nowMs) {
    return cachedConfig.value;
  }

  const reader = supabase as GenerationConfigTableReader | null | undefined;
  if (!reader || typeof reader.from !== "function") {
    if (lastKnownConfig) return lastKnownConfig;
    throw new Error("invalid_supabase_reader");
  }

  return configFlight.run("landing_generation_config", async () => {
    const freshNow = nowMs;
    if (cachedConfig && cachedConfig.expiresAt > freshNow) {
      return cachedConfig.value;
    }

    const { data, error } = await reader
      .from("landing_generation_config")
      .select("key, value")
      .in("key", GENERATION_CONFIG_KEYS);

    if (error) {
      if (lastKnownConfig) {
        console.warn("[generation-config-cache] read failed, serving stale copy", {
          message: error.message.slice(0, 160),
        });
        cachedConfig = {
          value: lastKnownConfig,
          expiresAt: freshNow + GENERATION_CONFIG_ERROR_RETRY_MS,
        };
        return lastKnownConfig;
      }
      throw new Error(error.message || "generation_config_read_failed");
    }

    const map: Record<string, string> = {};
    if (Array.isArray(data)) {
      for (const row of data as ConfigRow[]) {
        const key = typeof row?.key === "string" ? row.key.trim() : "";
        if (!key) continue;
        map[key] = typeof row?.value === "string" ? row.value : String(row?.value ?? "");
      }
    }

    lastKnownConfig = map;
    cachedConfig = {
      value: map,
      expiresAt: freshNow + GENERATION_CONFIG_CACHE_TTL_MS,
    };
    return map;
  });
}

function buildSharedFlags(config: Record<string, string>, userEmail?: string | null) {
  return {
    publishReward: parsePublishRewardConfig(config),
    cardRepeatReward: parseCardRepeatRewardConfig(config),
    listingVideoRepeatEnabled: isListingVideoRepeatUnlocked(
      config[LISTING_VIDEO_REPEAT_CONFIG_KEY],
      userEmail ?? undefined,
    ),
    preserveOutfitEnabled: isPreserveOutfitUnlocked(
      config[PRESERVE_OUTFIT_CONFIG_KEY],
      userEmail ?? undefined,
    ),
    composeExampleMatchEnabled: isComposeExampleMatchUnlocked(
      config[COMPOSE_EXAMPLE_MATCH_CONFIG_KEY],
      userEmail ?? undefined,
    ),
    photoshootComposeExampleEnabled: isPhotoshootComposeExampleUnlocked(
      config[PHOTOSHOOT_COMPOSE_EXAMPLE_CONFIG_KEY],
      userEmail ?? undefined,
    ),
    extensionLiteGenerateEnabled: isExtensionLiteGenerateUnlocked(
      config[EXTENSION_LITE_GENERATE_CONFIG_KEY],
      userEmail ?? undefined,
    ),
  };
}

export function buildVideoGenerationConfigPayload(
  config: Record<string, string>,
  userEmail?: string | null,
): VideoGenerationConfigPayload {
  const shared = buildSharedFlags(config, userEmail);
  const models = parseEnabledVideoGenerationModels(config.video_models);
  return {
    modality: VIDEO_GENERATION_MODALITY,
    enabled: isVideoAnimateUnlocked(config.video_animate_enabled, userEmail ?? undefined),
    models,
    aspectRatios: VIDEO_ASPECT_RATIO_OPTIONS,
    durations: VIDEO_DURATION_OPTIONS,
    resolutions: VIDEO_RESOLUTION_OPTIONS,
    imageSizes: VIDEO_RESOLUTION_OPTIONS,
    defaults: {
      model:
        resolveVideoModelId(
          DEFAULT_VIDEO_MODEL,
          models.map((item) => item.id),
        ) || DEFAULT_VIDEO_MODEL,
      aspectRatio: DEFAULT_VIDEO_ASPECT_RATIO,
      imageSize: DEFAULT_VIDEO_RESOLUTION,
      durationSeconds: DEFAULT_VIDEO_DURATION_SECONDS,
    },
    limits: {
      maxPhotos: 1,
      quantity: VIDEO_QUANTITY,
      minPromptLength: parseInt(config.min_prompt_length || "8", 10),
    },
    ...shared,
  };
}

export function buildImageGenerationConfigPayload(
  config: Record<string, string>,
  userEmail?: string | null,
): ImageGenerationConfigPayload {
  const shared = buildSharedFlags(config, userEmail);
  const models = parseEnabledGenerationModels(config.models);
  const cameraOrbitModel = resolveCameraOrbitModel(config.camera_orbit_model, models);
  const photoshootModel = resolvePhotoshootModel(config.photoshoot_model, models);
  const stickerModel = resolveStickerModel(
    config[STICKER_CONFIG_MODEL_KEY],
    config.default_model,
    models,
  );
  const stickerPackCreditCost = parseStickerPackCreditCost(
    config[STICKER_PACK_CONFIG_COST_KEY],
  );
  const stickerPackModel = resolveStickerModel(
    config[STICKER_PACK_CONFIG_MODEL_KEY] || config[STICKER_CONFIG_MODEL_KEY],
    config.default_model,
    models,
  );

  return {
    modality: IMAGE_GENERATION_MODALITY,
    cameraOrbitEnabled: isCameraOrbitUnlocked(
      config.camera_orbit_enabled,
      userEmail ?? undefined,
    ),
    cameraOrbitModel,
    photoshootEnabled: isPhotoshootUnlocked(
      config.photoshoot_enabled,
      userEmail ?? undefined,
    ),
    photoshootCreditCost: PHOTOSHOOT_CREDIT_COST,
    photoshootModel: photoshootModel
      ? { ...photoshootModel, cost: PHOTOSHOOT_CREDIT_COST }
      : null,
    stickerEnabled: isStickerUnlocked(
      config[STICKER_CONFIG_ENABLED_KEY],
      userEmail ?? undefined,
    ),
    stickerFromResultEnabled: isStickerFromResultUnlocked(
      config[STICKER_FROM_RESULT_CONFIG_ENABLED_KEY],
      userEmail ?? undefined,
    ),
    stickerModel,
    stickerPackEnabled: isStickerPackUnlocked(
      config[STICKER_PACK_CONFIG_ENABLED_KEY],
      userEmail ?? undefined,
    ),
    stickerPackCreditCost,
    stickerPackCount: STICKER_PACK_COUNT,
    stickerPackModel: stickerPackModel
      ? { ...stickerPackModel, cost: stickerPackCreditCost }
      : null,
    models,
    aspectRatios: IMAGE_ASPECT_RATIO_OPTIONS,
    imageSizes: IMAGE_SIZE_OPTIONS,
    defaults: {
      model: config.default_model || "gemini-2.5-flash-image",
      aspectRatio: config.default_aspect_ratio || DEFAULT_IMAGE_ASPECT_RATIO,
      imageSize: config.default_image_size || DEFAULT_IMAGE_SIZE,
    },
    limits: {
      maxPhotos: parseInt(config.max_photos || "4", 10),
      maxFileSizeMb: parseInt(config.max_file_size_mb || "10", 10),
      minPromptLength: parseInt(config.min_prompt_length || "8", 10),
    },
    ...shared,
  };
}
