import assert from "node:assert/strict";
import test from "node:test";
import {
  GENERATION_CONFIG_CACHE_TTL_MS,
  buildImageGenerationConfigPayload,
  buildVideoGenerationConfigPayload,
  readGenerationConfigMap,
  resetGenerationConfigCacheForTests,
} from "./generation-config-cache";

function makeMockReader(
  handler: () => Promise<{ data: unknown; error: { message: string } | null }>,
) {
  return {
    from(table: string) {
      assert.equal(table, "landing_generation_config");
      return {
        select() {
          return {
            in() {
              return handler();
            },
          };
        },
      };
    },
  };
}

test("readGenerationConfigMap caches within 30s TTL and refreshes after expiry", async () => {
  resetGenerationConfigCacheForTests();
  let calls = 0;
  const reader = makeMockReader(async () => {
    calls += 1;
    return {
      data: [
        { key: "default_model", value: `model-v${calls}` },
        { key: "max_photos", value: "6" },
      ],
      error: null,
    };
  });

  const t0 = 1_000_000;
  const first = await readGenerationConfigMap(reader, t0);
  assert.equal(first.default_model, "model-v1");
  assert.equal(calls, 1);

  const second = await readGenerationConfigMap(
    reader,
    t0 + GENERATION_CONFIG_CACHE_TTL_MS - 1,
  );
  assert.equal(second.default_model, "model-v1");
  assert.equal(calls, 1);

  const third = await readGenerationConfigMap(
    reader,
    t0 + GENERATION_CONFIG_CACHE_TTL_MS + 1,
  );
  assert.equal(third.default_model, "model-v2");
  assert.equal(calls, 2);
});

test("readGenerationConfigMap deduplicates concurrent reads via single-flight", async () => {
  resetGenerationConfigCacheForTests();
  let calls = 0;
  const reader = makeMockReader(async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 15));
    return {
      data: [{ key: "default_aspect_ratio", value: "3:4" }],
      error: null,
    };
  });

  const results = await Promise.all(
    Array.from({ length: 8 }, () => readGenerationConfigMap(reader, 5_000)),
  );
  assert.equal(calls, 1);
  for (const map of results) {
    assert.equal(map.default_aspect_ratio, "3:4");
  }
});

test("readGenerationConfigMap serves stale config on transient DB error after warmup", async () => {
  resetGenerationConfigCacheForTests();
  let shouldFail = false;
  const reader = makeMockReader(async () => {
    if (shouldFail) {
      return { data: null, error: { message: "connection timeout" } };
    }
    return {
      data: [{ key: "default_image_size", value: "2K" }],
      error: null,
    };
  });

  const warm = await readGenerationConfigMap(reader, 10_000);
  assert.equal(warm.default_image_size, "2K");

  shouldFail = true;
  const fallback = await readGenerationConfigMap(
    reader,
    10_000 + GENERATION_CONFIG_CACHE_TTL_MS + 100,
  );
  assert.equal(fallback.default_image_size, "2K");
});

test("cached config map isolates feature flags per user email allowlist", () => {
  const config = {
    photoshoot_enabled: "false",
    video_animate_enabled: "false",
    sticker_generation_enabled: "false",
    sticker_pack_enabled: "false",
    preserve_outfit_enabled: "false",
  };

  const guestImage = buildImageGenerationConfigPayload(config, null);
  const guestVideo = buildVideoGenerationConfigPayload(config, "user@example.com");
  assert.equal(guestImage.photoshootEnabled, false);
  assert.equal(guestImage.stickerEnabled, false);
  assert.equal(guestImage.stickerPackEnabled, false);
  assert.equal(guestImage.preserveOutfitEnabled, false);
  assert.equal(guestVideo.enabled, false);

  const internalImage = buildImageGenerationConfigPayload(
    config,
    "azarov.maxim@gmail.com",
  );
  const internalVideo = buildVideoGenerationConfigPayload(
    config,
    "azarov.maxim@gmail.com",
  );
  assert.equal(internalImage.photoshootEnabled, true);
  assert.equal(internalImage.stickerEnabled, true);
  assert.equal(internalImage.stickerPackEnabled, true);
  assert.equal(internalImage.preserveOutfitEnabled, true);
  assert.equal(internalVideo.enabled, true);
});
