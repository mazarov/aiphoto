import assert from "node:assert/strict";
import test from "node:test";
import {
  parseSearchAnalyticsDays,
  parseSearchObservabilityPayload,
  rate,
} from "./search-analytics-data";

test("parseSearchAnalyticsDays allows only dashboard periods", () => {
  assert.equal(parseSearchAnalyticsDays("7"), 7);
  assert.equal(parseSearchAnalyticsDays("90"), 90);
  assert.equal(parseSearchAnalyticsDays("14"), 30);
  assert.equal(parseSearchAnalyticsDays(null), 30);
});

test("rate is zero without a denominator", () => {
  assert.equal(rate(3, 10), 0.3);
  assert.equal(rate(1, 0), 0);
});

test("parseSearchObservabilityPayload computes mode split, missing card embeddings, and Gemini vs ready vector shares", () => {
  const parsed = parseSearchObservabilityPayload(
    {
      visual_enabled: true,
      coverage: {
        generation: 1,
        published_with_photo: 12_500,
        ready: 12_485,
        pending: 10,
        retry: 3,
        processing: 1,
        dead: 1,
      },
      engine: {
        total_requests: 200,
        hybrid_requests: 180,
        text_only_requests: 20,
        fallback_requests: 5,
        embed_l1_hits: 90,
        embed_l2_db_hits: 60,
        embed_gemini_ok: 30,
        embed_gemini_error: 5,
        embed_guard_blocked: 0,
      },
      daily_engine: [
        {
          day: "2026-11-11",
          total_requests: 200,
          hybrid_requests: 180,
          text_only_requests: 20,
          fallback_requests: 5,
          embed_l1_hits: 90,
          embed_l2_db_hits: 60,
          embed_gemini_ok: 30,
          embed_gemini_error: 5,
        },
      ],
      stored_query_vectors_total: 420,
      stored_query_vectors_period: 35,
      today_gemini_global_used: 48,
    },
    4_000,
  );

  assert.equal(parsed.visualEnabled, true);
  assert.equal(parsed.modeSplit.hybridShare, 0.9);
  assert.equal(parsed.modeSplit.textShare, 0.1);
  assert.equal(parsed.modeSplit.fallbackRequests, 5);

  assert.equal(parsed.cardCoverage.withoutEmbedding, 15);
  assert.equal(parsed.cardCoverage.ready, 12_485);
  assert.equal(parsed.cardCoverage.pending, 10);

  assert.equal(parsed.queryVectors.sentToGemini, 35);
  assert.equal(parsed.queryVectors.servedFromReadyVector, 150);
  assert.equal(parsed.queryVectors.trackedRequests, 185);
  assert.equal(parsed.queryVectors.sentToGeminiShare, 35 / 185);
  assert.equal(parsed.queryVectors.readyVectorShare, 150 / 185);
  assert.equal(parsed.queryVectors.storedVectorsTotal, 420);
  assert.equal(parsed.queryVectors.todayGeminiGlobalUsed, 48);
  assert.equal(parsed.queryVectors.todayGeminiGlobalLimit, 4_000);

  assert.equal(parsed.dailyEngine[0]?.sentToGemini, 35);
  assert.equal(parsed.dailyEngine[0]?.readyVectorHits, 150);
});
