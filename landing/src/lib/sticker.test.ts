import assert from "node:assert/strict";
import test from "node:test";
import {
  assembleStickerFinalPrompt,
  buildStickerEditPromptText,
  buildStickerPromptText,
  buildStickerTextPromptText,
  DEFAULT_STICKER_STYLE_ID,
  findStickerStyle,
  isStickerEditAction,
  isStickerEditKind,
  isStickerFlagOn,
  isStickerTextPromptText,
  normalizeStickerOverlayText,
  parseStickerEditFromPrompt,
  parseStickerStyleIdFromPrompt,
  resolveStickerModel,
  sanitizeStickerCustomHint,
  STICKER_BACKGROUND_HEX,
  STICKER_CUSTOM_HINT_MAX,
  STICKER_STYLES,
  STICKER_TEXT_MAX_CHARS,
  stickerEditFingerprintFields,
  stripStickerPromptMarker,
} from "./sticker";

test("prompt text accepts a DB style row, not only the fallback id", () => {
  const text = buildStickerPromptText({ id: "cartoon_telegram", prompt: "Flat vector cartoon" });
  assert.equal(text, "STICKER style=cartoon_telegram\nFlat vector cartoon");
  assert.equal(parseStickerStyleIdFromPrompt(text), "cartoon_telegram");
  assert.equal(stripStickerPromptMarker(text), "Flat vector cartoon");
  // empty row prompt falls back to the default style prompt
  assert.equal(stripStickerPromptMarker(buildStickerPromptText({ id: "x", prompt: "" })), STICKER_STYLES[0].prompt);
});

test("emotion / motion edit marker round-trips and switches the worker prompt", () => {
  const text = buildStickerEditPromptText({ action: "emotion", presetId: "happy", hint: "joyful expression, big smile" });
  assert.equal(text, "STICKER edit=emotion preset=happy\njoyful expression, big smile");
  assert.deepEqual(parseStickerEditFromPrompt(text), {
    action: "emotion",
    presetId: "happy",
    hint: "joyful expression, big smile",
  });
  assert.equal(parseStickerEditFromPrompt(buildStickerPromptText("anime")), null);
  assert.equal(parseStickerEditFromPrompt("STICKER edit=emotion preset=happy\n"), null);
  const custom = buildStickerEditPromptText({ action: "motion", presetId: "", hint: "waving" });
  assert.match(custom, /^STICKER edit=motion preset=custom\n/);

  const prompt = assembleStickerFinalPrompt(text);
  assert.match(prompt, /You are an image editor/);
  assert.match(prompt, /changing ONLY the emotion \/ facial expression to: "joyful expression, big smile"/);
  assert.ok(prompt.includes(STICKER_BACKGROUND_HEX));
  assert.ok(!prompt.includes("STICKER edit="));
  assert.ok(!prompt.includes("The input image shows the SUBJECT"), "initial-sticker rules must not leak into an edit");
  assert.equal(isStickerEditAction("emotion"), true);
  assert.equal(isStickerEditAction("text"), false);
  assert.deepEqual(stickerEditFingerprintFields(" p1 ", { action: "motion", presetId: "", hint: " x y " }), {
    editKind: "sticker",
    parentGenerationId: "p1",
    stickerAction: "motion",
    stickerPresetId: "custom",
    stickerHint: "x y",
  });
});

test("custom hint and overlay text normalisation", () => {
  assert.equal(sanitizeStickerCustomHint("  big\n\nsmile\t now "), "big smile now");
  assert.equal(sanitizeStickerCustomHint("a"), "");
  assert.equal(sanitizeStickerCustomHint("x".repeat(500)).length, STICKER_CUSTOM_HINT_MAX);
  assert.equal(normalizeStickerOverlayText("  Привет,\nмир  "), "Привет, мир");
  assert.equal(normalizeStickerOverlayText("я".repeat(80)).length, STICKER_TEXT_MAX_CHARS);
  assert.equal(normalizeStickerOverlayText("   "), "");
  const textPrompt = buildStickerTextPromptText("Привет");
  assert.equal(textPrompt, "STICKER text\nПривет");
  assert.equal(isStickerTextPromptText(textPrompt), true);
  assert.equal(isStickerTextPromptText(buildStickerPromptText("anime")), false);
  assert.equal(stripStickerPromptMarker(textPrompt), "Привет");
});

test("style ids are unique and default exists", () => {
  const ids = STICKER_STYLES.map((style) => style.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(findStickerStyle(DEFAULT_STICKER_STYLE_ID));
  assert.equal(findStickerStyle("nope"), null);
  assert.equal(findStickerStyle(""), null);
});

test("prompt text carries the style marker and round-trips", () => {
  const text = buildStickerPromptText("anime");
  assert.match(text, /^STICKER style=anime\n/);
  assert.equal(parseStickerStyleIdFromPrompt(text), "anime");
  assert.equal(stripStickerPromptMarker(text), findStickerStyle("anime")?.prompt);
  // unknown style falls back to default instead of throwing
  assert.equal(parseStickerStyleIdFromPrompt(buildStickerPromptText("zzz")), DEFAULT_STICKER_STYLE_ID);
});

test("final prompt has magenta background rule and no marker", () => {
  const prompt = assembleStickerFinalPrompt(buildStickerPromptText("3d"));
  assert.ok(prompt.includes(STICKER_BACKGROUND_HEX));
  assert.ok(!prompt.includes("STICKER style="));
  assert.ok(prompt.startsWith(findStickerStyle("3d")!.prompt));
  assert.match(prompt, /do NOT draw any outline/);
});

test("edit kind and flag parsing", () => {
  assert.equal(isStickerEditKind("sticker"), true);
  assert.equal(isStickerEditKind(" sticker "), true);
  assert.equal(isStickerEditKind("photoshoot"), false);
  assert.equal(isStickerFlagOn("true"), true);
  assert.equal(isStickerFlagOn("1"), true);
  assert.equal(isStickerFlagOn("false"), false);
  assert.equal(isStickerFlagOn(undefined), false);
});

test("sticker model resolution", () => {
  const models = [{ id: "a" }, { id: "b" }];
  assert.equal(resolveStickerModel("b", "a", models)?.id, "b");
  assert.equal(resolveStickerModel("", "a", models)?.id, "a");
  assert.equal(resolveStickerModel("", "", models)?.id, "a");
  assert.equal(resolveStickerModel("zzz", "a", models), null);
});
