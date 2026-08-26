import assert from "node:assert/strict";
import test from "node:test";
import {
  flattenGeneraciyaFotoFaqAnswer,
  formatGeneraciyaFotoSocialProof,
  GENERACIYA_FOTO_FAQ,
  GENERACIYA_FOTO_HOW_TO_STEPS,
  GENERACIYA_FOTO_PRICING,
  GENERACIYA_FOTO_REVIEW_SEARCH_PHRASES,
  GENERACIYA_FOTO_REVIEWS,
  GENERACIYA_FOTO_SEO,
  GENERACIYA_FOTO_THEMES,
  GENERACIYA_FOTO_TOOLS,
  isGeneraciyaFotoFaqLink,
} from "./generaciya-foto-seo-copy";
import { getGeneraciyaFotoScenarioPath } from "./generaciya-foto-routes";

function reviewKeywordHits(text: string): string[] {
  const hay = text.toLowerCase();
  const phrases = [...GENERACIYA_FOTO_REVIEW_SEARCH_PHRASES].sort(
    (a, b) => b.length - a.length
  );
  const hits: string[] = [];
  let remaining = hay;
  for (const phrase of phrases) {
    if (remaining.includes(phrase)) {
      hits.push(phrase);
      remaining = remaining.split(phrase).join(" ".repeat(phrase.length));
    }
  }
  return hits;
}

const BANNED_META = /best|recommended|premium|\bfree\b|#1|бесплатно/i;

test("meta name and short description keep CWS limits", () => {
  assert.equal(
    GENERACIYA_FOTO_SEO.metaTitle,
    "Сделать ИИ фото онлайн - без дизайнера. Нейросеть для фото."
  );
  assert.ok(GENERACIYA_FOTO_SEO.metaTitle.length <= 75);
  assert.equal(
    GENERACIYA_FOTO_SEO.metaDescription,
    "Создавайте ИИ фото себя в нейросети - без студии и фотографа. Загрузи свое фото, выберите стиль и получите реалистичную фотографию."
  );
  assert.ok(GENERACIYA_FOTO_SEO.metaDescription.length <= 132);
  assert.ok(GENERACIYA_FOTO_SEO.metaDescription.length >= 80);
  assert.doesNotMatch(GENERACIYA_FOTO_SEO.metaTitle, BANNED_META);
  assert.doesNotMatch(GENERACIYA_FOTO_SEO.metaDescription, BANNED_META);
});

test("visible H1 and HowTo keep Facee wording", () => {
  assert.equal(
    GENERACIYA_FOTO_SEO.h1,
    "Сделай фото с помощью ИИ онлайн — без студии и камеры"
  );
  assert.equal(
    GENERACIYA_FOTO_SEO.intro,
    "С PromptShot вы увидите себя в сотнях красивых образов, которые сложно или дорого воплотить в обычной жизни"
  );
  assert.equal(GENERACIYA_FOTO_SEO.howToTitle, "Как создать свои ИИ фото?");
  assert.equal(
    GENERACIYA_FOTO_SEO.howToLead,
    "Три простых шага к генерации персональной онлайн-фотосессии"
  );
  assert.equal(GENERACIYA_FOTO_HOW_TO_STEPS.length, 3);
  assert.equal(GENERACIYA_FOTO_HOW_TO_STEPS[0].title, "Загрузите свои фото");
  assert.match(GENERACIYA_FOTO_HOW_TO_STEPS[0].text, /1 до 5 фото/);
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
    "Генерируй фото с ИИ на основе бесплатного онлайн каталога промтов"
  );
  assert.equal(GENERACIYA_FOTO_SEO.examplesCta, "Больше промптов для фото");
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
  assert.equal(GENERACIYA_FOTO_REVIEWS.items.length, 7);
  assert.equal(GENERACIYA_FOTO_REVIEWS.items[1].name, "Виа Вика");
  assert.equal("moreLabel" in GENERACIYA_FOTO_REVIEWS, false);
  assert.equal("allLabel" in GENERACIYA_FOTO_REVIEWS, false);
  const promptFaq = GENERACIYA_FOTO_FAQ.find((item) =>
    item.q.startsWith("Где взять промпт")
  );
  const aiPhotoFaq = GENERACIYA_FOTO_FAQ.find((item) => item.q === "Что такое ИИ фото?");
  assert.match(
    flattenGeneraciyaFotoFaqAnswer(promptFaq?.a ?? []),
    /галерее PromptShot с примерами образов/
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
  assert.ok(GENERACIYA_FOTO_FAQ.some((item) => item.q.startsWith("Где скачать PromptShot")));
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
    "/pricing",
    "/terms",
    "#generator",
    "#primery",
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

  assert.deepEqual(linkedByQuestion.get("Где взять промпт, чтобы сгенерировать фото в нужном стиле?"), [
    "/",
    "/trends",
  ]);
  assert.deepEqual(linkedByQuestion.get("Как создать фото с собой в PromptShot?"), [
    "#primery",
    "#generator",
  ]);
  assert.deepEqual(linkedByQuestion.get("Как сделать совместную нейрофотосессию?"), [
    getGeneraciyaFotoScenarioPath("pary"),
  ]);
  assert.deepEqual(linkedByQuestion.get("Как создать «Портрет поколения» для семьи?"), [
    getGeneraciyaFotoScenarioPath("semya"),
  ]);
  assert.deepEqual(linkedByQuestion.get("Можно ли использовать фото как пример?"), [
    "#generator",
    "/foto-v-promt",
  ]);
  assert.deepEqual(linkedByQuestion.get("Как оплатить тариф?"), ["/pricing"]);
  assert.deepEqual(linkedByQuestion.get("Какие изображения можно создавать?"), [
    "/terms",
  ]);
  assert.equal(linkedByQuestion.has("Что такое ИИ фото?"), false);
  assert.equal(linkedByQuestion.has("Где скачать PromptShot на телефон?"), false);
});

test("reviews plant at most two Wordstat phrases each", () => {
  const quoteHits = reviewKeywordHits(GENERACIYA_FOTO_REVIEWS.quote);
  assert.deepEqual(quoteHits, [...GENERACIYA_FOTO_REVIEWS.quoteKeywords]);
  assert.ok(quoteHits.length >= 1 && quoteHits.length <= 2);

  const names = GENERACIYA_FOTO_REVIEWS.items.map((item) => item.name);
  assert.deepEqual(names, [
    "Виолетта",
    "Виа Вика",
    "Светлана",
    "Viki",
    "Катя Молькова",
    "Карина",
    "Julia",
  ]);

  const planted = new Set<string>();
  for (const item of GENERACIYA_FOTO_REVIEWS.items) {
    assert.ok(item.keywords.length >= 1 && item.keywords.length <= 2, item.name);
    const hits = reviewKeywordHits(item.text);
    assert.deepEqual(
      [...hits].sort(),
      [...item.keywords].sort(),
      item.name
    );
    for (const keyword of item.keywords) {
      assert.ok(
        (GENERACIYA_FOTO_REVIEW_SEARCH_PHRASES as readonly string[]).includes(
          keyword
        ),
        keyword
      );
      planted.add(keyword);
    }
  }

  assert.ok(planted.has("сделать фото ии онлайн"));
  assert.ok(planted.has("сгенерировать фото ии"));
  assert.ok(planted.has("ии создать фото"));
  assert.equal(
    GENERACIYA_FOTO_REVIEWS.items.some((item) =>
      /порно|без регистрации|алиса|паспорт|бесплатно/i.test(item.text)
    ),
    false
  );
});
