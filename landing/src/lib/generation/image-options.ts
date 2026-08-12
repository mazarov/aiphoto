export const IMAGE_GENERATION_MODALITY = "image" as const;

export type GenerationModality = typeof IMAGE_GENERATION_MODALITY | "video";

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

export function isGenerationModality(value: unknown): value is GenerationModality {
  return value === IMAGE_GENERATION_MODALITY || value === "video";
}
