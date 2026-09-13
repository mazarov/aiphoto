import assert from "node:assert/strict";
import test from "node:test";
import { HOMEPAGE_FAQ, HOMEPAGE_SEO } from "./homepage-seo-copy";

const SEND_AWAY = /вставь в нейросеть|открой Nano Banana|вставь в ChatGPT/i;

test("homepage snippet keeps the listing key and CWS-safe length", () => {
  assert.equal(
    HOMEPAGE_SEO.title,
    "Промты для фото ИИ — 78 000 готовых на русском"
  );
  assert.ok(HOMEPAGE_SEO.title.length <= 70);
  assert.equal(HOMEPAGE_SEO.description, HOMEPAGE_SEO.intro);
  assert.ok(HOMEPAGE_SEO.description.length <= 180);
  assert.match(HOMEPAGE_SEO.title, /^Промты для фото ИИ/);
  assert.doesNotMatch(HOMEPAGE_SEO.title, /фотосессии/);
  // CTR-факторы Вебмастера: число, «на русском», «нейросети», «бесплатно»
  assert.match(HOMEPAGE_SEO.title, /78 000/);
  assert.match(HOMEPAGE_SEO.title, /на русском/i);
  assert.equal(
    HOMEPAGE_SEO.description,
    "78 000 промтов для фото ИИ и нейросетей на русском. Скопируй промт бесплатно или загрузи своё фото и повтори кадр в 1 клик."
  );
  assert.match(HOMEPAGE_SEO.description, /промтов для фото ИИ/i);
  assert.match(HOMEPAGE_SEO.description, /на русском/i);
  assert.match(HOMEPAGE_SEO.description, /нейросет/i);
  assert.match(HOMEPAGE_SEO.description, /бесплатно/i);
  // мобильная обрезка ~100 знаков должна успеть показать модификаторы
  assert.match(HOMEPAGE_SEO.description.slice(0, 100), /на русском/i);
  assert.doesNotMatch(
    HOMEPAGE_SEO.description,
    /нано банана|Nano Banana|Нано Банана|GPT|Gemini/i
  );
  assert.match(HOMEPAGE_SEO.h1.main, /^Промты для фото$/);
  assert.equal(HOMEPAGE_SEO.h1.accent, "ИИ");
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
  // «промты для фото на русском» должно стоять непрерывной фразой в своём пассаже
  assert.match(HOMEPAGE_SEO.examplesIntro, /промты для фото на русском/i);
  assert.doesNotMatch(
    HOMEPAGE_SEO.examplesIntroSecondary,
    /промты для нано банана/i
  );
  assert.doesNotMatch(HOMEPAGE_SEO.examplesIntro, /нано банана|ChatGPT|Gemini/i);
  // H2 «Идеи промтов для фото» больше не стоит без текста
  assert.match(HOMEPAGE_SEO.galleryIntro, /идеи промтов для фото/i);
  assert.doesNotMatch(HOMEPAGE_SEO.galleryIntro, SEND_AWAY);
  // ключи в H2, которые раньше их не несли
  assert.match(HOMEPAGE_SEO.faqTitle, /промтах для фото/i);
  assert.match(HOMEPAGE_SEO.howToTitle, /для генерации фото/i);
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
    "Какая нейросеть создаёт фото по промту?",
    "Где взять промты для нано банана?",
  ]);
  assert.equal(HOMEPAGE_FAQ.length, 7);
  // «промт для фото в нейросети» — 2 271 показ, до этого без блока-владельца
  const neuro = HOMEPAGE_FAQ.find((item) => item.id === "neuro");
  assert.match(neuro?.aPlain ?? "", /промт для фото в нейросети/i);
  // «пример промта для фото» стоял на позиции 9,0 — ответ должен нести фразу
  const example = HOMEPAGE_FAQ.find((item) => item.id === "example");
  assert.match(example?.aPlain ?? "", /пример промта для фото/i);
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
  assert.match(nanoBanana?.aPlain ?? "", /странице Nano Banana/i);
  assert.doesNotMatch(nanoBanana?.aPlain ?? "", /каталоге на этой странице/);
  assert.doesNotMatch(nanoBanana?.aPlain ?? "", /блоке моделей генератора/);
  for (const item of HOMEPAGE_FAQ) {
    assert.doesNotMatch(item.q, /промпт/i);
    assert.doesNotMatch(item.aPlain, /промпт/i);
    assert.doesNotMatch(item.aPlain, SEND_AWAY);
  }
});
