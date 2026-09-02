import assert from "node:assert/strict";
import test from "node:test";
import { HOMEPAGE_FAQ, HOMEPAGE_SEO } from "./homepage-seo-copy";

const SEND_AWAY = /вставь в нейросеть|открой Nano Banana|вставь в ChatGPT/i;

test("homepage snippet keeps the listing key and CWS-safe length", () => {
  assert.equal(
    HOMEPAGE_SEO.title,
    "Промты для фото в ИИ с примерами | PromptShot"
  );
  assert.ok(HOMEPAGE_SEO.title.length <= 70);
  assert.equal(HOMEPAGE_SEO.description, HOMEPAGE_SEO.intro);
  assert.ok(HOMEPAGE_SEO.description.length <= 180);
  assert.match(HOMEPAGE_SEO.title, /^Промты для фото в ИИ/);
  assert.doesNotMatch(HOMEPAGE_SEO.title, /фотосессии/);
  assert.equal(
    HOMEPAGE_SEO.description,
    "Готовые промты для фото в ИИ с примерами результата. Скопируй промт бесплатно или загрузи своё фото и повтори кадр в 1 клик."
  );
  assert.match(HOMEPAGE_SEO.description, /промты для фото в ИИ/i);
  assert.match(HOMEPAGE_SEO.description, /с примерами результата/i);
  assert.doesNotMatch(
    HOMEPAGE_SEO.description,
    /нано банана|Nano Banana|Нано Банана|GPT|Gemini/i
  );
  assert.match(HOMEPAGE_SEO.h1.main, /^Промты для фото$/);
  assert.equal(HOMEPAGE_SEO.h1.accent, "в ИИ");
  assert.doesNotMatch(
    `${HOMEPAGE_SEO.title} ${HOMEPAGE_SEO.h1.main} ${HOMEPAGE_SEO.h1.accent}`,
    /нано банана|Nano Banana|Нано Банана/i
  );
});

test("homepage blocks keep listing CTA and do not send people away", () => {
  assert.equal(
    HOMEPAGE_SEO.heroSubtitle,
    HOMEPAGE_SEO.description
  );
  assert.equal(HOMEPAGE_SEO.heroSubtitle, HOMEPAGE_SEO.intro);
  assert.equal(HOMEPAGE_SEO.heroSubtitle, HOMEPAGE_SEO.description);
  assert.equal(HOMEPAGE_SEO.examplesEyebrow, "Каталог промтов");
  assert.equal(HOMEPAGE_SEO.examplesTitle, "Готовые промты для фото");
  assert.equal(HOMEPAGE_SEO.catalogCta, "Перейти в каталог");
  assert.equal(HOMEPAGE_SEO.catalogHref, "/catalog");
  assert.equal(HOMEPAGE_SEO.galleryTitle, "Идеи промтов для фото");
  assert.equal(HOMEPAGE_SEO.examplesIntro, "");
  assert.equal(
    HOMEPAGE_SEO.examplesIntroSecondary,
    "Все промты на русском. Копируй бесплатно. Промты для нано банана, ChatGPT и Gemini — копируй или повтори кадр здесь."
  );
  assert.match(HOMEPAGE_SEO.examplesIntroSecondary, /промты для нано банана/i);
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

test("homepage FAQ passes the photoshoot prompt cluster to its hub", () => {
  const questions = HOMEPAGE_FAQ.map((item) => item.q);
  assert.deepEqual(questions, [
    "Что такое промт для фото?",
    "Где взять пример промта для фото?",
    "Как пользоваться промтом для генерации фото?",
    "Где взять промты для ИИ фотосессии?",
    "Какие промты для фото лучшие?",
    "Где взять промты для нано банана?",
  ]);
  assert.equal(HOMEPAGE_FAQ.length, 6);
  assert.equal(
    questions.some((q) => /сделать фото ИИ|пары|девушк|обработ|бесплатн/i.test(q)),
    false
  );
  const photoshoot = HOMEPAGE_FAQ.find((item) => item.id === "photoshoot");
  assert.doesNotMatch(photoshoot?.aPlain ?? "", /каталоге на этой странице/);
  assert.match(photoshoot?.aPlain ?? "", /промты для ИИ фотосессии/);
  assert.match(photoshoot?.aPlain ?? "", /ИИ фотосессия/);
  assert.doesNotMatch(
    photoshoot?.aPlain ?? "",
    /Открой несколько карточек с идеями/
  );
  const nanoBanana = HOMEPAGE_FAQ.find((item) => item.id === "nano-banana");
  assert.equal(nanoBanana?.q, "Где взять промты для нано банана?");
  assert.match(nanoBanana?.aPlain ?? "", /промты для нано банана/i);
  assert.match(nanoBanana?.aPlain ?? "", /каталоге на этой странице/);
  assert.match(nanoBanana?.aPlain ?? "", /повторить кадр в 1 клик/);
  assert.match(nanoBanana?.aPlain ?? "", /блоке моделей генератора/);
  for (const item of HOMEPAGE_FAQ) {
    assert.doesNotMatch(item.q, /промпт/i);
    assert.doesNotMatch(item.aPlain, /промпт/i);
    assert.doesNotMatch(item.aPlain, SEND_AWAY);
  }
});
