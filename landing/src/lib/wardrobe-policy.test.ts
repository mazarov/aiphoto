import assert from "node:assert/strict";
import test from "node:test";
import {
  KEEP_WARDROBE_SECTION_BODY,
  STYLIZED_IDENTITY_PHOTO_APPEARANCE_BODY,
  applyWardrobePolicyToPrompt,
  isStylizedNonPhotoPrompt,
  neutralizeAppearanceForIdentityPhoto,
  neutralizeWardrobeSections,
  parseWardrobePolicy,
  preparePromptForIdentityPhotoGeneration,
  resolveJobWardrobePolicy,
  resolveRequestedWardrobePolicy,
  shouldShowPreserveOutfitChip,
  stripEmbeddedCriticalRules,
} from "./wardrobe-policy";

test("parseWardrobePolicy defaults unknown values to replace", () => {
  assert.equal(parseWardrobePolicy("keep"), "keep");
  assert.equal(parseWardrobePolicy("replace"), "replace");
  assert.equal(parseWardrobePolicy(null), "replace");
  assert.equal(parseWardrobePolicy("KEEP"), "replace");
});

test("resolveJobWardrobePolicy keeps only initial I2I with photos", () => {
  assert.equal(
    resolveJobWardrobePolicy({ stored: "keep", hasInputPhotos: true }),
    "keep",
  );
  assert.equal(
    resolveJobWardrobePolicy({ stored: "keep", hasInputPhotos: false }),
    "replace",
  );
  assert.equal(
    resolveJobWardrobePolicy({
      stored: "keep",
      hasInputPhotos: true,
      isPhotoshoot: true,
    }),
    "replace",
  );
  assert.equal(
    resolveJobWardrobePolicy({
      stored: "keep",
      hasInputPhotos: true,
      isVibe: true,
    }),
    "replace",
  );
});

test("resolveRequestedWardrobePolicy requires flag, request, and photos", () => {
  assert.equal(
    resolveRequestedWardrobePolicy({
      preserveOutfitRequested: true,
      flagOn: true,
      hasPhotos: true,
    }),
    "keep",
  );
  assert.equal(
    resolveRequestedWardrobePolicy({
      preserveOutfitRequested: true,
      flagOn: false,
      hasPhotos: true,
    }),
    "replace",
  );
  assert.equal(
    resolveRequestedWardrobePolicy({
      preserveOutfitRequested: false,
      flagOn: true,
      hasPhotos: true,
    }),
    "replace",
  );
  assert.equal(
    resolveRequestedWardrobePolicy({
      preserveOutfitRequested: true,
      flagOn: true,
      hasPhotos: false,
    }),
    "replace",
  );
});

test("shouldShowPreserveOutfitChip is image-compose only", () => {
  assert.equal(
    shouldShowPreserveOutfitChip({
      composeMode: "image",
      photoCount: 1,
      flagOn: true,
    }),
    true,
  );
  assert.equal(
    shouldShowPreserveOutfitChip({
      composeMode: "photoshoot",
      photoCount: 1,
      flagOn: true,
    }),
    false,
  );
  assert.equal(
    shouldShowPreserveOutfitChip({
      composeMode: "image",
      photoCount: 0,
      flagOn: true,
    }),
    false,
  );
});

test("neutralizeWardrobeSections replaces Clothing body and keeps Scene", () => {
  const prompt = [
    "Scene",
    "Evening embankment, city lights.",
    "Clothing",
    "Red silk evening dress, gold heels.",
    "Pose",
    "Looking over the shoulder.",
  ].join("\n");
  const next = neutralizeWardrobeSections(prompt);
  assert.match(next, /Evening embankment/);
  assert.match(next, /Looking over the shoulder/);
  assert.match(next, new RegExp(KEEP_WARDROBE_SECTION_BODY));
  assert.doesNotMatch(next, /Red silk evening dress/);
});

test("neutralizeWardrobeSections rewrites inline Clothing heading", () => {
  const next = neutralizeWardrobeSections("Clothing: navy suit and oxfords\nScene\nOffice.");
  assert.match(next, /Office/);
  assert.match(next, new RegExp(KEEP_WARDROBE_SECTION_BODY));
  assert.doesNotMatch(next, /navy suit/);
});

test("applyWardrobePolicyToPrompt leaves replace text untouched", () => {
  const raw = "Clothing\nRed dress";
  assert.equal(applyWardrobePolicyToPrompt(raw, "replace"), raw);
  assert.doesNotMatch(applyWardrobePolicyToPrompt(raw, "keep"), /Red dress/);
});

test("isStylizedNonPhotoPrompt detects illustration/painting prompts and ignores photo Avoid lines", () => {
  const photoPrompt = [
    "Visual Hook:",
    "Студийный портрет.",
    "Genre:",
    "Студийная фотография.",
    "Rendering:",
    "Цифровая фотосъёмка с высокой резкостью.",
    "Avoid:",
    "- мультяшный вид, 3D-рендер, иллюстрация",
    "CRITICAL RULES",
    "- Фотореалистичный результат, высокая детализация текстур.",
  ].join("\n");
  assert.equal(isStylizedNonPhotoPrompt(photoPrompt), false);

  const digitalPaintingPrompt = [
    "Visual Hook:",
    "Портрет женщины в розовом свитере.",
    "Genre:",
    "Портретная иллюстрация в стиле цифровой живописи.",
    "Rendering:",
    "Изображение выполнено в технике цифровой живописи с мягкими мазками.",
    "Appearance:",
    "У женщины длинные каштановые волосы и голубые глаза.",
    "Avoid:",
    "- Превращение изображения в фотографию",
    "CRITICAL RULES",
    "- Повтори кадр по секциям выше. Исходное фото в генерацию не прикладывается: внешность брать из Appearance, не из фразы «сохрани лицо».",
    "- Сохрани носитель и технику исполнения из Genre, Rendering и Avoid. Не переводи иллюстрацию или 3D в фотографию.",
  ].join("\n");
  assert.equal(isStylizedNonPhotoPrompt(digitalPaintingPrompt), true);

  const prepared = preparePromptForIdentityPhotoGeneration(digitalPaintingPrompt, "replace");
  assert.equal(prepared.stylized, true);
  assert.doesNotMatch(prepared.body, /Исходное фото в генерацию не прикладывается/);
  assert.doesNotMatch(prepared.body, /У женщины длинные каштановые волосы/);
  assert.match(prepared.body, new RegExp(STYLIZED_IDENTITY_PHOTO_APPEARANCE_BODY.slice(0, 40)));
});

test("stripEmbeddedCriticalRules and neutralizeAppearanceForIdentityPhoto remove conflicting blocks", () => {
  const raw = [
    "Genre:",
    "Studio portrait.",
    "Appearance:",
    "Man, 55 years old, grey beard.",
    "Pose:",
    "Three-quarter turn.",
    "CRITICAL RULES",
    "- Repeat the frame from the sections above. The source photo is not attached to generation.",
  ].join("\n");
  const stripped = stripEmbeddedCriticalRules(raw);
  assert.doesNotMatch(stripped, /CRITICAL RULES/);
  assert.doesNotMatch(stripped, /source photo is not attached/);
  const neutralized = neutralizeAppearanceForIdentityPhoto(stripped, false);
  assert.doesNotMatch(neutralized, /55 years old/);
  assert.match(neutralized, /attached reference photo/);
});
