import assert from "node:assert/strict";
import test from "node:test";
import {
  GENERACIYA_FOTO_HOW_TO_STEPS,
  GENERACIYA_FOTO_SEO,
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
  assert.equal(GENERACIYA_FOTO_SEO.howToTitle, "Как создать свои ИИ фото?");
  assert.equal(GENERACIYA_FOTO_HOW_TO_STEPS.length, 3);
  assert.equal(GENERACIYA_FOTO_HOW_TO_STEPS[0].title, "Загрузите свои фото");
  assert.match(GENERACIYA_FOTO_HOW_TO_STEPS[0].text, /1 до 5 фото/);
});
