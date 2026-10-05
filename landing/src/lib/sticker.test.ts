import assert from "node:assert/strict";
import test from "node:test";
import {
  assembleStickerFinalPrompt,
  buildStickerPromptText,
  DEFAULT_STICKER_STYLE_ID,
  findStickerStyle,
  isStickerEditKind,
  isStickerFlagOn,
  parseStickerStyleIdFromPrompt,
  resolveStickerModel,
  STICKER_BACKGROUND_HEX,
  STICKER_STYLES,
  stripStickerPromptMarker,
} from "./sticker";

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
