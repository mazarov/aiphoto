import assert from "node:assert/strict";
import test from "node:test";
import {
  GeminiEmbeddingError,
  assertEmbeddingVector,
  embedSearchQuery,
  embeddingToRpcLiteral,
  formatVisualSearchQuery,
} from "./gemini-embedding";

test("formats retrieval query with the official task prefix", () => {
  assert.equal(
    formatVisualSearchQuery("  девушка в красном  "),
    "task: search result | query: девушка в красном",
  );
  assert.equal(formatVisualSearchQuery("x", false), "x");
});

test("rejects malformed embedding vectors", () => {
  assert.throws(() => assertEmbeddingVector([1, 2], 3), GeminiEmbeddingError);
  assert.throws(
    () => assertEmbeddingVector([1, Number.NaN, 3], 3),
    GeminiEmbeddingError,
  );
  assert.deepEqual(assertEmbeddingVector([0.1, 0.2, 0.3], 3), [0.1, 0.2, 0.3]);
  assert.equal(embeddingToRpcLiteral([1, 2]), "[1,2]");
});

test("embedSearchQuery sends 768-d request and validates the response", async () => {
  const values = Array.from({ length: 768 }, (_, i) => i / 768);
  const fetchImpl: typeof fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.output_dimensionality, 768);
    assert.equal(body.content.parts[0].text, "task: search result | query: неон");
    const headers = init?.headers as Record<string, string> | undefined;
    assert.ok(String(headers?.["x-goog-api-key"] ?? "").length > 0);
    return new Response(JSON.stringify({ embedding: { values } }), { status: 200 });
  };

  const vector = await embedSearchQuery({
    query: "неон",
    timeoutMs: 200,
    apiKey: "test-key",
    fetchImpl,
  });
  assert.equal(vector.length, 768);
});

test("embedSearchQuery maps timeout and 429", async () => {
  await assert.rejects(
    () =>
      embedSearchQuery({
        query: "x",
        timeoutMs: 20,
        apiKey: "test-key",
        fetchImpl: (_url, init) =>
          new Promise((_, reject) => {
            init?.signal?.addEventListener("abort", () => {
              const error = new Error("aborted");
              error.name = "AbortError";
              reject(error);
            });
          }),
      }),
    (error: unknown) =>
      error instanceof GeminiEmbeddingError && error.code === "timeout",
  );

  await assert.rejects(
    () =>
      embedSearchQuery({
        query: "x",
        timeoutMs: 200,
        apiKey: "test-key",
        fetchImpl: async () => new Response("nope", { status: 429 }),
      }),
    (error: unknown) =>
      error instanceof GeminiEmbeddingError && error.code === "rate_limited",
  );
});
