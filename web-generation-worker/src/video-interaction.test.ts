import assert from "node:assert/strict";
import test from "node:test";
import { assembleVideoMotionPrompt } from "../../landing/src/lib/video-motion-prompt";
import {
  buildVideoInteractionRequest,
  extractInteractionId,
  extractInteractionVideo,
  interactionErrorCode,
  interactionErrorMessage,
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
  assert.equal(body.background, false);
  assert.equal(body.store, false);
  assert.equal(body.stream, false);
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

test("motion prompt tags Image2 when identity reference is present", () => {
  const assembled = assembleVideoMotionPrompt("Оживи изображение", {
    hasIdentityReference: true,
  });
  assert.match(assembled, /\[# Sources @Image1\] \[# References @Image2\]/);
  assert.match(assembled, /Image2 as a reference for the person's identity/);
  assert.doesNotMatch(assembleVideoMotionPrompt("Оживи изображение"), /@Image2/);
});

test("Interactions payload appends identity photo as Image2", () => {
  const body = buildVideoInteractionRequest({
    model: "gemini-omni-flash-preview",
    prompt: "[# Sources @Image1] [# References @Image2]",
    image: { mimeType: "image/jpeg", data: "frame" },
    identityImage: { mimeType: "image/png", data: "face" },
    aspectRatio: "9:16",
  });
  assert.deepEqual(body.input, [
    { type: "image", data: "frame", mime_type: "image/jpeg" },
    { type: "image", data: "face", mime_type: "image/png" },
    { type: "text", text: "[# Sources @Image1] [# References @Image2]" },
  ]);
  assert.deepEqual(body.generation_config.video_config, { task: "image_to_video" });
});

test("extractInteractionId reads id or name", () => {
  assert.equal(extractInteractionId({ id: "abc" }), "abc");
  assert.equal(extractInteractionId({ name: "interactions/xyz" }), "interactions/xyz");
  assert.equal(extractInteractionId({}), "");
});

test("extractInteractionVideo finds inline and uri payloads", () => {
  assert.equal(extractInteractionVideo(null), null);
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

test("interaction error extracts opaque invalid_request", () => {
  const payload = {
    error: {
      message: "There was a problem processing your request. You will not be charged.",
      code: "invalid_request",
    },
  };
  assert.equal(interactionErrorCode(payload), "invalid_request");
  assert.match(interactionErrorMessage(payload), /invalid_request/);
});
