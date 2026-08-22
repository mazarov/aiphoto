import assert from "node:assert/strict";
import test from "node:test";
import { GROK_IMAGINE_IMAGE_CREDIT_COST } from "./generation/image-options";
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
