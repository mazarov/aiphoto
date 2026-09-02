import assert from "node:assert/strict";
import test from "node:test";
import {
  FLUX_2_FLEX_CREDIT_COST,
  GROK_IMAGINE_IMAGE_CREDIT_COST,
  SEEDREAM_45_CREDIT_COST,
  SEEDREAM_50_PRO_CREDIT_COST,
} from "./generation/image-options";
import {
  displayDescriptionForGenerationModel,
  displayLabelForGenerationModel,
  filterNanoBananaFamilyModels,
  isNanoBananaFamilyModel,
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

test("Seedance 2.5 uses the product label and stays hidden while disabled", () => {
  assert.equal(displayLabelForGenerationModel("seedance-2.5"), "Seedance 2.5");
  const hidden = parseEnabledVideoGenerationModels(
    JSON.stringify([
      { id: "veo-3.1-lite-generate-preview", label: "Veo 3.1 Lite", cost: 15, enabled: true },
      { id: "seedance-2.5", label: "Seedance 2.5", cost: 96, enabled: false },
    ])
  );
  assert.equal(hidden.find((item) => item.id === "seedance-2.5"), undefined);
  const shown = parseEnabledVideoGenerationModels(
    JSON.stringify([
      { id: "seedance-2.5", label: "Seedance 2.5", cost: 96, enabled: true },
    ])
  );
  assert.equal(shown[0]?.id, "seedance-2.5");
  assert.equal(shown[0]?.label, "Seedance 2.5");
  assert.equal(shown[0]?.cost, 96);
});

test("model blurbs match the Lexy photo and video picker", () => {
  assert.equal(
    displayDescriptionForGenerationModel("gemini-2.5-flash-image"),
    "Быстрые превью для идей"
  );
  assert.equal(
    displayDescriptionForGenerationModel("gemini-3-pro-image-preview"),
    "Максимальная детализация"
  );
  assert.equal(
    displayDescriptionForGenerationModel("gemini-3.1-flash-image-preview"),
    "Улучшенные алгоритмы генерации"
  );
  assert.equal(
    displayDescriptionForGenerationModel("gemini-3.1-flash-lite-image"),
    "Оптимизированная генерация"
  );
  assert.equal(
    displayDescriptionForGenerationModel("grok-imagine-image-2.0"),
    "Креативная генерация"
  );
  assert.equal(
    displayDescriptionForGenerationModel("seedream-5.0-pro"),
    "Стильные и чувственные сцены"
  );
  assert.equal(
    displayDescriptionForGenerationModel("flux-2-flex"),
    "Баланс качества, скорости и контроля"
  );
  assert.equal(
    displayDescriptionForGenerationModel("grok-imagine-video-1.5"),
    "Динамичное видео из фото"
  );
  assert.equal(
    displayDescriptionForGenerationModel("gemini-omni-flash-preview"),
    "Фото оживает по твоему сценарию"
  );
  assert.equal(
    displayDescriptionForGenerationModel("veo-3.1-lite-generate-preview"),
    "Озвученное видео из фото"
  );
  assert.equal(
    displayDescriptionForGenerationModel("seedance-2.5"),
    "Кинематографические видео до 30 секунд"
  );
});

test("Nano Banana family keeps Gemini image ids and drops other vendors", () => {
  assert.equal(isNanoBananaFamilyModel("gemini-2.5-flash-image"), true);
  assert.equal(isNanoBananaFamilyModel("gemini-3-pro-image-preview"), true);
  assert.equal(isNanoBananaFamilyModel("gemini-3.1-flash-image-preview"), true);
  assert.equal(isNanoBananaFamilyModel("grok-imagine-image-2.0"), false);
  assert.equal(isNanoBananaFamilyModel("gemini-omni-flash-preview"), false);
  const filtered = filterNanoBananaFamilyModels(
    parseEnabledGenerationModels(
      JSON.stringify([
        { id: "gemini-2.5-flash-image", label: "Nano Banana", cost: 5, enabled: true },
        { id: "grok-imagine-image-2.0", label: "Grok Imagine", cost: 10, enabled: true },
        { id: "gemini-3-pro-image-preview", label: "Nano Banana PRO", cost: 10, enabled: true },
      ])
    )
  );
  assert.deepEqual(
    filtered.map((model) => model.id),
    ["gemini-2.5-flash-image", "gemini-3-pro-image-preview"]
  );
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
