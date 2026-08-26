import assert from "node:assert/strict";
import test from "node:test";
import {
  FLUX_2_FLEX_CREDIT_COST,
  GROK_IMAGINE_IMAGE_CREDIT_COST,
  SEEDREAM_45_CREDIT_COST,
  SEEDREAM_50_PRO_CREDIT_COST,
} from "./generation/image-options";
import {
  displayLabelForGenerationModel,
  parseEnabledGenerationModels,
  parseEnabledVideoGenerationModels,
} from "./generation-model-labels";

test("Grok Imagine photo always costs 10 credits even if config still says 5", () => {
  const models = parseEnabledGenerationModels(
    JSON.stringify([
      { id: "gemini-2.5-flash-image", label: "Nano Banana", cost: 5, enabled: true },
      { id: "grok-imagine-image-2.0", label: "Grok Imagine", cost: 5, enabled: true },
    ])
  );
  const grok = models.find((item) => item.id === "grok-imagine-image-2.0");
  const banana = models.find((item) => item.id === "gemini-2.5-flash-image");
  assert.equal(GROK_IMAGINE_IMAGE_CREDIT_COST, 10);
  assert.equal(grok?.cost, 10);
  assert.equal(banana?.cost, 5);
});

test("Seedream 4.5 stays out of the picker even if catalog still says enabled", () => {
  const hidden = parseEnabledGenerationModels(
    JSON.stringify([
      { id: "gemini-2.5-flash-image", label: "Nano Banana", cost: 5, enabled: true },
      { id: "seedream-4.5", label: "Seedream 4.5", cost: 3, enabled: false },
    ])
  );
  assert.equal(hidden.find((item) => item.id === "seedream-4.5"), undefined);
  const stillHidden = parseEnabledGenerationModels(
    JSON.stringify([
      { id: "seedream-4.5", label: "Seedream 4.5", cost: 3, enabled: true },
      { id: "seedream-5.0-pro", label: "Seedream 5.0 Pro", cost: 10, enabled: true },
    ])
  );
  assert.equal(SEEDREAM_45_CREDIT_COST, 10);
  assert.equal(stillHidden.find((item) => item.id === "seedream-4.5"), undefined);
  assert.equal(stillHidden[0]?.id, "seedream-5.0-pro");
  assert.equal(displayLabelForGenerationModel("seedream-4.5"), "Seedream 4.5");
});

test("Seedream 5.0 Pro and Flux 2 Flex cost 10 and use product labels", () => {
  const models = parseEnabledGenerationModels(
    JSON.stringify([
      { id: "seedream-5.0-pro", label: "Seedream 5.0 Pro", cost: 3, enabled: true },
      { id: "flux-2-flex", label: "Flux 2 Flex", cost: 3, enabled: true },
    ])
  );
  assert.equal(SEEDREAM_50_PRO_CREDIT_COST, 10);
  assert.equal(FLUX_2_FLEX_CREDIT_COST, 10);
  assert.equal(models.find((item) => item.id === "seedream-5.0-pro")?.cost, 10);
  assert.equal(models.find((item) => item.id === "flux-2-flex")?.cost, 10);
  assert.equal(displayLabelForGenerationModel("seedream-5.0-pro"), "Seedream 5.0 Pro");
  assert.equal(displayLabelForGenerationModel("flux-2-flex"), "Flux 2 Flex");
});

test("Veo 3.1 Lite keeps Lite in the product label", () => {
  assert.equal(
    displayLabelForGenerationModel("veo-3.1-lite-generate-preview"),
    "Veo 3.1 Lite"
  );
  const models = parseEnabledVideoGenerationModels(null);
  assert.equal(
    models.find((item) => item.id === "veo-3.1-lite-generate-preview")?.label,
    "Veo 3.1 Lite"
  );
});
