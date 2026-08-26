import assert from "node:assert/strict";
import test from "node:test";
import {
  YANDEX_TWO_CLUSTER_LAUNCH,
  getYandexCampaignNegativePhrases,
} from "./yandex-two-cluster-launch";

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

test("launch has birthday plus draft pairs campaigns", () => {
  assert.equal(YANDEX_TWO_CLUSTER_LAUNCH.campaigns.length, 3);
  const campaign = YANDEX_TWO_CLUSTER_LAUNCH.campaigns.find(
    (item) => item.key === "birthday",
  );
  assert.ok(campaign);
  assert.match(campaign.landingUrl, /\/sobytiya\/den-rozhdeniya$/);
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

  const pairsGenerate = YANDEX_TWO_CLUSTER_LAUNCH.campaigns.find(
    (item) => item.key === "pairs_generate",
  );
  const pairsPrompts = YANDEX_TWO_CLUSTER_LAUNCH.campaigns.find(
    (item) => item.key === "pairs_prompts",
  );
  assert.ok(pairsGenerate && pairsPrompts);
  assert.equal(pairsGenerate.budgetWithVatRub, 0);
  assert.equal(pairsPrompts.budgetWithVatRub, 0);
  assert.match(pairsGenerate.landingUrl, /\/generaciya-foto\/pary$/);
  assert.match(pairsPrompts.landingUrl, /\/promty-dlya-foto-par$/);
  assert.ok(pairsGenerate.groups[0].ads[0].title.length <= 56);
  assert.ok(pairsPrompts.groups[0].ads[0].title.length <= 56);
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

test("shared negatives match live birthday campaign export without campaign id", () => {
  const fromBirthdayCabinet = [
    "!как пользоваться",
    "18",
    "canva",
    "chatgpt",
    "gif",
    "gpt",
    "nsfw",
    "photoshop",
    "алиса",
    "анимация",
    "без регистрации",
    "бесплатно",
    "бот",
    "видео",
    "гиф",
    "голые",
    "дипфейк",
    "документы",
    "коллаж",
    "конкурс",
    "лучшие",
    "музыка",
    "обзор",
    "обработка",
    "оживить",
    "открытка",
    "паспорт",
    "песня",
    "печать",
    "пожелание",
    "поздравление",
    "порно",
    "приглашение",
    "приложение",
    "программа",
    "проза",
    "раздеть",
    "рамка",
    "раскраска",
    "редактор",
    "скачать",
    "слайд",
    "стих",
    "сценарий",
    "тг",
    "телеграм",
    "топ",
    "тост",
    "улучшить качество",
    "фоторамка",
    "фотошоп",
    "шаблон",
    "шедеврум",
  ];
  assert.deepEqual(
    [...YANDEX_TWO_CLUSTER_LAUNCH.negativePhrases],
    fromBirthdayCabinet,
  );
  assert.equal(
    YANDEX_TWO_CLUSTER_LAUNCH.negativePhrases.includes("713780805"),
    false,
  );
});

test("pairs campaigns add brand and Wordstat minuses on top of birthday package", () => {
  const pairs = getYandexCampaignNegativePhrases("pairs_generate");
  const birthday = getYandexCampaignNegativePhrases("birthday");
  assert.deepEqual(birthday, [...YANDEX_TWO_CLUSTER_LAUNCH.negativePhrases]);
  for (const phrase of YANDEX_TWO_CLUSTER_LAUNCH.negativePhrases) {
    assert.ok(pairs.includes(phrase));
  }
  for (const phrase of ["нано", "midjourney", "аву", "смотреть", "кольца"]) {
    assert.ok(pairs.includes(phrase));
    assert.equal(birthday.includes(phrase), false);
  }
  assert.deepEqual(
    getYandexCampaignNegativePhrases("pairs_prompts"),
    pairs,
  );
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
