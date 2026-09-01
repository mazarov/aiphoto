import assert from "node:assert/strict";
import test from "node:test";
import { mapDirectReportToAdsLines, moneyRub } from "./yandex-direct-finance";

test("maps Direct report rows to ads lines and merges the same campaign day", () => {
  const lines = mapDirectReportToAdsLines([
    {
      Date: "2026-09-01",
      CampaignId: "713780805",
      CampaignName: "ГЕНЕРАЦИЯ",
      Impressions: "10",
      Clicks: "2",
      Cost: "100,50",
    },
    {
      Date: "2026-09-01",
      CampaignId: "713780805",
      CampaignName: "ГЕНЕРАЦИЯ",
      Impressions: 5,
      Clicks: 1,
      Cost: 20,
    },
    { Date: "bad", CampaignId: "1", Cost: 1 },
  ]);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].campaign_id, "713780805");
  assert.equal(lines[0].impressions, 15);
  assert.equal(lines[0].clicks, 3);
  assert.equal(lines[0].cost_rub, 120.5);
  assert.equal(lines[0].currency, "RUB");
  assert.equal(moneyRub("12,3"), 12.3);
});
