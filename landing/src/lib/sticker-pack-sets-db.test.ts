import assert from "node:assert/strict";
import test from "node:test";
import { stickerPackSetFromRow } from "./sticker-pack-sets-db";

const scenes = Array.from({ length: 16 }, (_, i) => `{subject} pose ${i + 1}`);

test("active 16-sticker set with 16 scenes maps to a pack set", () => {
  const set = stickerPackSetFromRow({
    id: "office_day",
    name_ru: "  Офисный   день ",
    sticker_count: 16,
    is_active: true,
    scene_descriptions: scenes,
  });
  assert.ok(set);
  assert.equal(set.id, "office_day");
  assert.equal(set.name, "Офисный день");
  assert.equal(set.scenes.length, 16);
  assert.equal(set.scenes[0], "the person pose 1");
});

test("inactive, legacy 9-sticker or short scene lists are rejected", () => {
  const base = { id: "x", name_ru: "X", sticker_count: 16, is_active: true, scene_descriptions: scenes };
  assert.equal(stickerPackSetFromRow({ ...base, is_active: false }), null);
  assert.equal(stickerPackSetFromRow({ ...base, sticker_count: 9 }), null);
  assert.equal(stickerPackSetFromRow({ ...base, scene_descriptions: scenes.slice(0, 9) }), null);
  assert.equal(stickerPackSetFromRow({ ...base, id: "bad id!" }), null);
  assert.equal(stickerPackSetFromRow(null), null);
});
