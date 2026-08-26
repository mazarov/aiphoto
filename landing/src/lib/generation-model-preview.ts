import { isFluxImageModel } from "./generation/image-options";

/** Flux cards never fall back to newest catalog photos. */
export function usesCatalogPreviewFallback(modelId: string): boolean {
  return !isFluxImageModel(modelId);
}

/** Frames for a model card: latest generation first, catalog only if allowed. */
export function previewFramesForGenerationModel(input: {
  modelId: string;
  latestGenerationPreview: string | null;
  catalogImages: string[];
  modelIndex: number;
}): string[] {
  if (input.latestGenerationPreview) return [input.latestGenerationPreview];
  if (!usesCatalogPreviewFallback(input.modelId) || input.catalogImages.length === 0) {
    return [];
  }
  return Array.from(
    { length: Math.min(3, input.catalogImages.length) },
    (_, frameIndex) =>
      input.catalogImages[
        (input.modelIndex * 2 + frameIndex) % input.catalogImages.length
      ]
  );
}
