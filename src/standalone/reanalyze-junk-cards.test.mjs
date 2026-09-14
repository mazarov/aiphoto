import assert from "node:assert/strict";
import test from "node:test";
import {
  CARD_SLUG_MAX_LEN,
  buildCardSlug,
  cardSlugShortId,
  isJunkCardSlug,
  isJunkCardTitle,
  translitSlugText,
} from "./reanalyze-junk-cards.mjs";

test("junk titles still match telegram captions", () => {
  assert.equal(isJunkCardTitle("Подборка дня"), true);
  assert.equal(isJunkCardTitle("Мужской промпт"), true);
  assert.equal(
    isJunkCardTitle("Сделай такое же фото в два клика 👁  Выбери «Создать фото»"),
    true,
  );
  assert.equal(isJunkCardTitle("Девушка в красном платье у окна"), false);
});

test("junk slugs match leftover catalog URLs", () => {
  assert.equal(isJunkCardSlug("podborka-dnya-2-2cd88"), true);
  assert.equal(isJunkCardSlug("muzhskoy-prompt-03675"), true);
  assert.equal(
    isJunkCardSlug(
      "sdelay-takoe-zhe-foto-v-dva-klika-vyberi-sozdat-foto-obychnyy-ili-super-hd-ultra-05eac",
    ),
    true,
  );
  assert.equal(isJunkCardSlug("dokladchik-s-mikrofonom-na-konferentsii-2cd88"), false);
  assert.equal(isJunkCardSlug("devushka-v-krasnom-plate-u-okna-0f11d"), false);
});

test("slug text comes from the title, short id stays", () => {
  const slug = buildCardSlug(
    "Докладчик с микрофоном на конференции",
    "podborka-dnya-2-2cd88",
    "2cd88aaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  );
  assert.equal(slug, "dokladchik-s-mikrofonom-na-konferentsii-2cd88");
  assert.equal(cardSlugShortId(slug), "2cd88");
  assert.ok(slug.length <= CARD_SLUG_MAX_LEN);
});

test("long titles stay under 128 with the same code", () => {
  const title = "Очень длинное описание сцены с множеством деталей про девушку в красном платье у окна на фоне парижской улицы вечером";
  const slug = buildCardSlug(title, "podborka-dnya-2-2cd88", "2cd88aaa-0000-0000-0000-000000000000");
  assert.equal(cardSlugShortId(slug), "2cd88");
  assert.ok(slug.length <= CARD_SLUG_MAX_LEN);
  assert.ok(slug.startsWith(translitSlugText(title).slice(0, 20)));
});
