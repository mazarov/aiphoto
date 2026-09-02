import assert from "node:assert/strict";
import test from "node:test";
import {
  flattenGeneraciyaFotoFaqAnswer,
  formatGeneraciyaFotoSocialProof,
  GENERACIYA_FOTO_FAQ,
  GENERACIYA_FOTO_HOW_TO_STEPS,
  GENERACIYA_FOTO_PRICING,
  GENERACIYA_FOTO_SEO,
  GENERACIYA_FOTO_THEMES,
  GENERACIYA_FOTO_TOOLS,
  isGeneraciyaFotoFaqLink,
} from "./generaciya-foto-seo-copy";
import { getGeneraciyaFotoScenarioPath } from "./generaciya-foto-routes";

const BANNED_META = /best|recommended|premium|\bfree\b|#1|бесплатно/i;

test("meta name and description stay concise and truthful", () => {
  assert.equal(
    GENERACIYA_FOTO_SEO.metaTitle,
    "Сделать фото ИИ онлайн по фото или описанию — PromptShot"
  );
  assert.ok(GENERACIYA_FOTO_SEO.metaTitle.length <= 75);
  assert.equal(
    GENERACIYA_FOTO_SEO.metaDescription,
    "Создайте фото ИИ онлайн по своему снимку или описанию. Выберите готовый образ, настройте промт и получите реалистичный кадр в PromptShot."
  );
  assert.ok(GENERACIYA_FOTO_SEO.metaDescription.length <= 160);
  assert.ok(GENERACIYA_FOTO_SEO.metaDescription.length >= 80);
  assert.doesNotMatch(GENERACIYA_FOTO_SEO.metaTitle, BANNED_META);
  assert.doesNotMatch(GENERACIYA_FOTO_SEO.metaDescription, BANNED_META);
});

test("visible H1 and HowTo keep Facee wording", () => {
  assert.equal(
    GENERACIYA_FOTO_SEO.h1,
    "Сделать фото ИИ онлайн"
  );
  assert.equal(
    GENERACIYA_FOTO_SEO.intro,
    "Создайте один реалистичный кадр по своему снимку или текстовому описанию — без студии и фотографа."
  );
  assert.equal(GENERACIYA_FOTO_SEO.howToTitle, "Как создать свои ИИ фото?");
  assert.equal(
    GENERACIYA_FOTO_SEO.howToLead,
    "Три простых шага, чтобы сделать своё ИИ фото онлайн"
  );
  assert.equal(GENERACIYA_FOTO_HOW_TO_STEPS.length, 3);
  assert.equal(GENERACIYA_FOTO_HOW_TO_STEPS[0].title, "Выберите способ");
  assert.match(GENERACIYA_FOTO_HOW_TO_STEPS[0].text, /один снимок/);
  assert.equal(GENERACIYA_FOTO_HOW_TO_STEPS[1].title, "Выберите промт");
  assert.equal(
    GENERACIYA_FOTO_HOW_TO_STEPS[1].text,
    "Выберите промт из каталога или напишите свой"
  );
  assert.equal(GENERACIYA_FOTO_SEO.howToCta, "Создать фото");
});

test("starter keeps Facee first screen and does not add extra headings", () => {
  assert.equal("socialProof" in GENERACIYA_FOTO_SEO, false);
  assert.match(
    formatGeneraciyaFotoSocialProof(4821) ?? "",
    /^Более 4\s821 человек уже сгенерировали ИИ фото$/
  );
  assert.equal(formatGeneraciyaFotoSocialProof(0), null);
  assert.equal("starterEyebrow" in GENERACIYA_FOTO_SEO, false);
  assert.equal("starterTitle" in GENERACIYA_FOTO_SEO, false);
  assert.equal("starterLead" in GENERACIYA_FOTO_SEO, false);
});

test("hub blocks keep Facee homepage copy", () => {
  assert.equal(GENERACIYA_FOTO_THEMES.title, "Подборки шаблонов по темам");
  assert.equal(GENERACIYA_FOTO_THEMES.items.length, 22);
  assert.equal(GENERACIYA_FOTO_THEMES.items[0].title, "Для пар");
  assert.equal(GENERACIYA_FOTO_THEMES.items[0].href, "/generaciya-foto/pary");
  assert.equal(GENERACIYA_FOTO_THEMES.items[1].title, "Для девушек");
  assert.equal(GENERACIYA_FOTO_THEMES.items[3].title, "Для мужчин");
  assert.equal(GENERACIYA_FOTO_SEO.examplesTitle, "Идеи для фото ИИ");
  assert.equal(
    GENERACIYA_FOTO_SEO.examplesIntro,
    "Выберите образ и сгенерируйте фото с ИИ — со своего снимка или по тексту."
  );
  assert.equal(GENERACIYA_FOTO_SEO.examplesCta, "Больше идей для фото");
  assert.equal(
    GENERACIYA_FOTO_SEO.examplesMoreHref,
    "/generaciya-foto#primery",
  );
  assert.equal(GENERACIYA_FOTO_SEO.chipHubLabel, "Сделать фото ИИ");
  assert.equal(GENERACIYA_FOTO_TOOLS.title, "Редактирование фото с ИИ");
  assert.equal(
    GENERACIYA_FOTO_TOOLS.lead,
    "ИИ инструменты для работы с фотографией"
  );
  assert.equal(GENERACIYA_FOTO_TOOLS.tryLabel, "Попробовать");
  assert.equal(GENERACIYA_FOTO_TOOLS.items[0].title, "ИИ-редактор фото");
  assert.deepEqual(
    GENERACIYA_FOTO_TOOLS.items.map((item) => item.title),
    [
      "ИИ-редактор фото",
      "Изменить причёску",
      "Удалить объект",
      "Улучшить качество",
    ]
  );
  assert.equal("allLabel" in GENERACIYA_FOTO_TOOLS, false);
  assert.equal("allHref" in GENERACIYA_FOTO_TOOLS, false);
  assert.equal(GENERACIYA_FOTO_PRICING.variant, "treatment");
  assert.equal(GENERACIYA_FOTO_PRICING.returnPath, "/generaciya-foto");
  for (const item of GENERACIYA_FOTO_TOOLS.items) {
    assert.ok(item.prompt.trim().length > 40, item.title);
    assert.equal("href" in item, false, item.title);
    assert.match(item.prompt, /[а-яё]/i, item.title);
    assert.doesNotMatch(
      item.prompt,
      /\b(Edit|Change|Remove|Enhance|Photorealistic|Keep the same|Fashion portrait|hairstyle|Kibbe)\b/i,
      item.title
    );
  }
  assert.match(GENERACIYA_FOTO_TOOLS.items[1].prompt, /причёск/i);
  assert.equal(GENERACIYA_FOTO_FAQ.length, 15);
  const promptFaq = GENERACIYA_FOTO_FAQ.find((item) =>
    item.q.startsWith("Где взять готовый промт")
  );
  const aiPhotoFaq = GENERACIYA_FOTO_FAQ.find((item) => item.q === "Что такое ИИ фото?");
  assert.match(
    flattenGeneraciyaFotoFaqAnswer(promptFaq?.a ?? []),
    /Идеи для фото ИИ/
  );
  assert.match(
    flattenGeneraciyaFotoFaqAnswer(aiPhotoFaq?.a ?? []),
    /визажист и аренда локации/
  );
  assert.equal(
    GENERACIYA_FOTO_FAQ.some((item) =>
      [
        "Как отключить подписку?",
        "Что такое фотостудия онлайн?",
        "Какие совместные фотосеты есть в PromptShot?",
        "Как создать нейрофотосессию с собой?",
        "Что делать, если не получается войти в аккаунт?",
        "Почему фото не загружается?",
      ].includes(item.q)
    ),
    false
  );
  assert.equal(
    GENERACIYA_FOTO_FAQ.some((item) =>
      item.q.startsWith("Где скачать PromptShot")
    ),
    false
  );
  assert.equal(
    GENERACIYA_FOTO_FAQ.some((item) =>
      /Telegram|@facee|facee\.ru|Т-Банк/i.test(
        `${item.q} ${flattenGeneraciyaFotoFaqAnswer(item.a)}`
      )
    ),
    false
  );
});

test("FAQ links real PromptShot services only where the question is an action", () => {
  const allowedHrefs = new Set([
    "/",
    "/trends",
    "/foto-v-promt",
    "/ii-fotosessiya",
    "/pricing",
    "/nano-banana",
    "/terms",
    "#generator",
    "#primery",
    "#temy",
    getGeneraciyaFotoScenarioPath("pary"),
    getGeneraciyaFotoScenarioPath("semya"),
    "mailto:support_ru@promptshot.ru",
  ]);
  const banned = /Фотосессии|ИИ-редактор|Объединить два фото|https:\/\/promptshot\.ru\/terms/i;
  const linkedByQuestion = new Map<string, string[]>();

  for (const item of GENERACIYA_FOTO_FAQ) {
    const plain = flattenGeneraciyaFotoFaqAnswer(item.a);
    assert.doesNotMatch(plain, banned);
    const hrefs = item.a.filter(isGeneraciyaFotoFaqLink).map((part) => part.href);
    for (const href of hrefs) {
      assert.ok(allowedHrefs.has(href), `${item.q} → ${href}`);
    }
    if (hrefs.length) linkedByQuestion.set(item.q, hrefs);
  }

  assert.deepEqual(linkedByQuestion.get("Где взять готовый промт для генерации фото?"), [
    "#primery",
    "#generator",
  ]);
  assert.deepEqual(linkedByQuestion.get("Как создать фото с собой в PromptShot?"), [
    "#primery",
    "#generator",
  ]);
  assert.deepEqual(linkedByQuestion.get("Как собрать серию кадров в одном стиле?"), [
    "/ii-fotosessiya",
    getGeneraciyaFotoScenarioPath("pary"),
  ]);
  assert.deepEqual(linkedByQuestion.get("Можно ли использовать фото как пример?"), [
    "#generator",
    "/foto-v-promt",
  ]);
  assert.equal(linkedByQuestion.has("Что такое ИИ фото?"), false);
  assert.equal(linkedByQuestion.has("Где скачать PromptShot на телефон?"), false);
});
