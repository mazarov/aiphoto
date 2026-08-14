import assert from "node:assert/strict";
import test from "node:test";
import { buildImagePromptAnalyzeBody } from "./image-prompt-analyze-client";

test("analyze body is photoreal RU data URL without image_url", () => {
  const body = buildImagePromptAnalyzeBody("data:image/jpeg;base64,abc");
  assert.equal(body.image_base64, "data:image/jpeg;base64,abc");
  assert.equal(body.style, "photoreal");
  assert.equal(body.locale, "ru");
  assert.equal("image_url" in body, false);
});
