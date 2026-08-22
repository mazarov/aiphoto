import {
  IMAGE_GENERATION_MODALITY,
  isGeminiImageModel,
  isGrokImageModel,
} from "@/lib/generation/image-options";

export type ImageApiMode = "generate" | "edit";
export type ImageApiVendor = "xai" | "gemini";

export type ProviderImageMode = {
  vendor: ImageApiVendor;
  mode: ImageApiMode;
};

export function inferImageApiMode(input: {
  inputPhotoCount?: number | null;
  hasParent?: boolean | null;
  hasVibe?: boolean | null;
  hasEditInstruction?: boolean | null;
}): ImageApiMode {
  const photos = Math.max(0, Number(input.inputPhotoCount) || 0);
  if (
    photos > 0
    || input.hasParent
    || input.hasVibe
    || input.hasEditInstruction
  ) {
    return "edit";
  }
  return "generate";
}

export function inferProviderImageMode(input: {
  modality?: string | null;
  model?: string | null;
  requestedModel?: string | null;
  executedModel?: string | null;
  fallbackUsed?: boolean | null;
  inputPhotoCount?: number | null;
  hasParent?: boolean | null;
  hasVibe?: boolean | null;
  hasEditInstruction?: boolean | null;
}): ProviderImageMode | null {
  if (input.modality && input.modality !== IMAGE_GENERATION_MODALITY) return null;
  const vendor = resolveImageApiVendor(input);
  if (!vendor) return null;
  return {
    vendor,
    mode: inferImageApiMode(input),
  };
}

export function providerImageModeLabel(value: ProviderImageMode | null): string | null {
  if (!value) return null;
  const vendor = value.vendor === "xai" ? "xAI" : "Gemini";
  return `${vendor} ${value.mode}`;
}

export function providerImageModeBadgeClass(value: ProviderImageMode): string {
  if (value.vendor === "xai") {
    return value.mode === "edit" ? "bg-teal-100 text-teal-800" : "bg-orange-100 text-orange-800";
  }
  return value.mode === "edit" ? "bg-indigo-100 text-indigo-800" : "bg-violet-100 text-violet-800";
}

function resolveImageApiVendor(input: {
  model?: string | null;
  requestedModel?: string | null;
  executedModel?: string | null;
  fallbackUsed?: boolean | null;
}): ImageApiVendor | null {
  if (isGrokImageModel(input.executedModel) || Boolean(input.fallbackUsed)) return "xai";
  if (isGeminiImageModel(input.executedModel)) return "gemini";
  if (isGrokImageModel(input.requestedModel) || isGrokImageModel(input.model)) return "xai";
  if (isGeminiImageModel(input.requestedModel) || isGeminiImageModel(input.model)) return "gemini";
  return null;
}
