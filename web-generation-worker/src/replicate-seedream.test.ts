import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSeedreamPredictionBody,
  extractSeedreamOutputUrl,
  extractSeedreamPredictionId,
  isSeedreamImageModel,
  isSeedreamSafetyBlock,
  mapSeedreamImageSize,
  requireReplicateBaseUrl,
  rewriteReplicateApiUrl,
  rewriteReplicateDeliveryUrl,
  runSeedreamPrediction,
  seedreamPollUrl,
  seedreamSubmitUrl,
  shouldSubmitSeedreamPrediction,
} from "./replicate-seedream";

const BASE = "https://gemini-proxy.example.test/u/api.replicate.com";

test("isSeedreamImageModel matches seedream prefix only", () => {
  assert.equal(isSeedreamImageModel("seedream-4.5"), true);
  assert.equal(isSeedreamImageModel("seedream-5.0"), true);
  assert.equal(isSeedreamImageModel("grok-imagine-image-2.0"), false);
  assert.equal(isSeedreamImageModel("gemini-2.5-flash-image"), false);
});

test("REPLICATE_BASE_URL is required and never invents api.replicate.com", () => {
  assert.throws(() => requireReplicateBaseUrl(""), /REPLICATE_BASE_URL/);
  assert.throws(() => requireReplicateBaseUrl("https://api.replicate.com"), /\/u\//);
  assert.equal(
    seedreamSubmitUrl(BASE),
    `${BASE}/v1/models/bytedance/seedream-4.5/predictions`,
  );
  assert.equal(seedreamPollUrl(BASE, "abc"), `${BASE}/v1/predictions/abc`);
  assert.equal(
    rewriteReplicateApiUrl("https://api.replicate.com/v1/predictions/abc?tok=1", BASE),
    `${BASE}/v1/predictions/abc?tok=1`,
  );
});

test("delivery rewrite uses /u/ only for replicate.delivery hosts", () => {
  assert.deepEqual(
    rewriteReplicateDeliveryUrl("https://replicate.delivery/xezq/out.png?e=1", BASE),
    {
      url: "https://gemini-proxy.example.test/u/replicate.delivery/xezq/out.png?e=1",
      host: "replicate.delivery",
    },
  );
  assert.deepEqual(
    rewriteReplicateDeliveryUrl("https://pbxt.replicate.delivery/out.png", BASE),
    {
      url: "https://gemini-proxy.example.test/u/pbxt.replicate.delivery/out.png",
      host: "pbxt.replicate.delivery",
    },
  );
  assert.throws(
    () => rewriteReplicateDeliveryUrl("https://cdn.example/out.png", BASE),
    /unsupported_delivery_host/,
  );
});

test("size maps 2K/4K and clamps 1K", () => {
  assert.deepEqual(mapSeedreamImageSize("1K"), { size: "2K", clamped: true });
  assert.deepEqual(mapSeedreamImageSize("2K"), { size: "2K", clamped: false });
  assert.deepEqual(mapSeedreamImageSize("4K"), { size: "4K", clamped: false });
});

test("prediction body disables sequential generation and rejects /u/ refs", () => {
  const body = buildSeedreamPredictionBody({
    prompt: "a face",
    size: "2K",
    aspectRatio: "9:16",
    imageInput: ["https://storage.example/a.jpg"],
  });
  assert.deepEqual(body, {
    input: {
      prompt: "a face",
      size: "2K",
      aspect_ratio: "9:16",
      sequential_image_generation: "disabled",
      max_images: 1,
      image_input: ["https://storage.example/a.jpg"],
    },
  });
  assert.throws(
    () => buildSeedreamPredictionBody({
      prompt: "x",
      size: "2K",
      aspectRatio: "1:1",
      imageInput: [`${BASE}/v1/files/nope`],
    }),
    /public_url/,
  );
});

test("extracts prediction id/output and safety", () => {
  assert.equal(extractSeedreamPredictionId({ id: "pred_1" }), "pred_1");
  assert.equal(extractSeedreamOutputUrl({ output: ["https://replicate.delivery/a.png"] }), "https://replicate.delivery/a.png");
  assert.equal(isSeedreamSafetyBlock({ error: "NSFW content detected" }, ""), true);
  assert.equal(isSeedreamSafetyBlock({}, "ok"), false);
});

test("existing provider_operation_id never POSTs a second prediction", async () => {
  const calls: Array<{ method?: string; url: string }> = [];
  const fetchImpl = async (url: string, init?: RequestInit) => {
    calls.push({ method: String(init?.method || "GET"), url });
    if (url.includes("/u/replicate.delivery")) {
      return new Response(Buffer.from("png"), { status: 200 });
    }
    return new Response(JSON.stringify({
      id: "pred_resume",
      status: "succeeded",
      output: ["https://replicate.delivery/out.png"],
      urls: { get: "https://api.replicate.com/v1/predictions/pred_resume" },
    }), { status: 200 });
  };
  let persisted = "";
  const result = await runSeedreamPrediction({
    apiToken: "token",
    baseUrl: BASE,
    existingOperationId: "pred_resume",
    body: buildSeedreamPredictionBody({ prompt: "x", size: "2K", aspectRatio: "1:1" }),
    persistOperationId: async (id) => {
      persisted = id;
    },
    ensureLease: async () => undefined,
    signal: new AbortController().signal,
    fetchImpl,
    sleep: async () => undefined,
  });
  assert.equal(result.submitted, false);
  assert.equal(result.operationId, "pred_resume");
  assert.equal(result.buffer.toString(), "png");
  assert.equal(persisted, "");
  assert.equal(calls.some((call) => call.method === "POST"), false);
  assert.equal(calls.some((call) => call.url.includes("/v1/predictions/pred_resume")), true);
});

test("first submit POSTs once, persists id, then polls", async () => {
  const methods: string[] = [];
  const fetchImpl = async (url: string, init?: RequestInit) => {
    const method = String(init?.method || "GET");
    methods.push(method);
    if (method === "POST") {
      assert.match(url, /\/v1\/models\/bytedance\/seedream-4\.5\/predictions$/);
      assert.equal((init?.headers as Record<string, string>)["Cancel-After"], "180");
      assert.equal(init?.headers && "Prefer" in (init.headers as object) ? (init.headers as Record<string, string>).Prefer : undefined, undefined);
      return new Response(JSON.stringify({
        id: "pred_new",
        status: "starting",
        urls: { get: "https://api.replicate.com/v1/predictions/pred_new" },
      }), { status: 201 });
    }
    if (url.includes("/u/replicate.delivery")) {
      return new Response(Buffer.from("png"), { status: 200 });
    }
    return new Response(JSON.stringify({
      id: "pred_new",
      status: "succeeded",
      output: ["https://replicate.delivery/out.png"],
    }), { status: 200 });
  };
  let persisted = "";
  const result = await runSeedreamPrediction({
    apiToken: "token",
    baseUrl: BASE,
    existingOperationId: null,
    body: buildSeedreamPredictionBody({ prompt: "x", size: "2K", aspectRatio: "1:1" }),
    persistOperationId: async (id) => {
      persisted = id;
    },
    ensureLease: async () => undefined,
    signal: new AbortController().signal,
    fetchImpl,
    sleep: async () => undefined,
  });
  assert.equal(result.submitted, true);
  assert.equal(persisted, "pred_new");
  assert.equal(methods.filter((method) => method === "POST").length, 1);
  assert.ok(shouldSubmitSeedreamPrediction(null));
  assert.equal(shouldSubmitSeedreamPrediction("pred_new"), false);
});
