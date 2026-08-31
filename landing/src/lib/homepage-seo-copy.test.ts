import assert from "node:assert/strict";
import test from "node:test";
import { HOMEPAGE_FAQ, HOMEPAGE_SEO } from "./homepage-seo-copy";

const SEND_AWAY = /вставь в нейросеть|открой Nano Banana|вставь в ChatGPT/i;

test("homepage snippet keeps the listing key and CWS-safe length", () => {
  assert.equal(
    HOMEPAGE_SEO.title,
    "Промты для ИИ фото в нейросетях | PromptShot"
  );
  assert.ok(HOMEPAGE_SEO.title.length <= 70);
  assert.equal(
    HOMEPAGE_SEO.description,
    "Готовые промты для генерации ИИ фото в нейросетях на русском. Бесплатно. Подходит для создания фото в ChatGPT, Gemini, Nano Banana или других нейросетях."
  );
  assert.ok(HOMEPAGE_SEO.description.length <= 180);
  assert.match(HOMEPAGE_SEO.title, /^Промты для ИИ фото/);
  assert.match(HOMEPAGE_SEO.h1.main, /^Промты для ИИ фото$/);
  assert.equal(HOMEPAGE_SEO.h1.accent, "в нейросетях");
});

test("homepage blocks keep listing CTA and do not send people away", () => {
  assert.equal(
    HOMEPAGE_SEO.heroSubtitle,
    "PromptShot — каталог промтов для фото в ИИ и нейросетях. Скопируй промт или загрузи своё фото и повтори кадр."
  );
  assert.equal(HOMEPAGE_SEO.heroSubtitle, HOMEPAGE_SEO.intro);
  assert.equal(HOMEPAGE_SEO.examplesEyebrow, "Каталог промтов");
  assert.equal(HOMEPAGE_SEO.examplesTitle, "Готовые промты для фотографий");
  assert.equal(HOMEPAGE_SEO.catalogCta, "Перейти в каталог");
  assert.equal(HOMEPAGE_SEO.catalogHref, "/catalog");
  assert.equal(HOMEPAGE_SEO.galleryTitle, "Идеи промтов для фото");
  assert.equal(HOMEPAGE_SEO.examplesIntro, "");
  assert.equal(
    HOMEPAGE_SEO.examplesIntroSecondary,
    "Все промты на русском. Копируй бесплатно. Подходят для ChatGPT, Gemini и Nano Banana."
  );
  assert.deepEqual(HOMEPAGE_SEO.howToSteps, [
    "Открой карточку с готовым промтом для фото и нажми «Скопировать промт».",
    "Вставь текст в генератор на сайте и при необходимости загрузи своё фото.",
    "Запусти генерацию и скачай готовый кадр.",
    "Если кадр не тот — поправь промт и запусти ещё раз.",
  ]);
  assert.doesNotMatch(HOMEPAGE_SEO.examplesIntroSecondary, SEND_AWAY);
  assert.doesNotMatch(HOMEPAGE_SEO.intro, SEND_AWAY);
  for (const step of HOMEPAGE_SEO.howToSteps) {
    assert.doesNotMatch(step, SEND_AWAY);
  }
});

test("homepage FAQ covers leftover Wordcraft tails, not other-block keys", () => {
  const questions = HOMEPAGE_FAQ.map((item) => item.q);
  assert.deepEqual(questions, [
    "Что такое промт для фото?",
    "Где взять пример промта для фото?",
    "Как пользоваться промтом для генерации фото?",
    "Как сделать ИИ-фотосессию по промту со своим фото?",
    "Какие промты для фото лучшие?",
    "Какая нейросеть создаёт фото по промту?",
  ]);
  assert.equal(HOMEPAGE_FAQ.length, 6);
  assert.equal(
    questions.some((q) => /сделать фото ИИ|пары|девушк|обработ|бесплатн/i.test(q)),
    false
  );
  const photoshoot = HOMEPAGE_FAQ.find((item) => item.id === "photoshoot");
  assert.match(photoshoot?.aPlain ?? "", /ИИ фотосессия/);
  assert.doesNotMatch(
    photoshoot?.aPlain ?? "",
    /Открой несколько карточек с идеями/
  );
  for (const item of HOMEPAGE_FAQ) {
    assert.doesNotMatch(item.q, /промпт/i);
    assert.doesNotMatch(item.aPlain, /промпт/i);
    assert.doesNotMatch(item.aPlain, SEND_AWAY);
  }
});
