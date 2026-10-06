import assert from "node:assert/strict";
import test from "node:test";
import {
  assembleStickerFinalPrompt,
  buildStickerBorderPromptText,
  buildStickerEditPromptText,
  buildStickerPromptText,
  buildStickerTextPromptText,
  clampStickerBorderPx,
  DEFAULT_STICKER_STYLE_ID,
  findStickerStyle,
  isStickerEditAction,
  isStickerEditKind,
  isStickerFlagOn,
  isStickerTextPromptText,
  normalizeStickerOverlayText,
  parseStickerBorderPxFromPrompt,
  parseStickerEditFromPrompt,
  parseStickerEdgeMode,
  parseStickerStyleIdFromPrompt,
  resolveStickerModel,
  stickerEdgeForRoute,
  sanitizeStickerCustomHint,
  STICKER_BACKGROUND_HEX,
  STICKER_BORDER_MAX_PX,
  STICKER_BORDER_MIN_PX,
  STICKER_BORDER_PRESETS_PX,
  STICKER_BORDER_PX,
  STICKER_CUSTOM_HINT_MAX,
  STICKER_STYLES,
  STICKER_TEXT_MAX_CHARS,
  isStickerFromResultParent,
  stickerEditFingerprintFields,
  stickerFromResultFingerprintFields,
  stickerRestyleFingerprintFields,
  stripStickerPromptMarker,
} from "./sticker";

test("edge policy: soft for real mattes, hard for chroma ramps, hard everywhere under the rollback knob", () => {
  assert.equal(parseStickerEdgeMode(undefined), "soft");
  assert.equal(parseStickerEdgeMode(" HARD "), "hard");
  assert.equal(parseStickerEdgeMode("anything"), "soft");
  assert.equal(stickerEdgeForRoute("alpha_native"), "soft");
  assert.equal(stickerEdgeForRoute("rembg"), "soft");
  assert.equal(stickerEdgeForRoute("rembg_forced"), "soft");
  assert.equal(stickerEdgeForRoute("chroma"), "hard");
  assert.equal(stickerEdgeForRoute("chroma_rembg"), "hard");
  assert.equal(stickerEdgeForRoute("alpha_native", "hard"), "hard");
});

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
  assert.equal(isStickerEditAction("revise"), true);
  assert.equal(isStickerEditAction("text"), false);
  assert.deepEqual(stickerEditFingerprintFields(" p1 ", { action: "motion", presetId: "", hint: " x y " }), {
    editKind: "sticker",
    parentGenerationId: "p1",
    stickerAction: "motion",
    stickerPresetId: "custom",
    stickerHint: "x y",
  });

  const reviseText = buildStickerEditPromptText({ action: "revise", presetId: "custom", hint: "добавь очки" });
  assert.equal(reviseText, "STICKER edit=revise preset=custom\nдобавь очки");
  assert.deepEqual(parseStickerEditFromPrompt(reviseText), {
    action: "revise",
    presetId: "custom",
    hint: "добавь очки",
  });
  const revisePrompt = assembleStickerFinalPrompt(reviseText);
  assert.match(revisePrompt, /applying ONLY this change: "добавь очки"/);
  assert.match(revisePrompt, /Clothing, props and pose change only if the request asks for it/);
  assert.ok(!revisePrompt.includes("STICKER edit="));
  assert.ok(!revisePrompt.includes("emotion / facial expression"));
  assert.ok(!revisePrompt.includes("motion / body pose"));
  const reviseTransparent = assembleStickerFinalPrompt(reviseText, "transparent");
  assert.match(reviseTransparent, /fully TRANSPARENT \(alpha channel\)/);
  assert.doesNotMatch(reviseTransparent, /MAGENTA|magenta/);
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

test("border px is clamped to the shared bounds and round-trips through prompt_text", () => {
  assert.equal(clampStickerBorderPx(undefined), STICKER_BORDER_PX);
  assert.equal(clampStickerBorderPx("abc"), STICKER_BORDER_PX);
  assert.equal(clampStickerBorderPx(0), STICKER_BORDER_MIN_PX);
  assert.equal(clampStickerBorderPx(-5), STICKER_BORDER_MIN_PX);
  assert.equal(clampStickerBorderPx(999), STICKER_BORDER_MAX_PX);
  assert.equal(clampStickerBorderPx("12"), 12);
  assert.equal(clampStickerBorderPx(7.6), 8);
  for (const preset of STICKER_BORDER_PRESETS_PX) {
    assert.equal(clampStickerBorderPx(preset), preset, `preset ${preset} is inside bounds`);
  }

  assert.equal(buildStickerBorderPromptText(12), "STICKER border px=12");
  assert.equal(buildStickerBorderPromptText(), `STICKER border px=${STICKER_BORDER_PX}`);
  assert.equal(buildStickerBorderPromptText(500), `STICKER border px=${STICKER_BORDER_MAX_PX}`);
  assert.equal(parseStickerBorderPxFromPrompt("STICKER border px=12"), 12);
  // Rows written before the width was configurable carry no px → default.
  assert.equal(parseStickerBorderPxFromPrompt("STICKER border"), STICKER_BORDER_PX);
  assert.equal(parseStickerBorderPxFromPrompt(buildStickerTextPromptText("Привет")), null);
  assert.equal(parseStickerBorderPxFromPrompt(buildStickerPromptText("anime")), null);
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

test("sticker from a finished photo: parent shape and fingerprint", () => {
  assert.equal(isStickerFromResultParent({ modality: "image", editKind: null }), true);
  assert.equal(isStickerFromResultParent({ editKind: "" }), true);
  assert.equal(isStickerFromResultParent({ editKind: "local_edit" }), true);
  assert.equal(isStickerFromResultParent({ modality: "video", editKind: null }), false);
  assert.equal(isStickerFromResultParent({ editKind: "sticker" }), false);
  assert.equal(isStickerFromResultParent({ editKind: " sticker " }), false);
  assert.equal(isStickerFromResultParent({ editKind: "sticker_pack" }), false);
  assert.equal(isStickerFromResultParent({ editKind: "photoshoot" }), false);
  assert.deepEqual(stickerRestyleFingerprintFields(" sticker ", " anime "), {
    editKind: "sticker",
    parentGenerationId: "sticker",
    stickerStyleId: "anime",
    source: "restyle",
  });
  assert.deepEqual(stickerFromResultFingerprintFields(" parent ", " cartoon "), {
    editKind: "sticker",
    parentGenerationId: "parent",
    stickerStyleId: "cartoon",
    source: "result",
  });
});

test("sticker model resolution", () => {
  const models = [{ id: "a" }, { id: "b" }];
  assert.equal(resolveStickerModel("b", "a", models)?.id, "b");
  assert.equal(resolveStickerModel("", "a", models)?.id, "a");
  assert.equal(resolveStickerModel("", "", models)?.id, "a");
  assert.equal(resolveStickerModel("zzz", "a", models), null);
});
