import assert from "node:assert/strict";
import test from "node:test";
import {
  GENERACIYA_FOTO_FAQ,
  GENERACIYA_FOTO_HOW_TO_STEPS,
  GENERACIYA_FOTO_PACKS,
  GENERACIYA_FOTO_REVIEWS,
  GENERACIYA_FOTO_SEO,
  GENERACIYA_FOTO_THEMES,
  GENERACIYA_FOTO_TOOLS,
} from "./generaciya-foto-seo-copy";

const BANNED_META = /best|recommended|premium|\bfree\b|#1|бесплатно/i;

function countPhrase(haystack: string, needle: string): number {
  const hay = haystack.toLowerCase();
  const find = needle.toLowerCase();
  let from = 0;
  let count = 0;
  while (from < hay.length) {
    const index = hay.indexOf(find, from);
    if (index === -1) break;
    count += 1;
    from = index + find.length;
  }
  return count;
}

function countWord(haystack: string, word: string): number {
  const matches = haystack.toLowerCase().match(new RegExp(`(?:^|\\s)${word}(?=\\s|[.,!?:;]|$)`, "g"));
  return matches?.length ?? 0;
}

test("meta name and short description keep CWS limits", () => {
  assert.equal(GENERACIYA_FOTO_SEO.metaTitle, "Сделать фото ИИ онлайн");
  assert.ok(GENERACIYA_FOTO_SEO.metaTitle.length <= 75);
  assert.ok(GENERACIYA_FOTO_SEO.metaDescription.length <= 132);
  assert.ok(GENERACIYA_FOTO_SEO.metaDescription.length >= 80);
  assert.doesNotMatch(GENERACIYA_FOTO_SEO.metaTitle, BANNED_META);
  assert.doesNotMatch(GENERACIYA_FOTO_SEO.metaDescription, BANNED_META);
});

test("short description uses the head key once and not first", () => {
  const short = GENERACIYA_FOTO_SEO.metaDescription.toLowerCase();
  assert.equal(countPhrase(short, "сделать фото ии"), 1);
  assert.ok(!short.startsWith("сделать фото ии"));
  assert.ok(countWord(short, "фото") <= 2);
  assert.ok(countWord(short, "ии") <= 2);
});

test("visible H1 and HowTo keep Facee wording", () => {
  assert.equal(
    GENERACIYA_FOTO_SEO.h1,
    "Создавайте красивые ИИ-фото себя — без студии и камеры"
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
});

test("starter keeps Facee first screen and does not add extra headings", () => {
  assert.equal(
    GENERACIYA_FOTO_SEO.socialProof,
    "Более 2 500 000 человек уже создали свои фото 📸️"
  );
  assert.equal("starterEyebrow" in GENERACIYA_FOTO_SEO, false);
  assert.equal("starterTitle" in GENERACIYA_FOTO_SEO, false);
  assert.equal("starterLead" in GENERACIYA_FOTO_SEO, false);
});

test("hub blocks keep Facee homepage copy", () => {
  assert.equal(GENERACIYA_FOTO_THEMES.title, "Подборки шаблонов по темам");
  assert.equal(GENERACIYA_FOTO_THEMES.items[0].title, "Идеи для женских ИИ-фото");
  assert.equal(GENERACIYA_FOTO_THEMES.items[0].examples[0], "В студии с клубникой");
  assert.equal(GENERACIYA_FOTO_SEO.examplesTitle, "ИИ-фото от наших пользователей");
  assert.equal(GENERACIYA_FOTO_SEO.examplesCta, "Больше промптов для фото");
  assert.equal(GENERACIYA_FOTO_TOOLS.title, "Бесплатные сервисы");
  assert.equal(GENERACIYA_FOTO_TOOLS.tryLabel, "Попробовать");
  assert.equal(GENERACIYA_FOTO_TOOLS.items[0].title, "ИИ-редактор фото");
  assert.equal(
    GENERACIYA_FOTO_PACKS.title,
    "Выбирайте из 150+ готовых ИИ‑фотосессий"
  );
  assert.equal(GENERACIYA_FOTO_PACKS.items[0].title, "Фотосессия для пары в студии");
  assert.equal(GENERACIYA_FOTO_REVIEWS.items.length, 7);
  assert.equal(GENERACIYA_FOTO_REVIEWS.items[1].name, "Виа Вика");
  assert.match(GENERACIYA_FOTO_REVIEWS.items[1].text, /^«Знаю, многие ИИ/);
  assert.equal(GENERACIYA_FOTO_REVIEWS.moreLabel, "Показать больше");
  const promptFaq = GENERACIYA_FOTO_FAQ.find((item) =>
    item.q.startsWith("Где взять промпт")
  );
  const aiPhotoFaq = GENERACIYA_FOTO_FAQ.find((item) => item.q === "Что такое ИИ фото?");
  const photoshootFaq = GENERACIYA_FOTO_FAQ.find((item) =>
    item.q === "Как создать нейрофотосессию с собой?"
  );
  assert.match(promptFaq?.a ?? "", /галерее PromptShot с примерами образов/);
  assert.match(aiPhotoFaq?.a ?? "", /визажист и аренда локации/);
  assert.match(photoshootFaq?.a ?? "", /раздел «Фотосессии»/);
  assert.ok(GENERACIYA_FOTO_FAQ.some((item) => item.q.startsWith("Где скачать PromptShot")));
  assert.equal(
    GENERACIYA_FOTO_FAQ.some((item) => /Telegram|@facee|facee\.ru|Т-Банк/i.test(`${item.q} ${item.a}`)),
    false
  );
});
