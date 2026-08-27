import assert from "node:assert/strict";
import test from "node:test";
import {
  FLUX_2_FLEX_CREDIT_COST,
  FLUX_2_FLEX_OPENROUTER_MODEL,
  SEEDANCE_25_CREDIT_COST_PER_SECOND,
  SEEDANCE_25_OPENROUTER_MODEL,
  SEEDANCE_25_VIDEO_MODEL,
  SEEDREAM_50_PRO_CREDIT_COST,
  SEEDREAM_50_PRO_OPENROUTER_MODEL,
  clampImageSizeForModel,
  forcedImageCreditCost,
  imageSizeOptionsForModel,
  isFluxImageModel,
  isOpenRouterImageModel,
  isSeedanceVideoModel,
  isSeedreamImageModel,
  mapOpenRouterImageSize,
  openRouterSendsResolution,
  openRouterVendorModel,
} from "./image-options";

test("Seedream 4.5 hides 1K and clamps prefs to 2K", () => {
  assert.equal(isSeedreamImageModel("seedream-4.5"), true);
  assert.deepEqual(
    imageSizeOptionsForModel("seedream-4.5").map((item) => item.value),
    ["2K", "4K"],
  );
  assert.equal(clampImageSizeForModel("seedream-4.5", "1K"), "2K");
  assert.equal(clampImageSizeForModel("seedream-4.5", "4K"), "4K");
  assert.equal(clampImageSizeForModel("grok-imagine-image-2.0", "4K"), "2K");
});

test("Seedream 5.0 Pro and Flux 2 Flex hide 4K and clamp to 2K", () => {
  assert.equal(isSeedreamImageModel("seedream-5.0-pro"), true);
  assert.equal(isFluxImageModel("flux-2-flex"), true);
  assert.equal(isOpenRouterImageModel("flux-2-flex"), true);
  assert.equal(isOpenRouterImageModel("seedream-5.0-pro"), true);
  assert.deepEqual(
    imageSizeOptionsForModel("seedream-5.0-pro").map((item) => item.value),
    ["1K", "2K"],
  );
  assert.deepEqual(
    imageSizeOptionsForModel("flux-2-flex").map((item) => item.value),
    ["1K", "2K"],
  );
  assert.equal(clampImageSizeForModel("seedream-5.0-pro", "4K"), "2K");
  assert.equal(clampImageSizeForModel("flux-2-flex", "4K"), "2K");
  assert.equal(clampImageSizeForModel("seedream-5.0-pro", "1K"), "1K");
  assert.deepEqual(mapOpenRouterImageSize("seedream-5.0-pro", "4K"), { size: "2K", clamped: true });
  assert.equal(openRouterVendorModel("seedream-5.0-pro"), SEEDREAM_50_PRO_OPENROUTER_MODEL);
  assert.equal(openRouterVendorModel("flux-2-flex"), FLUX_2_FLEX_OPENROUTER_MODEL);
  assert.equal(openRouterSendsResolution("flux-2-flex"), false);
  assert.equal(openRouterSendsResolution("seedream-5.0-pro"), true);
  assert.equal(forcedImageCreditCost("seedream-5.0-pro"), SEEDREAM_50_PRO_CREDIT_COST);
  assert.equal(forcedImageCreditCost("flux-2-flex"), FLUX_2_FLEX_CREDIT_COST);
});

test("Seedance 2.5 is a video id, not an OpenRouter image model", () => {
  assert.equal(SEEDANCE_25_CREDIT_COST_PER_SECOND, 24);
  assert.equal(SEEDANCE_25_OPENROUTER_MODEL, "bytedance/seedance-2.5");
  assert.equal(isSeedanceVideoModel(SEEDANCE_25_VIDEO_MODEL), true);
  assert.equal(isSeedanceVideoModel("seedream-5.0-pro"), false);
  assert.equal(isOpenRouterImageModel("seedance-2.5"), false);
});
