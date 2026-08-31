import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_VIDEO_PROMPT } from "./generation/image-options";
import {
  assembleVideoCatalogPrompt,
  canUseGenerationAsVideoCatalogImageSource,
  splitVideoCatalogPrompt,
  VIDEO_CATALOG_MOTION_HEADING,
  videoCatalogSourceGenerationIds,
} from "./video-catalog-prompt";

test("source ids keep parent then library, unique and trimmed", () => {
  assert.deepEqual(
    videoCatalogSourceGenerationIds({
      parentGenerationId: " parent-1 ",
      librarySourceGenerationId: "parent-1",
    }),
    ["parent-1"],
  );
  assert.deepEqual(
    videoCatalogSourceGenerationIds({
      parentGenerationId: null,
      librarySourceGenerationId: "lib-1",
    }),
    ["lib-1"],
  );
  assert.deepEqual(
    videoCatalogSourceGenerationIds({
      parentGenerationId: "parent-1",
      librarySourceGenerationId: "lib-1",
    }),
    ["parent-1", "lib-1"],
  );
});

test("only a completed still with prompt is an image source", () => {
  assert.equal(
    canUseGenerationAsVideoCatalogImageSource({
      status: "completed",
      modality: "image",
      promptText: "Visual Hook:\nGold dress",
    }),
    true,
  );
  assert.equal(
    canUseGenerationAsVideoCatalogImageSource({
      status: "completed",
      modality: "video",
      promptText: "Ветер в волосах",
    }),
    false,
  );
  assert.equal(
    canUseGenerationAsVideoCatalogImageSource({
      status: "completed",
      modality: "image",
      promptText: "   ",
    }),
    false,
  );
});

test("assemble keeps motion-only when there is no parent look", () => {
  assert.equal(
    assembleVideoCatalogPrompt({ motionPrompt: "Шары поднимаются вверх" }),
    "Шары поднимаются вверх",
  );
});

test("assemble always writes a Motion section when look exists", () => {
  assert.equal(
    assembleVideoCatalogPrompt({
      imagePrompt: "Visual Hook:\nGold dress",
      motionPrompt: "Оживи изображение",
    }),
    `Visual Hook:\nGold dress\n\n${VIDEO_CATALOG_MOTION_HEADING}\n${DEFAULT_VIDEO_PROMPT}`,
  );
});

test("split returns look and motion for a catalog card", () => {
  const assembled = assembleVideoCatalogPrompt({
    imagePrompt: "Visual Hook:\nGold dress\n\nScene:\nStudio",
    motionPrompt: "Шары медленно поднимаются вверх",
  });
  assert.deepEqual(splitVideoCatalogPrompt(assembled), {
    imagePrompt: "Visual Hook:\nGold dress\n\nScene:\nStudio",
    motionPrompt: "Шары медленно поднимаются вверх",
  });
});

test("split treats a photo extract without Motion as look plus default beat", () => {
  assert.deepEqual(
    splitVideoCatalogPrompt("Visual Hook:\nGold dress\n\nScene:\nStudio\n\nGenre:\nPortrait\n\nPose:\nStanding"),
    {
      imagePrompt:
        "Visual Hook:\nGold dress\n\nScene:\nStudio\n\nGenre:\nPortrait\n\nPose:\nStanding",
      motionPrompt: DEFAULT_VIDEO_PROMPT,
    },
  );
});

test("split keeps a motion-only card as video beat", () => {
  assert.deepEqual(splitVideoCatalogPrompt("Шары поднимаются вверх"), {
    imagePrompt: "",
    motionPrompt: "Шары поднимаются вверх",
  });
});

test("assemble appends a Motion section once", () => {
  const assembled = assembleVideoCatalogPrompt({
    imagePrompt: "Visual Hook:\nGold dress\n\nScene:\nStudio",
    motionPrompt: "Шары медленно поднимаются вверх",
  });
  assert.equal(
    assembled,
    `Visual Hook:\nGold dress\n\nScene:\nStudio\n\n${VIDEO_CATALOG_MOTION_HEADING}\nШары медленно поднимаются вверх`,
  );
  assert.equal(
    assembleVideoCatalogPrompt({
      imagePrompt: assembled,
      motionPrompt: "Шары медленно поднимаются вверх",
    }),
    assembled,
  );
});
