import assert from "node:assert/strict";
import test from "node:test";
import {
  buildXaiVideoSubmitBody,
  extractXaiRequestId,
  extractXaiVideoUrl,
  isGrokVideoModel,
  isXaiDone,
  isXaiExpired,
  isXaiFailed,
  isXaiSafetyBlock,
  requireXaiBaseUrl,
  rewriteXaiDownloadUrl,
  xaiErrorMessage,
  xaiPollUrl,
  xaiProxyHost,
  xaiStatus,
  xaiSubmitUrl,
} from "./xai-video";

test("isGrokVideoModel matches imagine-video ids only", () => {
  assert.equal(isGrokVideoModel("grok-imagine-video-1.5"), true);
  assert.equal(isGrokVideoModel("grok-imagine-video-1.5-preview"), true);
  assert.equal(isGrokVideoModel("gemini-omni-flash-preview"), false);
  assert.equal(isGrokVideoModel("veo-3.1-lite-generate-preview"), false);
});

test("XAI_BASE_URL is required and never falls back to api.x.ai", () => {
  assert.throws(() => requireXaiBaseUrl(""), /XAI_BASE_URL/);
  assert.throws(() => requireXaiBaseUrl("   "), /XAI_BASE_URL/);
  assert.equal(requireXaiBaseUrl("https://xai-proxy.example.test/"), "https://xai-proxy.example.test");
  assert.equal(
    xaiSubmitUrl("https://xai-proxy.example.test"),
    "https://xai-proxy.example.test/v1/videos/generations",
  );
  assert.equal(
    xaiPollUrl("https://xai-proxy.example.test", "req/1"),
    "https://xai-proxy.example.test/v1/videos/req%2F1",
  );
  assert.equal(xaiProxyHost("https://xai-proxy.example.test/v"), "xai-proxy.example.test");
});

test("submit body is image-to-video with duration and 720p default", () => {
  assert.deepEqual(
    buildXaiVideoSubmitBody({
      model: "grok-imagine-video-1.5",
      prompt: "wave",
      imageUrl: "https://signed.example/frame.jpg",
      durationSeconds: 8,
      aspectRatio: "16:9",
      resolution: "720p",
    }),
    {
      model: "grok-imagine-video-1.5",
      prompt: "wave",
      image: { url: "https://signed.example/frame.jpg" },
      duration: 8,
      aspect_ratio: "16:9",
      resolution: "720p",
    },
  );
  const fallback = buildXaiVideoSubmitBody({
    model: "",
    prompt: "x",
    imageUrl: "https://img",
    durationSeconds: 4,
    aspectRatio: "3:4",
    resolution: "4K",
  });
  assert.equal(fallback.aspect_ratio, "9:16");
  assert.equal(fallback.resolution, "720p");
});

test("poll payload extracts request id, status, and video url", () => {
  assert.equal(extractXaiRequestId({ request_id: "abc" }), "abc");
  assert.equal(extractXaiRequestId({ id: "xyz" }), "xyz");
  assert.equal(xaiStatus({ status: "done" }), "done");
  assert.equal(isXaiDone("done"), true);
  assert.equal(isXaiFailed("failed"), true);
  assert.equal(isXaiExpired("expired"), true);
  assert.equal(
    extractXaiVideoUrl({ video: { url: "https://cdn.example/out.mp4" } }),
    "https://cdn.example/out.mp4",
  );
});

test("XAI_BASE_URL /u/api.x.ai keeps vendor path after the shared proxy host", () => {
  const base = "https://gemini-proxy.example.test/u/api.x.ai";
  assert.equal(
    xaiSubmitUrl(base),
    "https://gemini-proxy.example.test/u/api.x.ai/v1/videos/generations",
  );
  assert.equal(xaiPollUrl(base, "abc"), "https://gemini-proxy.example.test/u/api.x.ai/v1/videos/abc");
  assert.equal(xaiProxyHost(base), "gemini-proxy.example.test");
  assert.equal(
    rewriteXaiDownloadUrl("https://api.x.ai/v1/videos/abc/file.mp4?tok=1", base),
    "https://gemini-proxy.example.test/u/api.x.ai/v1/videos/abc/file.mp4?tok=1",
  );
});

test("download rewrite uses proxy only for api.x.ai host", () => {
  assert.equal(
    rewriteXaiDownloadUrl(
      "https://api.x.ai/v1/videos/abc/file.mp4?tok=1",
      "https://xai-proxy.example.test",
    ),
    "https://xai-proxy.example.test/v1/videos/abc/file.mp4?tok=1",
  );
  assert.equal(
    rewriteXaiDownloadUrl("https://cdn.example/out.mp4", "https://xai-proxy.example.test"),
    "https://cdn.example/out.mp4",
  );
});

test("safety and guideline violations are detected", () => {
  assert.equal(isXaiSafetyBlock({ error: { code: "usage_guideline_violation" } }, ""), true);
  assert.equal(isXaiSafetyBlock({}, "ok"), false);
  assert.match(xaiErrorMessage({ error: { message: "nope", code: "failed" } }), /nope/);
});
