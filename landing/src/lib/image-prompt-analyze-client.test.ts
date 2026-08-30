import assert from "node:assert/strict";
import test from "node:test";
import { getImagePromptAnalyzeUrl } from "./foto-v-promt-config";
import {
  buildAnalyzeRequestHeaders,
  buildImagePromptAnalyzeBody,
} from "./image-prompt-analyze-client";

test("analyze URL is PromptShot same-origin so locale hits our extract", () => {
  assert.equal(getImagePromptAnalyzeUrl(), "/api/extension/analyze");
});

test("analyze body is photoreal RU data URL without image_url", () => {
  const body = buildImagePromptAnalyzeBody("data:image/jpeg;base64,abc");
  assert.equal(body.image_base64, "data:image/jpeg;base64,abc");
  assert.equal(body.style, "photoreal");
  assert.equal(body.locale, "ru");
  assert.equal("image_url" in body, false);
});

test("analyze request headers set x-client from the calling page", () => {
  const headers = buildAnalyzeRequestHeaders("/generaciya-foto");
  assert.equal(headers["Content-Type"], "application/json");
  assert.equal(headers["x-client"], "generaciya_foto");
  assert.equal(buildAnalyzeRequestHeaders("/foto-v-promt")["x-client"], "foto_v_promt");
  assert.equal(buildAnalyzeRequestHeaders("/admin/analytics")["x-client"], "admin");
});
