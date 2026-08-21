import assert from "node:assert/strict";
import test from "node:test";
import {
  GROK_IMAGINE_IMAGE_MODEL,
  buildXaiImageEditBody,
  buildXaiImageGenerateBody,
  clampGrokImageParts,
  extractXaiImageBase64,
  extractXaiImageUrl,
  isGrokImageModel,
  isXaiImageSafetyBlock,
  mapGrokImageResolution,
  rewriteXaiImageDownloadUrl,
  xaiImageEditUrl,
  xaiImageGenerateUrl,
} from "./xai-image";
import { requireXaiBaseUrl } from "./xai-video";

test("isGrokImageModel matches imagine-image ids only", () => {
  assert.equal(isGrokImageModel("grok-imagine-image-2.0"), true);
  assert.equal(isGrokImageModel("grok-imagine-image"), true);
  assert.equal(isGrokImageModel("grok-imagine-video-1.5"), false);
  assert.equal(isGrokImageModel("gemini-2.5-flash-image"), false);
});

test("image URLs stay on XAI_BASE_URL and never invent api.x.ai", () => {
  assert.throws(() => requireXaiBaseUrl(""), /XAI_BASE_URL/);
  const base = "https://gemini-proxy.example.test/u/api.x.ai";
  assert.equal(xaiImageGenerateUrl(base), `${base}/v1/images/generations`);
  assert.equal(xaiImageEditUrl(base), `${base}/v1/images/edits`);
  assert.equal(
    rewriteXaiImageDownloadUrl("https://api.x.ai/v1/images/abc.png?tok=1", base),
    `${base}/v1/images/abc.png?tok=1`,
  );
});

test("resolution maps 1K/2K and clamps 4K", () => {
  assert.deepEqual(mapGrokImageResolution("1K"), { resolution: "1k", clamped: false });
  assert.deepEqual(mapGrokImageResolution("2K"), { resolution: "2k", clamped: false });
  assert.deepEqual(mapGrokImageResolution("4K"), { resolution: "2k", clamped: true });
});

test("generate body is text-to-image with b64 and medium quality", () => {
  assert.deepEqual(
    buildXaiImageGenerateBody({
      model: GROK_IMAGINE_IMAGE_MODEL,
      prompt: "a cat",
      aspectRatio: "9:16",
      resolution: "1k",
    }),
    {
      model: GROK_IMAGINE_IMAGE_MODEL,
      prompt: "a cat",
      n: 1,
      aspect_ratio: "9:16",
      resolution: "1k",
      quality: "medium",
      response_format: "b64_json",
    },
  );
});

test("edit body clamps to 3 images and uses data URIs", () => {
  const images = [1, 2, 3, 4].map((n) => ({ mimeType: "image/jpeg", data: `abc${n}` }));
  const clamped = clampGrokImageParts(images);
  assert.equal(clamped.clamped, true);
  assert.equal(clamped.parts.length, 3);
  const body = buildXaiImageEditBody({
    model: "",
    prompt: "edit",
    aspectRatio: "1:1",
    resolution: "2k",
    images,
  });
  assert.equal(body.model, GROK_IMAGINE_IMAGE_MODEL);
  assert.ok(Array.isArray(body.image));
  assert.equal((body.image as unknown[]).length, 3);
  assert.equal(
    (body.image as Array<{ url: string }>)[0].url,
    "data:image/jpeg;base64,abc1",
  );
});

test("extracts b64 or url from OpenAI-shaped payload", () => {
  assert.equal(extractXaiImageBase64({ data: [{ b64_json: "Zm9v" }] }), "Zm9v");
  assert.equal(extractXaiImageUrl({ data: [{ url: "https://cdn.example/a.png" }] }), "https://cdn.example/a.png");
  assert.equal(isXaiImageSafetyBlock({ respect_moderation: false }, ""), true);
  assert.equal(isXaiImageSafetyBlock({ error: { code: "usage_guideline_violation" } }, ""), true);
  assert.equal(isXaiImageSafetyBlock({}, "ok"), false);
});
