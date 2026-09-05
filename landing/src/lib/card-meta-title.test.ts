import assert from "node:assert/strict";
import test from "node:test";
import {
  CARD_META_TITLE_MAX_LEN,
  buildCardMetaTitle,
  cardSlugShortId,
  stripCardTitlePrefix,
} from "./card-meta-title";

test("strips Visual Hook prefix", () => {
  assert.equal(
    stripCardTitlePrefix("Visual Hook: Элегантный силуэт в вечернем платье"),
    "Элегантный силуэт в вечернем платье",
  );
  assert.equal(stripCardTitlePrefix("Visual Hook: A striking contrast"), "A striking contrast");
});

test("reads trailing slug short id", () => {
  assert.equal(
    cardSlugShortId(
      "visual-hook-elegantnyy-siluet-v-vechernem-plate-s-vysokim-razrezom-podcherkivayu-df7fa",
    ),
    "df7fa",
  );
  assert.equal(cardSlugShortId("no-short-id-here"), null);
});

test("Visual Hook cards with different bodies no longer share a title", () => {
  const a = buildCardMetaTitle(
    "Visual Hook: Элегантный силуэт в вечернем платье с высоким разрезом",
    "visual-hook-elegantnyy-siluet-v-vechernem-plate-s-vysokim-razrezom-podcherkivayu-df7fa",
  );
  const b = buildCardMetaTitle(
    "Visual Hook: Элегантный силуэт у окна на фоне ночного города",
    "visual-hook-elegantnyy-siluet-u-okna-na-fone-nochnogo-goroda-aa111",
  );
  assert.notEqual(a, b);
  assert.doesNotMatch(a, /Visual Hook/i);
  assert.doesNotMatch(a, /промт для фото ИИ/);
  assert.ok(a.length <= CARD_META_TITLE_MAX_LEN);
  assert.ok(b.length <= CARD_META_TITLE_MAX_LEN);
});

test("junk identical titles get a slug disambiguator", () => {
  const a = buildCardMetaTitle(
    "Сделай такое же фото в два клика",
    "sdelay-takoe-zhe-foto-v-dva-klika-vyberi-sozdat-foto-obychnyy-ili-super-hd-ultra-181ad",
  );
  const b = buildCardMetaTitle(
    "Сделай такое же фото в два клика",
    "sdelay-takoe-zhe-foto-v-dva-klika-vyberi-sozdat-foto-super-hd-ultra-rezhim-zagru-cb388",
  );
  assert.notEqual(a, b);
  assert.match(a, /181ad/);
  assert.match(b, /cb388/);
  assert.ok(a.length <= CARD_META_TITLE_MAX_LEN);
});

test("generic catalog titles also disambiguate", () => {
  const a = buildCardMetaTitle("Подборка дня", "podborka-dnya-aaaa1");
  const b = buildCardMetaTitle("Подборка дня", "podborka-dnya-bbbb2");
  assert.equal(a, "Подборка дня · aaaa1 | PromptShot");
  assert.equal(b, "Подборка дня · bbbb2 | PromptShot");
});

test("unique short titles keep a clean suffix and stay under the cap", () => {
  const title = buildCardMetaTitle(
    "Девушка в бордовом платье с букетом роз",
    "devushka-v-bordovom-plate-s-buketom-roz-c7864",
  );
  assert.equal(title, "Девушка в бордовом платье с букетом роз | PromptShot");
  assert.ok(title.length <= CARD_META_TITLE_MAX_LEN);
});

test("truncated titles include the slug id and stay unique", () => {
  const long =
    "Кинематографичный портрет молодой женщины в длинном чёрном платье на крыше ночного города с неоновыми огнями и дождём";
  const a = buildCardMetaTitle(long, `${"x".repeat(20)}-aaa11`);
  const b = buildCardMetaTitle(long, `${"x".repeat(20)}-bbb22`);
  assert.notEqual(a, b);
  assert.match(a, /aaa11/);
  assert.match(b, /bbb22/);
  assert.ok(a.length <= CARD_META_TITLE_MAX_LEN);
  assert.ok(b.length <= CARD_META_TITLE_MAX_LEN);
});
