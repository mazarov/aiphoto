import assert from "node:assert/strict";
import test from "node:test";
import {
  extractInteractionId,
  extractInteractionVideo,
  interactionStatus,
  isInteractionCompleted,
  isSafetyBlock,
} from "./video-interaction";

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
