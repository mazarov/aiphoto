export const IMAGE_GENERATION_MODALITY = "image" as const;
export const VIDEO_GENERATION_MODALITY = "video" as const;

export type GenerationModality = typeof IMAGE_GENERATION_MODALITY | typeof VIDEO_GENERATION_MODALITY;

export const DEFAULT_VIDEO_PROMPT = "Оживи изображение";
export const GROK_IMAGINE_VIDEO_MODEL = "grok-imagine-video-1.5";
export const GEMINI_OMNI_VIDEO_MODEL = "gemini-omni-flash-preview";
export const VEO_LITE_VIDEO_MODEL = "veo-3.1-lite-generate-preview";
export const SEEDANCE_25_VIDEO_MODEL = "seedance-2.5";
export const SEEDANCE_25_OPENROUTER_MODEL = "bytedance/seedance-2.5";
/** PromptShot credits per second for Seedance 2.5. 4s=96, 5s=120, 10s=240. */
export const SEEDANCE_25_CREDIT_COST_PER_SECOND = 24;
/** Default «Оживить» model. Code SSOT; DB `default_video_model` should match. */
export const DEFAULT_VIDEO_MODEL = VEO_LITE_VIDEO_MODEL;

export const GROK_IMAGINE_IMAGE_MODEL = "grok-imagine-image-2.0";
/** PromptShot credits for the Grok Imagine photo model. SSOT for picker + enqueue. */
export const GROK_IMAGINE_IMAGE_CREDIT_COST = 10;

export const SEEDREAM_45_IMAGE_MODEL = "seedream-4.5";
export const SEEDREAM_45_OPENROUTER_MODEL = "bytedance-seed/seedream-4.5";
export const SEEDREAM_50_PRO_IMAGE_MODEL = "seedream-5.0-pro";
export const SEEDREAM_50_PRO_OPENROUTER_MODEL = "bytedance-seed/seedream-5-0-pro";
export const FLUX_2_FLEX_IMAGE_MODEL = "flux-2-flex";
export const FLUX_2_FLEX_OPENROUTER_MODEL = "black-forest-labs/flux.2-flex";
/** PromptShot credits for OpenRouter image models. SSOT for picker + enqueue. */
export const OPENROUTER_IMAGE_CREDIT_COST = 10;
export const SEEDREAM_45_CREDIT_COST = OPENROUTER_IMAGE_CREDIT_COST;
export const SEEDREAM_50_PRO_CREDIT_COST = OPENROUTER_IMAGE_CREDIT_COST;
export const FLUX_2_FLEX_CREDIT_COST = OPENROUTER_IMAGE_CREDIT_COST;

export function isGrokVideoModel(model: unknown): boolean {
  return typeof model === "string" && model.startsWith("grok-imagine-video");
}

export function isGrokImageModel(model: unknown): boolean {
  return typeof model === "string" && model.startsWith("grok-imagine-image");
}

export function isSeedreamImageModel(model: unknown): boolean {
  return typeof model === "string" && model.startsWith("seedream-");
}

export function isSeedream45ImageModel(model: unknown): boolean {
  return model === SEEDREAM_45_IMAGE_MODEL;
}

export function isSeedream50ProImageModel(model: unknown): boolean {
  return model === SEEDREAM_50_PRO_IMAGE_MODEL;
}

export function isFluxImageModel(model: unknown): boolean {
  return typeof model === "string" && model.startsWith("flux-");
}

export function isOpenRouterImageModel(model: unknown): boolean {
  return isSeedreamImageModel(model) || isFluxImageModel(model);
}

export function openRouterVendorModel(productId: string): string {
  if (productId === SEEDREAM_50_PRO_IMAGE_MODEL) return SEEDREAM_50_PRO_OPENROUTER_MODEL;
  if (productId === FLUX_2_FLEX_IMAGE_MODEL) return FLUX_2_FLEX_OPENROUTER_MODEL;
  return SEEDREAM_45_OPENROUTER_MODEL;
}

export function openRouterMaxImageInputs(productId: string): number {
  if (productId === SEEDREAM_50_PRO_IMAGE_MODEL) return 14;
  if (productId === FLUX_2_FLEX_IMAGE_MODEL) return 8;
  return 10;
}

/** Flux Image API does not list `resolution`; Seedream does. */
export function openRouterSendsResolution(productId: string): boolean {
  return !isFluxImageModel(productId);
}

export function forcedImageCreditCost(modelId: string): number | null {
  if (isGrokImageModel(modelId)) return GROK_IMAGINE_IMAGE_CREDIT_COST;
  if (isOpenRouterImageModel(modelId)) return OPENROUTER_IMAGE_CREDIT_COST;
  return null;
}

export function isGeminiImageModel(model: unknown): boolean {
  return typeof model === "string"
    && model.startsWith("gemini-")
    && model.includes("image");
}

export function isVeoLiteVideoModel(model: unknown): boolean {
  return typeof model === "string" && model.startsWith("veo-3.1-lite");
}

export function isSeedanceVideoModel(model: unknown): boolean {
  return typeof model === "string" && model.startsWith("seedance-");
}

export const DEFAULT_VIDEO_ASPECT_RATIO = "9:16";
export const DEFAULT_VIDEO_DURATION_SECONDS = 4;
export const DEFAULT_VIDEO_RESOLUTION = "720p";
export const DEFAULT_VIDEO_CREDIT_COST = 30;
export const VIDEO_QUANTITY = 1;

export const IMAGE_ASPECT_RATIO_OPTIONS = [
  { value: "1:1", label: "1:1, квадратный" },
  { value: "4:3", label: "4:3, горизонтальный" },
  { value: "3:4", label: "3:4, вертикальный" },
  { value: "16:9", label: "16:9, горизонтальный" },
  { value: "9:16", label: "9:16, вертикальный" },
  { value: "3:2", label: "3:2, горизонтальный" },
  { value: "2:3", label: "2:3, вертикальный" },
] as const;

export const IMAGE_SIZE_OPTIONS = [
  { value: "1K", label: "1K (1024px)" },
  { value: "2K", label: "2K (2048px)" },
  { value: "4K", label: "4K (4096px)" },
] as const;

export const DEFAULT_IMAGE_ASPECT_RATIO = "9:16";
export const DEFAULT_IMAGE_SIZE = "1K";

const IMAGE_ASPECT_RATIOS = new Set<string>(
  IMAGE_ASPECT_RATIO_OPTIONS.map((option) => option.value)
);
const IMAGE_SIZES = new Set<string>(
  IMAGE_SIZE_OPTIONS.map((option) => option.value)
);

export function isImageAspectRatio(value: unknown): value is string {
  return typeof value === "string" && IMAGE_ASPECT_RATIOS.has(value);
}

export function isImageSize(value: unknown): value is string {
  return typeof value === "string" && IMAGE_SIZES.has(value);
}

/**
 * Grok / Flux / Seedream 5.0 Pro: 1K|2K.
 * Seedream 4.5: 2K|4K.
 */
export function imageSizeOptionsForModel(
  model?: string | null
): readonly { value: string; label: string }[] {
  if (isGrokImageModel(model) || isFluxImageModel(model) || isSeedream50ProImageModel(model)) {
    return IMAGE_SIZE_OPTIONS.filter((option) => option.value !== "4K");
  }
  if (isSeedreamImageModel(model)) {
    return IMAGE_SIZE_OPTIONS.filter((option) => option.value !== "1K");
  }
  return IMAGE_SIZE_OPTIONS;
}

export function clampImageSizeForModel(
  model: string | null | undefined,
  imageSize: string
): string {
  if (
    (isGrokImageModel(model) || isFluxImageModel(model) || isSeedream50ProImageModel(model))
    && imageSize === "4K"
  ) {
    return "2K";
  }
  if (isSeedream45ImageModel(model) && imageSize === "1K") return "2K";
  if (isSeedreamImageModel(model) && !isSeedream50ProImageModel(model) && imageSize === "1K") {
    return "2K";
  }
  return imageSize;
}

export type OpenRouterImageSize = "1K" | "2K" | "4K";

export function mapOpenRouterImageSize(
  model: string,
  imageSize: string,
): { size: OpenRouterImageSize; clamped: boolean } {
  const requested = String(imageSize || "").trim().toUpperCase();
  const mapped = clampImageSizeForModel(model, requested);
  if (mapped === "1K" || mapped === "2K" || mapped === "4K") {
    return { size: mapped, clamped: mapped !== requested };
  }
  return { size: "2K", clamped: true };
}

export const VIDEO_ASPECT_RATIO_OPTIONS = [
  { value: "9:16", label: "9:16, вертикальный" },
  { value: "16:9", label: "16:9, горизонтальный" },
] as const;

export const VIDEO_DURATION_OPTIONS = [
  { value: 4, label: "4 сек" },
  { value: 6, label: "6 сек" },
  { value: 8, label: "8 сек" },
  { value: 10, label: "10 сек" },
] as const;

export const VIDEO_RESOLUTION_OPTIONS = [
  { value: "720p", label: "720p" },
] as const;

const VIDEO_ASPECT_RATIOS = new Set<string>(
  VIDEO_ASPECT_RATIO_OPTIONS.map((option) => option.value)
);
const VIDEO_DURATIONS = new Set<number>(
  VIDEO_DURATION_OPTIONS.map((option) => option.value)
);
const VIDEO_RESOLUTIONS = new Set<string>(
  VIDEO_RESOLUTION_OPTIONS.map((option) => option.value)
);

export function isVideoAspectRatio(value: unknown): value is string {
  return typeof value === "string" && VIDEO_ASPECT_RATIOS.has(value);
}

export function isVideoDurationSeconds(value: unknown): value is number {
  return typeof value === "number" && VIDEO_DURATIONS.has(value);
}

/** Veo 3.1 Lite accepts 4/6/8s only. 10s is clamped to 8. */
export function videoDurationOptionsForModel(
  model?: string | null
): readonly { value: number; label: string }[] {
  if (isVeoLiteVideoModel(model)) {
    return VIDEO_DURATION_OPTIONS.filter((option) => option.value <= 8);
  }
  return VIDEO_DURATION_OPTIONS;
}

export function isVideoResolution(value: unknown): value is string {
  return typeof value === "string" && VIDEO_RESOLUTIONS.has(value);
}

export function isGenerationModality(value: unknown): value is GenerationModality {
  return value === IMAGE_GENERATION_MODALITY || value === VIDEO_GENERATION_MODALITY;
}
