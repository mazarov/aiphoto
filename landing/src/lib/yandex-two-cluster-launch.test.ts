import assert from "node:assert/strict";
import test from "node:test";
import { YANDEX_TWO_CLUSTER_LAUNCH } from "./yandex-two-cluster-launch";

test("birthday launch budget reconciles to 35k with VAT", () => {
  const campaignBudget = YANDEX_TWO_CLUSTER_LAUNCH.campaigns.reduce(
    (sum, campaign) => sum + campaign.budgetWithVatRub,
    0,
  );
  assert.equal(
    campaignBudget + YANDEX_TWO_CLUSTER_LAUNCH.budget.reserveWithVatRub,
    YANDEX_TWO_CLUSTER_LAUNCH.budget.totalWithVatRub,
  );
  const mediaBudget = YANDEX_TWO_CLUSTER_LAUNCH.campaigns.reduce(
    (sum, campaign) => sum + campaign.mediaBudgetRub,
    YANDEX_TWO_CLUSTER_LAUNCH.budget.reserveMediaRub,
  );
  assert.ok(
    Math.abs(mediaBudget - YANDEX_TWO_CLUSTER_LAUNCH.budget.mediaRub) < 0.02,
  );
  assert.equal(YANDEX_TWO_CLUSTER_LAUNCH.budget.vatRate, 0.22);
});

test("launch has one birthday group with one focused ad", () => {
  assert.equal(YANDEX_TWO_CLUSTER_LAUNCH.campaigns.length, 1);
  const campaign = YANDEX_TWO_CLUSTER_LAUNCH.campaigns[0];
  assert.equal(campaign.key, "birthday");
  assert.match(campaign.landingUrl, /\/generaciya-foto\/na-den-rozhdeniya$/);
  assert.equal(campaign.groups.length, 1);
  assert.equal(campaign.groups[0].name, "Создать фото на день рождения");
  assert.deepEqual(campaign.groups[0].phrases, [
    "создать фото на день рождения",
    "сделать фото на день рождения ии",
  ]);
  assert.equal(campaign.groups[0].ads.length, 1);
  const ad = campaign.groups[0].ads[0];
  assert.equal(
    ad.title,
    "Создайте фото на день рождения с ИИ по вашему фото",
  );
  assert.ok(ad.title.length <= 56);
  assert.ok(ad.text.length <= 81);
});

test("paid ads do not promise free access or no registration", () => {
  const copy = YANDEX_TWO_CLUSTER_LAUNCH.campaigns
    .flatMap((campaign) => campaign.groups)
    .flatMap((group) => group.ads)
    .map((ad) => `${ad.title} ${ad.text}`.toLowerCase())
    .join(" ");
  assert.equal(copy.includes("бесплат"), false);
  assert.equal(copy.includes("без регистрации"), false);
});

test("birthday negative phrases exclude greeting and template intent", () => {
  for (const phrase of [
    "поздравление",
    "стих",
    "тост",
    "открытка",
    "шаблон",
    "фоторамка",
    "приглашение",
  ]) {
    assert.ok(YANDEX_TWO_CLUSTER_LAUNCH.negativePhrases.includes(phrase));
  }
});

test("provisional CAC is used consistently in stop-loss and scale gate", () => {
  const cacMax = YANDEX_TWO_CLUSTER_LAUNCH.economics.cacMaxRub;
  assert.equal(
    YANDEX_TWO_CLUSTER_LAUNCH.stopLoss.phraseSpendWithoutPurchaseRub,
    cacMax,
  );
  assert.equal(
    YANDEX_TWO_CLUSTER_LAUNCH.stopLoss.campaignSpendWithoutPurchaseRub,
    cacMax * 2,
  );
  assert.equal(YANDEX_TWO_CLUSTER_LAUNCH.scaleGate.maximumCacRub, cacMax);
  assert.equal(YANDEX_TWO_CLUSTER_LAUNCH.scaleGate.requiresMatureD30, true);
});
