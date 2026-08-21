export const IMAGE_GENERATION_MODALITY = "image" as const;
export const VIDEO_GENERATION_MODALITY = "video" as const;

export type GenerationModality = typeof IMAGE_GENERATION_MODALITY | typeof VIDEO_GENERATION_MODALITY;

export const DEFAULT_VIDEO_PROMPT = "Оживи изображение";
export const GROK_IMAGINE_VIDEO_MODEL = "grok-imagine-video-1.5";
export const DEFAULT_VIDEO_MODEL = GROK_IMAGINE_VIDEO_MODEL;
export const GEMINI_OMNI_VIDEO_MODEL = "gemini-omni-flash-preview";
export const VEO_LITE_VIDEO_MODEL = "veo-3.1-lite-generate-preview";

export const GROK_IMAGINE_IMAGE_MODEL = "grok-imagine-image-2.0";

export function isGrokVideoModel(model: unknown): boolean {
  return typeof model === "string" && model.startsWith("grok-imagine-video");
}

export function isGrokImageModel(model: unknown): boolean {
  return typeof model === "string" && model.startsWith("grok-imagine-image");
}

export function isVeoLiteVideoModel(model: unknown): boolean {
  return typeof model === "string" && model.startsWith("veo-3.1-lite");
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

/** Grok Imagine image API accepts 1k/2k only. */
export function imageSizeOptionsForModel(
  model?: string | null
): readonly { value: string; label: string }[] {
  if (isGrokImageModel(model)) {
    return IMAGE_SIZE_OPTIONS.filter((option) => option.value !== "4K");
  }
  return IMAGE_SIZE_OPTIONS;
}

export function clampImageSizeForModel(
  model: string | null | undefined,
  imageSize: string
): string {
  if (isGrokImageModel(model) && imageSize === "4K") return "2K";
  return imageSize;
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
