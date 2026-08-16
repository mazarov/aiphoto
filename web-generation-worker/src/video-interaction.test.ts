import assert from "node:assert/strict";
import test from "node:test";
import {
  buildVideoInteractionRequest,
  extractInteractionId,
  extractInteractionVideo,
  interactionStatus,
  isInteractionCompleted,
  isSafetyBlock,
} from "./video-interaction";

test("Interactions payload puts aspect_ratio on response_format only", () => {
  const body = buildVideoInteractionRequest({
    model: "gemini-omni-flash-preview",
    prompt: "Оживи изображение",
    image: { mimeType: "image/jpeg", data: "abc" },
    aspectRatio: "9:16",
  });
  assert.deepEqual(body.generation_config.video_config, { task: "image_to_video" });
  assert.equal("aspect_ratio" in body.generation_config.video_config, false);
  assert.deepEqual(body.response_format, {
    type: "video",
    aspect_ratio: "9:16",
  });
  assert.equal(body.background, true);
  assert.equal(
    buildVideoInteractionRequest({
      model: "gemini-omni-flash-preview",
      prompt: "x",
      image: { mimeType: "image/jpeg", data: "abc" },
      aspectRatio: "16:9",
    }).response_format.aspect_ratio,
    "16:9",
  );
});

test("extractInteractionId reads id or name", () => {
  assert.equal(extractInteractionId({ id: "abc" }), "abc");
  assert.equal(extractInteractionId({ name: "interactions/xyz" }), "interactions/xyz");
  assert.equal(extractInteractionId({}), "");
});

test("extractInteractionVideo finds inline and uri payloads", () => {
  assert.deepEqual(
    extractInteractionVideo({
      steps: [{ content: [{ type: "video", data: "AAAA", mime_type: "video/mp4" }] }],
    }),
    { kind: "inline", data: "AAAA", mimeType: "video/mp4" },
  );
  assert.deepEqual(
    extractInteractionVideo({
      result: { outputs: [{ output_video: { uri: "https://example/file.mp4" } }] },
    }),
    { kind: "uri", uri: "https://example/file.mp4", mimeType: "video/mp4" },
  );
});

test("interaction status helpers", () => {
  assert.equal(isInteractionCompleted(interactionStatus({ status: "completed" })), true);
  assert.equal(isSafetyBlock({ error: { status: "SAFETY" } }, "blocked"), true);
});
