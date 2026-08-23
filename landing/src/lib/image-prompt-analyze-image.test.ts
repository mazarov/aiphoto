import assert from "node:assert/strict";
import test from "node:test";
import {
  parseAnalyzeImageDataUrl,
  resolveAnalyzeImageFromBody,
} from "./image-prompt-analyze-image";

const PNG_1X1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

test("parseAnalyzeImageDataUrl accepts a tiny PNG data URL", () => {
  const parsed = parseAnalyzeImageDataUrl(PNG_1X1);
  assert.ok(parsed);
  assert.equal(parsed?.mimeType, "image/png");
  assert.ok(parsed && parsed.data.length > 0);
});

test("parseAnalyzeImageDataUrl rejects junk", () => {
  assert.equal(parseAnalyzeImageDataUrl("not-a-data-url"), null);
  assert.equal(parseAnalyzeImageDataUrl("data:image/png;base64,@@@@"), null);
});

test("resolveAnalyzeImageFromBody requires exactly one image field", async () => {
  assert.equal((await resolveAnalyzeImageFromBody({})).ok, false);
  assert.equal(
    (await resolveAnalyzeImageFromBody({ image_base64: PNG_1X1, image_url: "https://x" })).ok,
    false,
  );
  const ok = await resolveAnalyzeImageFromBody({ image_base64: PNG_1X1 });
  assert.equal(ok.ok, true);
});
