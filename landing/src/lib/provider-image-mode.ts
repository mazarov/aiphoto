import {
  IMAGE_GENERATION_MODALITY,
  isFluxImageModel,
  isGeminiImageModel,
  isGrokImageModel,
  isOpenRouterImageModel,
  isSeedreamImageModel,
} from "@/lib/generation/image-options";

export type ImageApiMode = "generate" | "edit";
export type ImageApiVendor = "xai" | "gemini" | "openrouter";

export type ProviderImageMode = {
  vendor: ImageApiVendor;
  mode: ImageApiMode;
  brand?: "seedream" | "flux";
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
  const brand = vendor === "openrouter"
    ? resolveOpenRouterBrand(input)
    : undefined;
  return {
    vendor,
    mode: inferImageApiMode(input),
    ...(brand ? { brand } : {}),
  };
}

export function providerImageModeLabel(value: ProviderImageMode | null): string | null {
  if (!value) return null;
  const vendor =
    value.vendor === "xai"
      ? "xAI"
      : value.vendor === "openrouter"
        ? (value.brand === "flux" ? "Flux" : "Seedream")
        : "Gemini";
  return `${vendor} ${value.mode}`;
}

export function providerImageModeBadgeClass(value: ProviderImageMode): string {
  if (value.vendor === "xai") {
    return value.mode === "edit" ? "bg-teal-100 text-teal-800" : "bg-orange-100 text-orange-800";
  }
  if (value.vendor === "openrouter") {
    return value.mode === "edit" ? "bg-sky-100 text-sky-800" : "bg-blue-100 text-blue-800";
  }
  return value.mode === "edit" ? "bg-indigo-100 text-indigo-800" : "bg-violet-100 text-violet-800";
}

function resolveImageApiVendor(input: {
  model?: string | null;
  requestedModel?: string | null;
  executedModel?: string | null;
  fallbackUsed?: boolean | null;
}): ImageApiVendor | null {
  if (isGrokImageModel(input.executedModel)) return "xai";
  if (isOpenRouterImageModel(input.executedModel)) return "openrouter";
  if (isGeminiImageModel(input.executedModel)) return "gemini";
  if (Boolean(input.fallbackUsed) && !input.executedModel) return "xai";
  if (isGrokImageModel(input.requestedModel) || isGrokImageModel(input.model)) return "xai";
  if (isOpenRouterImageModel(input.requestedModel) || isOpenRouterImageModel(input.model)) {
    return "openrouter";
  }
  if (isGeminiImageModel(input.requestedModel) || isGeminiImageModel(input.model)) return "gemini";
  return null;
}

function resolveOpenRouterBrand(input: {
  model?: string | null;
  requestedModel?: string | null;
  executedModel?: string | null;
}): "seedream" | "flux" {
  if (isFluxImageModel(input.executedModel) || isFluxImageModel(input.requestedModel) || isFluxImageModel(input.model)) {
    return "flux";
  }
  if (
    isSeedreamImageModel(input.executedModel)
    || isSeedreamImageModel(input.requestedModel)
    || isSeedreamImageModel(input.model)
  ) {
    return "seedream";
  }
  return "seedream";
}
