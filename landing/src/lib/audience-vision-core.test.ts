import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AudienceVisionError,
  classifyAudienceFromImageBytes,
  extractAudienceVisionJson,
} from "./audience-vision-core";

test("extractAudienceVisionJson reads a fenced object", () => {
  const parsed = extractAudienceVisionJson('```json\n{"audience":"muzhchina","confidence":0.9}\n```');
  assert.equal(parsed?.audience, "muzhchina");
  assert.equal(extractAudienceVisionJson("not json"), null);
});

test("classifyAudienceFromImageBytes returns the raw subject", async () => {
  const urls: string[] = [];
  const raw = await classifyAudienceFromImageBytes({
    bytes: Uint8Array.from([1, 2, 3]),
    mimeType: "image/jpeg",
    baseUrl: "https://proxy.example/gemini",
    apiKey: "test-key",
    fetchImpl: async (url) => {
      urls.push(String(url));
      return new Response(JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                people_count: 1,
                has_visible_face: true,
                has_child: false,
                audience: "muzhchina",
                confidence: 0.93,
              }),
            }],
          },
        }],
      }));
    },
  });
  assert.equal(raw.audience, "muzhchina");
  assert.equal(raw.confidence, 0.93);
  assert.equal(raw.peopleCount, 1);
  assert.equal(urls.length, 1);
  assert.match(urls[0], /^https:\/\/proxy\.example\/gemini\/v1beta\/models\//);
});

test("classifyAudienceFromImageBytes surfaces 429 and timeout", async () => {
  await assert.rejects(
    () => classifyAudienceFromImageBytes({
      bytes: Uint8Array.from([1]),
      mimeType: "image/jpeg",
      baseUrl: "https://proxy.example",
      apiKey: "test-key",
      fetchImpl: async () => new Response("busy", { status: 429 }),
    }),
    (error: unknown) => error instanceof AudienceVisionError && error.code === "rate_limited",
  );

  await assert.rejects(
    () => classifyAudienceFromImageBytes({
      bytes: Uint8Array.from([1]),
      mimeType: "image/jpeg",
      baseUrl: "https://proxy.example",
      apiKey: "test-key",
      fetchImpl: async () => {
        const error = new Error("timed out");
        error.name = "TimeoutError";
        throw error;
      },
    }),
    (error: unknown) => error instanceof AudienceVisionError && error.code === "timeout",
  );
});

test("classifyAudienceFromImageBytes refuses an empty key", async () => {
  await assert.rejects(
    () => classifyAudienceFromImageBytes({
      bytes: Uint8Array.from([1]),
      mimeType: "image/jpeg",
      baseUrl: "https://proxy.example",
      apiKey: "  ",
      fetchImpl: async () => {
        throw new Error("should not fetch");
      },
    }),
    (error: unknown) => error instanceof AudienceVisionError && error.code === "provider_error",
  );
});
