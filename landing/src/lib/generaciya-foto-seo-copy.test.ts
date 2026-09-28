import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGeneraciyaFotoMetaTitle,
  flattenGeneraciyaFotoFaqAnswer,
  formatGeneraciyaFotoSocialProof,
  GENERACIYA_FOTO_FAQ,
  GENERACIYA_FOTO_HOW_IT_WORKS,
  GENERACIYA_FOTO_HOW_TO_STEPS,
  GENERACIYA_FOTO_MORE_LEAD,
  GENERACIYA_FOTO_MORE_TITLE,
  GENERACIYA_FOTO_PRICING,
  GENERACIYA_FOTO_SCENARIOS_NAV,
  GENERACIYA_FOTO_SEO,
  GENERACIYA_FOTO_THEMES,
  GENERACIYA_FOTO_TOOLS,
  GENERACIYA_MODE_LINKS,
  GENERACIYA_PO_FOTO_FAQ,
  GENERACIYA_PO_FOTO_HOW_TO_STEPS,
  GENERACIYA_PO_FOTO_SEO,
  generaciyaModeLinksExcept,
  isGeneraciyaFotoFaqLink,
} from "./generaciya-foto-seo-copy";
import {
  GENERACIYA_FOTO_PO_OPISANIYU_PATH,
  GENERACIYA_KARTINKA_PO_OPISANIYU_PATH,
  GENERACIYA_PO_FOTO_PATH,
  getGeneraciyaFotoScenarioPath,
} from "./generaciya-foto-routes";
import {
  KARTINKA_PO_OPISANIYU_FAQ,
  KARTINKA_PO_OPISANIYU_HOW_IT_WORKS,
  KARTINKA_PO_OPISANIYU_SEO,
} from "./kartinka-po-opisaniyu-seo-copy";

const BANNED_META = /best|recommended|premium|\bfree\b|#1|бесплатно|PromptShot/i;

test("foto-po-opisaniyu: Title ≠ H1, main key in H1, counter in Title", () => {
  assert.equal(GENERACIYA_FOTO_SEO.h1, "Сделать фото по описанию");
  assert.match(GENERACIYA_FOTO_SEO.metaTitle, /^Сделать фото по описанию 📸 — /);
  assert.notEqual(GENERACIYA_FOTO_SEO.metaTitle, GENERACIYA_FOTO_SEO.h1);
  assert.ok(GENERACIYA_FOTO_SEO.metaTitle.length <= 75);
  assert.doesNotMatch(GENERACIYA_FOTO_SEO.metaTitle, BANNED_META);

  assert.match(
    buildGeneraciyaFotoMetaTitle(12_345),
    /^Сделать фото по описанию 📸 — ИИ онлайн, 12\s000\+ кадров уже создано$/
  );
  assert.equal(buildGeneraciyaFotoMetaTitle(999), GENERACIYA_FOTO_SEO.metaTitle);
  assert.equal(buildGeneraciyaFotoMetaTitle(Number.NaN), GENERACIYA_FOTO_SEO.metaTitle);
  assert.ok(buildGeneraciyaFotoMetaTitle(1_250_000).length <= 75);

  assert.match(GENERACIYA_FOTO_SEO.metaDescription, /^Опишите кадр словами/);
  assert.match(GENERACIYA_FOTO_SEO.metaDescription, /фото по описанию/);
  assert.ok(GENERACIYA_FOTO_SEO.metaDescription.length <= 160);
  assert.ok(GENERACIYA_FOTO_SEO.metaDescription.length >= 80);
  assert.doesNotMatch(GENERACIYA_FOTO_SEO.metaDescription, BANNED_META);
});

test("foto-po-opisaniyu: one extra key per heading, «по описанию» in at most two headings", () => {
  assert.match(GENERACIYA_FOTO_SEO.intro, /^Генерация фото по описанию/);
  assert.equal(GENERACIYA_FOTO_SEO.generatorTitle, "Создать фото по промту или по тексту");
  assert.equal(
    GENERACIYA_FOTO_SEO.examplesTitle,
    "ИИ фото по описанию: примеры и готовые промты"
  );
  assert.equal(GENERACIYA_FOTO_HOW_IT_WORKS.title, "Как нейросеть генерирует фото из текста");
  assert.equal(GENERACIYA_FOTO_SEO.howToTitle, "Как сделать фото ИИ за три шага");
  assert.equal(GENERACIYA_FOTO_SCENARIOS_NAV.title, "Сценарии: пары, семья, день рождения");
  assert.equal(GENERACIYA_FOTO_MORE_TITLE, "Другие режимы генерации");

  const headings = [
    GENERACIYA_FOTO_SEO.h1,
    GENERACIYA_FOTO_SEO.generatorTitle,
    GENERACIYA_FOTO_SEO.examplesTitle,
    GENERACIYA_FOTO_HOW_IT_WORKS.title,
    GENERACIYA_FOTO_SEO.howToTitle,
    GENERACIYA_FOTO_SCENARIOS_NAV.title,
    GENERACIYA_FOTO_MORE_TITLE,
  ];
  assert.equal(headings.filter((h) => /по описанию/i.test(h)).length, 2);
  // Object split: «картинка / изображение» belong to the sibling hub.
  for (const h of [...headings, GENERACIYA_FOTO_SEO.intro, GENERACIYA_FOTO_SEO.metaTitle]) {
    assert.doesNotMatch(h, /картинк|изображени/i, h);
  }
  // Photo mode is not promised on the text hub.
  for (const h of [GENERACIYA_FOTO_SEO.intro, GENERACIYA_FOTO_SEO.generatorLead, GENERACIYA_FOTO_SEO.metaDescription]) {
    assert.doesNotMatch(h, /сним(ок|ка|ку)|селфи|референс/i, h);
  }
  assert.match(GENERACIYA_FOTO_MORE_LEAD, /Картинка по тексту/);
});

test("kartinka-po-opisaniyu: main key in H1, «фото» kept out of its slots", () => {
  assert.equal(KARTINKA_PO_OPISANIYU_SEO.h1, "Сгенерировать картинку по описанию");
  assert.match(KARTINKA_PO_OPISANIYU_SEO.metaTitle, /^Сгенерировать картинку по описанию 🎨 — /);
  assert.notEqual(KARTINKA_PO_OPISANIYU_SEO.metaTitle, KARTINKA_PO_OPISANIYU_SEO.h1);
  assert.ok(KARTINKA_PO_OPISANIYU_SEO.metaTitle.length <= 75);
  assert.doesNotMatch(KARTINKA_PO_OPISANIYU_SEO.metaTitle, BANNED_META);
  assert.doesNotMatch(KARTINKA_PO_OPISANIYU_SEO.metaDescription, BANNED_META);
  assert.match(KARTINKA_PO_OPISANIYU_SEO.intro, /^Создать картинку по тексту/);
  assert.equal(
    KARTINKA_PO_OPISANIYU_SEO.generatorTitle,
    "Изображение по тексту: напишите промт и получите файл"
  );
  assert.equal(
    KARTINKA_PO_OPISANIYU_SEO.examplesTitle,
    "Картинки по тексту: примеры и готовые промты"
  );
  assert.equal(
    KARTINKA_PO_OPISANIYU_HOW_IT_WORKS.title,
    "Как нейросеть создаёт изображение по описанию"
  );
  const headings = [
    KARTINKA_PO_OPISANIYU_SEO.h1,
    KARTINKA_PO_OPISANIYU_SEO.generatorTitle,
    KARTINKA_PO_OPISANIYU_SEO.examplesTitle,
    KARTINKA_PO_OPISANIYU_HOW_IT_WORKS.title,
    KARTINKA_PO_OPISANIYU_SEO.howToTitle,
  ];
  assert.equal(headings.filter((h) => /по описанию/i.test(h)).length, 2);
  for (const h of [...headings, KARTINKA_PO_OPISANIYU_SEO.metaTitle]) {
    assert.doesNotMatch(h, /\bфото/i, h);
  }
  // Ambiguous «текст в картинку» lives only in FAQ.
  assert.ok(KARTINKA_PO_OPISANIYU_FAQ.some((item) => /текст в картинку/i.test(item.q)));
  for (const h of headings) assert.doesNotMatch(h, /текст в картинку/i);
  assert.equal(KARTINKA_PO_OPISANIYU_SEO.path, GENERACIYA_KARTINKA_PO_OPISANIYU_PATH);
});

test("po-foto hub keeps photo mode copy and the 22 scenarios", () => {
  assert.equal(GENERACIYA_PO_FOTO_SEO.h1, "Сделать фото ИИ по своему фото");
  assert.match(GENERACIYA_PO_FOTO_SEO.metaTitle, /^Сделать фото ИИ по своему фото 🤳 — 22 сценария/);
  assert.notEqual(GENERACIYA_PO_FOTO_SEO.metaTitle, GENERACIYA_PO_FOTO_SEO.h1);
  assert.doesNotMatch(GENERACIYA_PO_FOTO_SEO.metaTitle, BANNED_META);
  assert.equal(GENERACIYA_PO_FOTO_SEO.generatorTitle, "Создать фото по промту и своему снимку");
  assert.equal(GENERACIYA_PO_FOTO_HOW_TO_STEPS.length, 3);
  assert.match(GENERACIYA_PO_FOTO_HOW_TO_STEPS[0].text, /анфас/);
  assert.equal(GENERACIYA_FOTO_THEMES.title, "Сделать ИИ фото по теме");
  assert.equal(GENERACIYA_FOTO_THEMES.items.length, 22);
  assert.equal(GENERACIYA_FOTO_THEMES.items[0].title, "Для пар");
  assert.equal(GENERACIYA_FOTO_THEMES.items[0].href, getGeneraciyaFotoScenarioPath("pary"));
  assert.equal(GENERACIYA_FOTO_THEMES.items[0].href, "/generaciya/po-foto/pary");
  assert.equal(GENERACIYA_FOTO_TOOLS.title, "Редактирование фото с ИИ");
  assert.match(GENERACIYA_FOTO_TOOLS.lead, /^Изменить фото по описанию/);
  assert.deepEqual(
    GENERACIYA_FOTO_TOOLS.items.map((item) => item.title),
    ["ИИ-редактор фото", "Изменить причёску", "Удалить объект", "Улучшить качество"]
  );
  for (const item of GENERACIYA_FOTO_TOOLS.items) {
    assert.ok(item.prompt.trim().length > 40, item.title);
    assert.match(item.prompt, /[а-яё]/i, item.title);
  }
});

test("starter / social proof / pricing return paths", () => {
  assert.equal(GENERACIYA_FOTO_HOW_TO_STEPS.length, 3);
  assert.equal(GENERACIYA_FOTO_HOW_TO_STEPS[0].title, "Опишите кадр");
  assert.equal(GENERACIYA_FOTO_SEO.howToCta, "Создать фото");
  assert.match(
    formatGeneraciyaFotoSocialProof(4821) ?? "",
    /^Более 4\s821 человек уже сгенерировали ИИ фото$/
  );
  assert.equal(formatGeneraciyaFotoSocialProof(0), null);
  assert.equal(GENERACIYA_FOTO_SEO.examplesMoreHref, `${GENERACIYA_FOTO_PO_OPISANIYU_PATH}#primery`);
  assert.equal(GENERACIYA_FOTO_SEO.chipHubLabel, "Сделать фото по описанию");
  assert.equal(GENERACIYA_PO_FOTO_SEO.chipHubLabel, "По своему фото");
  assert.equal(GENERACIYA_FOTO_PRICING.variant, "treatment");
  assert.equal(GENERACIYA_FOTO_PRICING.returnPath, GENERACIYA_FOTO_PO_OPISANIYU_PATH);
});

test("mode links cover every hub of the section and exclude the current one", () => {
  assert.deepEqual(
    GENERACIYA_MODE_LINKS.map((item) => item.href),
    [
      GENERACIYA_FOTO_PO_OPISANIYU_PATH,
      GENERACIYA_KARTINKA_PO_OPISANIYU_PATH,
      GENERACIYA_PO_FOTO_PATH,
      "/ii-fotosessiya",
    ]
  );
  assert.equal(generaciyaModeLinksExcept("foto").some((i) => i.key === "foto"), false);
  assert.equal(generaciyaModeLinksExcept("kartinka").length, 3);
});

test("FAQ sets are split by mode and link only real PromptShot surfaces", () => {
  const allowedHrefs = new Set([
    "/",
    "/trends",
    "/foto-v-promt",
    "/ii-fotosessiya",
    "/nano-banana",
    "/terms",
    "#generator",
    "#primery",
    "#temy",
    "#tarify",
    GENERACIYA_FOTO_PO_OPISANIYU_PATH,
    GENERACIYA_KARTINKA_PO_OPISANIYU_PATH,
    GENERACIYA_PO_FOTO_PATH,
    getGeneraciyaFotoScenarioPath("pary"),
    getGeneraciyaFotoScenarioPath("semya"),
    "mailto:support_ru@promptshot.ru",
  ]);
  const banned = /Фотосессии|ИИ-редактор|Объединить два фото|https:\/\/promptshot\.ru\/terms|тестовые (запуски|генерации)|Telegram|@facee|facee\.ru|Т-Банк/i;

  for (const list of [GENERACIYA_FOTO_FAQ, GENERACIYA_PO_FOTO_FAQ, KARTINKA_PO_OPISANIYU_FAQ]) {
    assert.ok(list.length >= 8);
    for (const item of list) {
      const plain = flattenGeneraciyaFotoFaqAnswer(item.a);
      assert.doesNotMatch(plain, banned, item.q);
      for (const part of item.a.filter(isGeneraciyaFotoFaqLink)) {
        assert.ok(allowedHrefs.has(part.href), `${item.q} → ${part.href}`);
      }
    }
  }

  // Text hub never promises photo upload as a step; cross-links instead.
  const textQ = GENERACIYA_FOTO_FAQ.map((item) => item.q);
  assert.equal(textQ[0], "Как сделать фото по описанию?");
  assert.ok(textQ.includes("Можно ли сделать фото по описанию бесплатно?"));
  assert.ok(textQ.includes("Чем фото по описанию отличается от картинки по описанию?"));
  assert.equal(textQ.includes("Что делать, если изображение не похоже на меня?"), false);
  assert.equal(textQ.includes("Где скачать PromptShot на телефон?"), false);

  const photoQ = GENERACIYA_PO_FOTO_FAQ.map((item) => item.q);
  assert.equal(photoQ[0], "Как сделать фото ИИ по своему фото?");
  assert.ok(photoQ.includes("Что делать, если изображение не похоже на меня?"));
  assert.equal(photoQ.includes("Можно ли сделать фото по описанию бесплатно?"), false);

  // «Бесплатно» is answered honestly: no free generation promised.
  for (const list of [GENERACIYA_FOTO_FAQ, KARTINKA_PO_OPISANIYU_FAQ]) {
    const free = list.find((item) => /бесплатно/i.test(item.q));
    assert.ok(free);
    assert.match(flattenGeneraciyaFotoFaqAnswer(free.a), /списывает кредиты/);
  }
});
