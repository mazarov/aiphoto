import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStorageRenderImagePublicUrl,
  catalogUsesStorageRender,
} from "./card-image-presets";

test("catalog uses render/image unless the flag is 0", () => {
  assert.equal(catalogUsesStorageRender(undefined), true);
  assert.equal(catalogUsesStorageRender(""), true);
  assert.equal(catalogUsesStorageRender("1"), true);
  assert.equal(catalogUsesStorageRender("0"), false);
});

test("render URL carries the listing and hero presets", () => {
  assert.equal(
    buildStorageRenderImagePublicUrl(
      "https://storage.example",
      "cards",
      "a/b.jpg",
      "listing",
    ),
    "https://storage.example/storage/v1/render/image/public/cards/a/b.jpg?width=512&quality=58",
  );
  assert.equal(
    buildStorageRenderImagePublicUrl(
      "https://storage.example",
      "cards",
      "a/b.jpg",
      "hero",
    ),
    "https://storage.example/storage/v1/render/image/public/cards/a/b.jpg?width=512&quality=70",
  );
});
