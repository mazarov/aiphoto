import assert from "node:assert/strict";
import test from "node:test";
import {
  buildVeoLiteSubmitBody,
  extractVeoOperationName,
  extractVeoVideo,
  isVeoLiteVideoModel,
  isVeoOperationDone,
  isVeoOperationFailed,
  isVeoSafetyBlock,
  normalizeVeoLiteDurationSeconds,
  rewriteGeminiMediaUrl,
  veoErrorMessage,
  veoPollUrl,
  veoSubmitUrl,
} from "./veo-video";

test("isVeoLiteVideoModel matches lite ids only", () => {
  assert.equal(isVeoLiteVideoModel("veo-3.1-lite-generate-preview"), true);
  assert.equal(isVeoLiteVideoModel("veo-3.1-generate-preview"), false);
  assert.equal(isVeoLiteVideoModel("gemini-omni-flash-preview"), false);
});

test("Lite duration allowlist is 4/6/8 and clamps 10 to 8", () => {
  assert.equal(normalizeVeoLiteDurationSeconds(4), 4);
  assert.equal(normalizeVeoLiteDurationSeconds(6), 6);
  assert.equal(normalizeVeoLiteDurationSeconds(8), 8);
  assert.equal(normalizeVeoLiteDurationSeconds(10), 8);
  assert.equal(normalizeVeoLiteDurationSeconds(5), 4);
});

test("Veo LRO urls stay on the Gemini proxy base", () => {
  const base = "https://gemini-proxy.example.test";
  assert.equal(
    veoSubmitUrl(base, "veo-3.1-lite-generate-preview"),
    "https://gemini-proxy.example.test/v1beta/models/veo-3.1-lite-generate-preview:predictLongRunning",
  );
  assert.equal(
    veoPollUrl(base, "models/veo-3.1-lite-generate-preview/operations/abc"),
    "https://gemini-proxy.example.test/v1beta/models/veo-3.1-lite-generate-preview/operations/abc",
  );
  assert.equal(
    veoPollUrl(base, "v1beta/operations/abc"),
    "https://gemini-proxy.example.test/v1beta/operations/abc",
  );
});

test("submit body is image-to-video with allow_adult and 720p", () => {
  assert.deepEqual(
    buildVeoLiteSubmitBody({
      prompt: "wave",
      image: { mimeType: "image/jpeg", data: "abc" },
      aspectRatio: "9:16",
      durationSeconds: 10,
      resolution: "4K",
    }),
    {
      instances: [
        {
          prompt: "wave",
          image: { bytesBase64Encoded: "abc", mimeType: "image/jpeg" },
        },
      ],
      parameters: {
        aspectRatio: "9:16",
        durationSeconds: 8,
        resolution: "720p",
        personGeneration: "allow_adult",
      },
    },
  );
});

test("poll payload extracts operation name, video uri, and RAI filters", () => {
  assert.equal(
    extractVeoOperationName({ name: "models/veo-3.1-lite-generate-preview/operations/1" }),
    "models/veo-3.1-lite-generate-preview/operations/1",
  );
  assert.equal(isVeoOperationDone({ done: true }), true);
  assert.equal(isVeoOperationFailed({ error: { message: "nope" } }), true);
  assert.deepEqual(
    extractVeoVideo({
      done: true,
      response: {
        generateVideoResponse: {
          generatedSamples: [{ video: { uri: "https://generativelanguage.googleapis.com/v1beta/files/x" } }],
        },
      },
    }),
    { kind: "uri", uri: "https://generativelanguage.googleapis.com/v1beta/files/x" },
  );
  assert.equal(
    isVeoSafetyBlock({ response: { generateVideoResponse: { raiMediaFilteredCount: 1 } } }, ""),
    true,
  );
  assert.match(veoErrorMessage({ error: { message: "blocked", status: "INVALID_ARGUMENT" } }), /blocked/);
});

test("Gemini file URLs are rewritten onto the proxy origin", () => {
  assert.equal(
    rewriteGeminiMediaUrl(
      "https://generativelanguage.googleapis.com/v1beta/files/x?alt=media",
      "https://gemini-proxy.example.test",
    ),
    "https://gemini-proxy.example.test/v1beta/files/x?alt=media",
  );
  assert.equal(
    rewriteGeminiMediaUrl("https://cdn.example/out.mp4", "https://gemini-proxy.example.test"),
    "https://cdn.example/out.mp4",
  );
});
