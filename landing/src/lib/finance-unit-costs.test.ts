import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyCogsProvider,
  classifyGenerationFamily,
  estimateJobUsd,
  parseFinanceModelUnitCosts,
  priceLiveCogsRows,
} from "./finance-unit-costs";
import { buildLiveRevenue } from "./finance-live";

const costs = parseFinanceModelUnitCosts({
  "gemini-3.1-flash-image-preview": { perImage: { "1K": 0.067, "2K": 0.101, "4K": 0.151 } },
  "grok-imagine-image-2.0": { perImage: { "1K": 0.04, "2K": 0.04 } },
  "grok-imagine-video-1.5": { perSecond: { "720p": 0.08 } },
  "seedream-5.0-pro": { perImage: { "1K": 0.045 } },
});

test("classifies provider and family from model id", () => {
  assert.equal(classifyCogsProvider("gemini-3-pro-image-preview"), "google");
  assert.equal(classifyCogsProvider("veo-3.1-lite-generate-preview"), "google");
  assert.equal(classifyCogsProvider("grok-imagine-image-2.0"), "xai");
  assert.equal(classifyCogsProvider("seedream-5.0-pro"), "openrouter");
  assert.equal(classifyCogsProvider("flux-2-flex"), "openrouter");
  assert.equal(classifyGenerationFamily("gemini-3.1-flash-lite-image"), "gemini-3.1-flash-lite-image");
  assert.equal(classifyGenerationFamily("grok-imagine-video-1.5"), "grok-imagine-video");
  assert.equal(classifyGenerationFamily("seedance-2.5"), "seedance-video");
});

test("unit cost uses image size and video seconds", () => {
  assert.equal(estimateJobUsd(costs, { modelId: "gemini-3.1-flash-image-preview", imageSize: "4K" }), 0.151);
  assert.equal(estimateJobUsd(costs, { modelId: "grok-imagine-video-1.5", imageSize: "720p", durationSeconds: 5 }), 0.4);
  assert.equal(estimateJobUsd(costs, { modelId: "gemini-omni-flash-preview", imageSize: "1K" }), null);
});

test("live cogs prefers billed USD and estimates the rest", () => {
  const priced = priceLiveCogsRows([
    {
      day: "2026-09-01",
      model_id: "grok-imagine-image-2.0",
      image_size: "2K",
      duration_seconds: 0,
      jobs: 3,
      billed_jobs: 1,
      billed_usd: 0.019,
    },
    {
      day: "2026-09-01",
      model_id: "unknown-model",
      image_size: "1K",
      duration_seconds: 0,
      jobs: 2,
      billed_jobs: 0,
      billed_usd: 0,
    },
  ], costs);
  assert.equal(priced[0].subtotalUsd, 0.099);
  assert.equal(priced[0].estimatedUsd, 0.08);
  assert.equal(priced[0].provider, "xai");
  assert.equal(priced[1].missingPrice, true);
  assert.equal(priced[1].subtotalUsd, 0);
});

test("live YooKassa revenue applies fee estimate and is the live source", () => {
  const revenue = buildLiveRevenue([
    { day: "2026-09-01", payment_count: 2, gross_rub: 10_000 },
  ]);
  assert.equal(revenue.source, "live_ledger");
  assert.equal(revenue.kpi.gross, 10_000);
  assert.equal(revenue.kpi.commission, 350);
  assert.equal(revenue.kpi.vat, 77);
  assert.equal(revenue.kpi.net, 9_573);
  assert.equal(revenue.import, null);
});
