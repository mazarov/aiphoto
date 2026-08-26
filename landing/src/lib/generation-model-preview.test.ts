import assert from "node:assert/strict";
import test from "node:test";
import {
  previewFramesForGenerationModel,
  usesCatalogPreviewFallback,
} from "./generation-model-preview";

test("Flux never uses newest catalog photos as a fallback", () => {
  assert.equal(usesCatalogPreviewFallback("flux-2-flex"), false);
  assert.equal(usesCatalogPreviewFallback("seedream-5.0-pro"), true);
  assert.deepEqual(
    previewFramesForGenerationModel({
      modelId: "flux-2-flex",
      latestGenerationPreview: null,
      catalogImages: ["https://cdn.example/new-1.jpg", "https://cdn.example/new-2.jpg"],
      modelIndex: 0,
    }),
    []
  );
});

test("Flux keeps only the latest generation on that model", () => {
  assert.deepEqual(
    previewFramesForGenerationModel({
      modelId: "flux-2-flex",
      latestGenerationPreview: "https://cdn.example/flux-latest.jpg",
      catalogImages: ["https://cdn.example/new-1.jpg"],
      modelIndex: 3,
    }),
    ["https://cdn.example/flux-latest.jpg"]
  );
});

test("other models can still cycle catalog photos when no generation exists", () => {
  const frames = previewFramesForGenerationModel({
    modelId: "gemini-2.5-flash-image",
    latestGenerationPreview: null,
    catalogImages: ["a.jpg", "b.jpg", "c.jpg"],
    modelIndex: 0,
  });
  assert.equal(frames.length, 3);
  assert.equal(frames[0], "a.jpg");
});
