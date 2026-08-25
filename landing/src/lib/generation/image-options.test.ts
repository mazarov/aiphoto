import assert from "node:assert/strict";
import test from "node:test";
import {
  clampImageSizeForModel,
  imageSizeOptionsForModel,
  isSeedreamImageModel,
} from "./image-options";

test("Seedream hides 1K and clamps prefs to 2K", () => {
  assert.equal(isSeedreamImageModel("seedream-4.5"), true);
  assert.deepEqual(
    imageSizeOptionsForModel("seedream-4.5").map((item) => item.value),
    ["2K", "4K"],
  );
  assert.equal(clampImageSizeForModel("seedream-4.5", "1K"), "2K");
  assert.equal(clampImageSizeForModel("seedream-4.5", "4K"), "4K");
  assert.equal(clampImageSizeForModel("grok-imagine-image-2.0", "4K"), "2K");
});
