import assert from "node:assert/strict";
import test from "node:test";
import { PHOTO_GUIDE_PORTRAIT_SRC } from "./user-generation-photos-cache";
import {
  PHOTOSHOOT_COMPOSE_EXAMPLE_CONFIG_KEY,
  PHOTOSHOOT_COMPOSE_EXAMPLE_SLUG,
  PHOTOSHOOT_COMPOSE_EXAMPLE_SOURCE_SRC,
  PHOTOSHOOT_COMPOSE_EXAMPLE_TILE_SRCS,
  composePhotoshootGuideExample,
  isPhotoshootComposeExampleUnlocked,
} from "./photoshoot-compose-example";

test("photoshoot compose example is one source photo then four tiles", () => {
  assert.equal(
    PHOTOSHOOT_COMPOSE_EXAMPLE_CONFIG_KEY,
    "photoshoot_compose_example_enabled",
  );
  assert.equal(
    PHOTOSHOOT_COMPOSE_EXAMPLE_SLUG,
    "photoshoot-plannertemperature200-four-frame-contact-sheet-from-the-attached-phot-c0b56",
  );
  const on = composePhotoshootGuideExample(true);
  assert.equal(on.sourceUrl, PHOTOSHOOT_COMPOSE_EXAMPLE_SOURCE_SRC);
  assert.equal(on.tileUrls.length, 4);
  assert.deepEqual(on.tileUrls, PHOTOSHOOT_COMPOSE_EXAMPLE_TILE_SRCS);
  assert.equal(on.cropTiles, false);
  const off = composePhotoshootGuideExample(false);
  assert.equal(off.sourceUrl, PHOTO_GUIDE_PORTRAIT_SRC);
  assert.equal(off.cropTiles, true);
  assert.equal(off.tileUrls.length, 4);
});

test("photoshoot compose example stays off for regular users when the flag is off", () => {
  assert.equal(
    isPhotoshootComposeExampleUnlocked("true", "user@example.com"),
    true,
  );
  assert.equal(
    isPhotoshootComposeExampleUnlocked("false", "azarov.maxim@gmail.com"),
    true,
  );
  if (process.env.NODE_ENV !== "development") {
    assert.equal(
      isPhotoshootComposeExampleUnlocked("false", "user@example.com"),
      false,
    );
    assert.equal(isPhotoshootComposeExampleUnlocked(undefined, null), false);
  }
});
