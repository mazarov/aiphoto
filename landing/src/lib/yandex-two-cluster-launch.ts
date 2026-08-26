export const YANDEX_TWO_CLUSTER_LAUNCH = {
  asOf: "2026-08-19",
  geo: "Россия",
  placement: "search_only",
  autotargeting: {
    requiredOnSearch: true,
    categories: ["target"],
  },
  testWindowDays: { min: 14, max: 21 },
  budget: {
    totalWithVatRub: 35_000,
    vatRate: 0.22,
    mediaRub: 28_688.52,
    initialPilotWithVatRub: 5_000,
    initialPilotMediaRub: 4_098.36,
    reserveWithVatRub: 3_500,
    reserveMediaRub: 2_868.85,
  },
  economics: {
    status: "provisional_first_payment" as const,
    contributionMarginRate: 0.51,
    averageFirstPaymentRub: 229.23,
    firstPaymentContributionRub: 117.85,
    safetyFactor: 0.7,
    cacMaxRub: 82,
    matureD30Payers: 0,
    maximumCpcAtFivePercentPayerConversionRub: 4.1,
    note:
      "Временный stop-loss до появления зрелых D30-когорт. Масштабирование по D30 заблокировано.",
  },
  campaigns: [
    {
      key: "birthday",
      name: "PS_Search_Birthday_RF_2026-08",
      landingUrl: "https://promptshot.ru/sobytiya/den-rozhdeniya",
      budgetWithVatRub: 31_500,
      mediaBudgetRub: 25_819.67,
      groups: [
        {
          name: "Создать фото на день рождения",
          phrases: [
            "создать фото на день рождения",
            "сделать фото на день рождения ии",
          ],
          ads: [
            {
              title: "Создайте фото на день рождения с ИИ по вашему фото",
              text:
                "Выберите праздничный образ и формат. Загрузите своё фото и создайте новый кадр.",
            },
          ],
        },
      ],
    },
    {
      key: "pairs_generate",
      name: "ГЕНЕРАЦИЯ-ПАРЫ",
      landingUrl: "https://promptshot.ru/generaciya-foto/pary",
      budgetWithVatRub: 0,
      mediaBudgetRub: 0,
      groups: [
        {
          name: "Сделать парное фото",
          phrases: [
            "сделать парное фото",
            "создать парные фото",
            "сделать парное фото ии",
          ],
          ads: [
            {
              title: "Сделайте парное фото с ИИ по вашим фото",
              text:
                "Загрузите два снимка и выберите сюжет. Получите совместное фото пары.",
            },
          ],
        },
      ],
    },
    {
      key: "pairs_prompts",
      name: "ПРОМТЫ-ПАРЫ",
      landingUrl: "https://promptshot.ru/promty-dlya-foto-par",
      budgetWithVatRub: 0,
      mediaBudgetRub: 0,
      groups: [
        {
          name: "Промты для парных фото",
          phrases: [
            "промты для фото пары",
            "промты для парных фото",
            "промт для парного фото",
          ],
          ads: [
            {
              title: "Промты для фото пары с ИИ",
              text:
                "Откройте готовый парный пример и запустите генерацию на сайте.",
            },
          ],
        },
      ],
    },
  ],
  // Shared campaign minuses. Synced to live ГЕНЕРАЦИЯ-ДР export, minus
  // campaign id 713780805 (do not copy ids into the package).
  negativePhrases: [
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
  ],
  // Pairs-only: brand noise + Wordstat contamination. Do not put on ДР.
  pairsExtraNegativePhrases: [
    "нано",
    "банан",
    "nano",
    "banana",
    "midjourney",
    "kandinsky",
    "кандинский",
    "leonardo",
    "аву",
    "аватарки",
    "аватарка",
    "лп",
    "отделка",
    "баня",
    "кольца",
    "кольцо",
    "глаза",
    "радужки",
    "смотреть",
  ],
  utmTemplate: {
    utm_source: "yandex",
    utm_medium: "cpc",
    utm_campaign: "{campaign_id}",
    utm_content: "{ad_id}",
    utm_term: "{keyword}",
  },
  stopLoss: {
    phraseSpendWithoutPurchaseRub: 82,
    campaignSpendWithoutPurchaseRub: 164,
    maxClicksWithoutSuccessfulGeneration: 30,
    generationSuccessMaxDropPercentagePoints: 5,
  },
  scaleGate: {
    minimumFirstPayers: 5,
    maximumCacRub: 82,
    budgetIncreaseMinRate: 0.2,
    budgetIncreaseMaxRate: 0.3,
    minimumDaysBetweenIncreases: 3,
    requiresMatureD30: true,
  },
} as const;

export type YandexLaunchCampaignKey =
  (typeof YANDEX_TWO_CLUSTER_LAUNCH.campaigns)[number]["key"];

export function getYandexCampaignNegativePhrases(
  campaignKey: YandexLaunchCampaignKey,
): string[] {
  const shared = [...YANDEX_TWO_CLUSTER_LAUNCH.negativePhrases];
  if (campaignKey === "pairs_generate" || campaignKey === "pairs_prompts") {
    return [...shared, ...YANDEX_TWO_CLUSTER_LAUNCH.pairsExtraNegativePhrases];
  }
  return shared;
}
