import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSeedreamImageBody,
  clampFluxSafetyTolerance,
  extractSeedreamImageBase64,
  extractSeedreamImageUrl,
  extractSeedreamOperationId,
  isSeedreamImageModel,
  isSeedreamSafetyBlock,
  mapSeedreamImageSize,
  requireOpenRouterBaseUrl,
  rewriteOpenRouterUrl,
  runSeedreamImage,
  seedreamSubmitUrl,
} from "./openrouter-seedream";

const BASE = "https://gemini-proxy.example.test/u/openrouter.ai";

test("isSeedreamImageModel matches seedream prefix only", () => {
  assert.equal(isSeedreamImageModel("seedream-4.5"), true);
  assert.equal(isSeedreamImageModel("seedream-5.0"), true);
  assert.equal(isSeedreamImageModel("grok-imagine-image-2.0"), false);
  assert.equal(isSeedreamImageModel("gemini-2.5-flash-image"), false);
});

test("OPENROUTER_BASE_URL is required and never invents openrouter.ai", () => {
  assert.throws(() => requireOpenRouterBaseUrl(""), /OPENROUTER_BASE_URL/);
  assert.throws(() => requireOpenRouterBaseUrl("https://openrouter.ai"), /\/u\//);
  assert.equal(seedreamSubmitUrl(BASE), `${BASE}/api/v1/images`);
});

test("download rewrite uses /u/ only for openrouter.ai", () => {
  assert.deepEqual(
    rewriteOpenRouterUrl("https://openrouter.ai/api/v1/generation/abc", BASE),
    {
      url: "https://gemini-proxy.example.test/u/openrouter.ai/api/v1/generation/abc",
      host: "openrouter.ai",
    },
  );
  assert.throws(
    () => rewriteOpenRouterUrl("https://cdn.example/out.png", BASE),
    /unsupported_delivery_host/,
  );
});

test("size maps 2K/4K and clamps 1K", () => {
  assert.deepEqual(mapSeedreamImageSize("1K"), { size: "2K", clamped: true });
  assert.deepEqual(mapSeedreamImageSize("2K"), { size: "2K", clamped: false });
  assert.deepEqual(mapSeedreamImageSize("4K"), { size: "4K", clamped: false });
  assert.deepEqual(mapSeedreamImageSize("4K", "seedream-5.0-pro"), { size: "2K", clamped: true });
  assert.deepEqual(mapSeedreamImageSize("1K", "seedream-5.0-pro"), { size: "1K", clamped: false });
});

test("image body is OpenRouter Image API and rejects /u/ refs", () => {
  const body = buildSeedreamImageBody({
    prompt: "a face",
    size: "2K",
    aspectRatio: "9:16",
    imageInput: ["https://storage.example/a.jpg"],
  });
  assert.deepEqual(body, {
    model: "bytedance-seed/seedream-4.5",
    prompt: "a face",
    n: 1,
    resolution: "2K",
    aspect_ratio: "9:16",
    output_format: "png",
    input_references: [{
      type: "image_url",
      image_url: { url: "https://storage.example/a.jpg" },
    }],
  });
  assert.throws(
    () => buildSeedreamImageBody({
      prompt: "x",
      size: "2K",
      aspectRatio: "1:1",
      imageInput: [`${BASE}/api/v1/files/nope`],
    }),
    /public_url/,
  );
});

test("Seedream 5.0 Pro and Flux 2 Flex use vendor slugs", () => {
  const seedream = buildSeedreamImageBody({
    prompt: "a face",
    size: "2K",
    aspectRatio: "9:16",
    model: "seedream-5.0-pro",
  });
  assert.equal(seedream.model, "bytedance-seed/seedream-5-0-pro");
  assert.equal(seedream.resolution, "2K");
  const flux = buildSeedreamImageBody({
    prompt: "a face",
    size: "2K",
    aspectRatio: "9:16",
    model: "flux-2-flex",
  });
  assert.equal(flux.model, "black-forest-labs/flux.2-flex");
  assert.equal(flux.resolution, undefined);
  assert.equal(flux.safety_tolerance, undefined);
  const fluxLoose = buildSeedreamImageBody({
    prompt: "a face",
    size: "2K",
    aspectRatio: "9:16",
    model: "flux-2-flex",
    safetyTolerance: 5,
  });
  assert.equal(fluxLoose.safety_tolerance, 5);
  const seedreamLoose = buildSeedreamImageBody({
    prompt: "a face",
    size: "2K",
    aspectRatio: "9:16",
    model: "seedream-5.0-pro",
    safetyTolerance: 5,
  });
  assert.equal(seedreamLoose.safety_tolerance, undefined);
});

test("Flux safety_tolerance clamps 0..5", () => {
  assert.equal(clampFluxSafetyTolerance(5), 5);
  assert.equal(clampFluxSafetyTolerance(2.4), 2);
  assert.equal(clampFluxSafetyTolerance(9), 5);
  assert.equal(clampFluxSafetyTolerance(-1), 0);
  assert.equal(clampFluxSafetyTolerance("5"), null);
});

test("extracts inline image, url, operation id and safety", () => {
  assert.equal(
    extractSeedreamImageBase64({ data: [{ b64_json: Buffer.from("png").toString("base64") }] }),
    Buffer.from("png").toString("base64"),
  );
  assert.equal(
    extractSeedreamImageUrl({ data: [{ url: "https://openrouter.ai/out.png" }] }),
    "https://openrouter.ai/out.png",
  );
  assert.equal(extractSeedreamOperationId({ created: 1748372400 }), "openrouter:1748372400");
  assert.equal(isSeedreamSafetyBlock({ error: "NSFW content detected" }, ""), true);
  assert.equal(isSeedreamSafetyBlock({}, "ok"), false);
});

test("sync POST returns b64 and does not poll Replicate", async () => {
  const calls: Array<{ method?: string; url: string }> = [];
  const fetchImpl = async (url: string, init?: RequestInit) => {
    calls.push({ method: String(init?.method || "GET"), url });
    assert.match(url, /\/api\/v1\/images$/);
    assert.equal((init?.headers as Record<string, string>)["HTTP-Referer"], "https://promptshot.ru");
    return new Response(JSON.stringify({
      created: 1748372400,
      data: [{ b64_json: Buffer.from("png").toString("base64") }],
    }), { status: 200 });
  };
  let persisted = "";
  const result = await runSeedreamImage({
    apiKey: "token",
    baseUrl: BASE,
    body: buildSeedreamImageBody({ prompt: "x", size: "2K", aspectRatio: "1:1" }),
    persistOperationId: async (id) => {
      persisted = id;
    },
    ensureLease: async () => undefined,
    signal: new AbortController().signal,
    fetchImpl,
  });
  assert.equal(result.buffer.toString(), "png");
  assert.equal(result.operationId, "openrouter:1748372400");
  assert.equal(persisted, "openrouter:1748372400");
  assert.deepEqual(calls, [{ method: "POST", url: `${BASE}/api/v1/images` }]);
});

test("empty OpenRouter credits are config_error and not retried", async () => {
  await assert.rejects(
    () => runSeedreamImage({
      apiKey: "token",
      baseUrl: BASE,
      body: buildSeedreamImageBody({ prompt: "x", size: "2K", aspectRatio: "1:1" }),
      ensureLease: async () => undefined,
      signal: new AbortController().signal,
      fetchImpl: async () => new Response(JSON.stringify({
        error: { code: 402, message: "Insufficient credits" },
      }), { status: 402 }),
    }),
    (error: { errorType?: string; retryable?: boolean }) =>
      error.errorType === "config_error" && error.retryable === false,
  );
});
