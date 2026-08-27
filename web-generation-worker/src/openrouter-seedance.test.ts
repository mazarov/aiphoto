import assert from "node:assert/strict";
import test from "node:test";
import {
  SEEDANCE_25_OPENROUTER_MODEL,
  SEEDANCE_25_VIDEO_MODEL,
  buildSeedanceVideoSubmitBody,
  extractSeedanceJobId,
  isSeedanceDone,
  isSeedanceExpired,
  isSeedanceFailed,
  isSeedanceSafetyBlock,
  isSeedanceVideoModel,
  openrouterVideoContentUrl,
  openrouterVideoPollUrl,
  openrouterVideoSubmitUrl,
  requireOpenRouterBaseUrl,
  seedanceErrorMessage,
  seedanceFailureFromHttp,
  seedanceStatus,
} from "./openrouter-seedance";

const PROXY = "https://gemini-proxy.example.test/u/openrouter.ai";

test("isSeedanceVideoModel matches seedance ids only", () => {
  assert.equal(isSeedanceVideoModel(SEEDANCE_25_VIDEO_MODEL), true);
  assert.equal(isSeedanceVideoModel("seedance-2.5-preview"), true);
  assert.equal(isSeedanceVideoModel("seedream-5.0-pro"), false);
  assert.equal(isSeedanceVideoModel("grok-imagine-video-1.5"), false);
  assert.equal(isSeedanceVideoModel("veo-3.1-lite-generate-preview"), false);
});

test("OPENROUTER_BASE_URL is required and must use /u/", () => {
  assert.throws(() => requireOpenRouterBaseUrl(""), /OPENROUTER_BASE_URL/);
  assert.throws(() => requireOpenRouterBaseUrl("https://openrouter.ai"), /\/u\//);
  assert.equal(requireOpenRouterBaseUrl(`${PROXY}/`), PROXY);
});

test("video URLs stay on the OpenRouter proxy path", () => {
  assert.equal(openrouterVideoSubmitUrl(PROXY), `${PROXY}/api/v1/videos`);
  assert.equal(openrouterVideoPollUrl(PROXY, "job/1"), `${PROXY}/api/v1/videos/job%2F1`);
  assert.equal(openrouterVideoContentUrl(PROXY, "abc"), `${PROXY}/api/v1/videos/abc/content`);
});

test("submit body is I2V first_frame with audio and 720p default", () => {
  assert.deepEqual(
    buildSeedanceVideoSubmitBody({
      prompt: "wave",
      imageUrl: "https://signed.example/frame.jpg",
      durationSeconds: 8,
      aspectRatio: "16:9",
      resolution: "720p",
    }),
    {
      model: SEEDANCE_25_OPENROUTER_MODEL,
      prompt: "wave",
      duration: 8,
      resolution: "720p",
      aspect_ratio: "16:9",
      generate_audio: true,
      frame_images: [
        {
          type: "image_url",
          image_url: { url: "https://signed.example/frame.jpg" },
          frame_type: "first_frame",
        },
      ],
    },
  );
  const fallback = buildSeedanceVideoSubmitBody({
    prompt: "x",
    imageUrl: "https://img.example/a.jpg",
    durationSeconds: 5,
    aspectRatio: "3:4",
    resolution: "4K",
  });
  assert.equal(fallback.aspect_ratio, "9:16");
  assert.equal(fallback.resolution, "720p");
  assert.equal(fallback.duration, 4);
  assert.equal(fallback.generate_audio, true);
});

test("proxied /u/ frame URLs are rejected", () => {
  assert.throws(
    () =>
      buildSeedanceVideoSubmitBody({
        prompt: "x",
        imageUrl: "https://gemini-proxy.example.test/u/openrouter.ai/frame.jpg",
        durationSeconds: 4,
        aspectRatio: "9:16",
      }),
    /seedance_image_input_must_be_public_url/,
  );
});

test("poll payload extracts job id, status, safety, and http mapping", () => {
  assert.equal(extractSeedanceJobId({ id: "job-1" }), "job-1");
  assert.equal(seedanceStatus({ status: "in_progress" }), "in_progress");
  assert.equal(isSeedanceDone("completed"), true);
  assert.equal(isSeedanceFailed("failed"), true);
  assert.equal(isSeedanceExpired("expired"), true);
  assert.equal(isSeedanceSafetyBlock({ error: { code: "content_policy" } }, ""), true);
  assert.equal(isSeedanceSafetyBlock({}, "ok"), false);
  assert.match(seedanceErrorMessage({ error: { message: "nope" } }), /nope/);
  assert.equal(seedanceFailureFromHttp({}, 401).errorType, "config_error");
  assert.equal(seedanceFailureFromHttp({}, 402).retryable, false);
  assert.equal(seedanceFailureFromHttp({}, 429).retryable, true);
  assert.equal(seedanceFailureFromHttp({}, 503).errorType, "seedance_http_503");
});
