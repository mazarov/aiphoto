import assert from "node:assert/strict";
import test from "node:test";
import { PROMTY_DLYA_II_FOTOSESSII_CHILDREN } from "./promty-dlya-ii-fotosessii-cluster";
import {
  PROMTY_DLYA_II_FOTOSESSII_FAQ,
  PROMTY_DLYA_II_FOTOSESSII_HOW_TO_STEPS,
  PROMTY_DLYA_II_FOTOSESSII_SEO,
  PROMTY_DLYA_II_FOTOSESSII_THEME_ITEMS,
  findPromtyDlyaIiFotosessiiChildCopy,
  flattenFotosessiiFaqAnswer,
} from "./promty-dlya-ii-fotosessii-seo-copy";

const PROMPT_TYPO = /промпт/i;

test("hub snippet owns the photoshoot head and not the homepage key", () => {
  assert.equal(
    PROMTY_DLYA_II_FOTOSESSII_SEO.metaTitle,
    "Промты для ИИ фотосессии в нейросетях | PromptShot"
  );
  assert.equal(
    PROMTY_DLYA_II_FOTOSESSII_SEO.h1,
    "Промты для ИИ фотосессии в нейросетях"
  );
  assert.equal(
    PROMTY_DLYA_II_FOTOSESSII_SEO.metaDescription,
    "Промты для ИИ фотосессии в нейросетях. Готовые промты для создания ИИ фотосессии на русском — скопируй или создай серию со своим фото."
  );
  assert.match(PROMTY_DLYA_II_FOTOSESSII_SEO.metaDescription, /готовые промты для создания/i);
  assert.match(PROMTY_DLYA_II_FOTOSESSII_SEO.metaDescription, /на русском/i);
  assert.doesNotMatch(
    PROMTY_DLYA_II_FOTOSESSII_SEO.metaDescription,
    /женск|мужск|купи кредит|промты для фото(?!сесс)/i
  );
  assert.doesNotMatch(PROMTY_DLYA_II_FOTOSESSII_SEO.metaTitle, /^Готовые/);
  assert.doesNotMatch(PROMTY_DLYA_II_FOTOSESSII_SEO.metaTitle, /девушк|мужск/i);
  assert.doesNotMatch(PROMTY_DLYA_II_FOTOSESSII_SEO.h1, /промты для ИИ фото /i);
  assert.equal("generateBlockTitle" in PROMTY_DLYA_II_FOTOSESSII_SEO, false);
  assert.equal(
    PROMTY_DLYA_II_FOTOSESSII_SEO.carouselCta,
    "Выберите стиль ИИ фотосессии",
  );
  assert.equal(PROMTY_DLYA_II_FOTOSESSII_SEO.carouselCtaHref, "#primery");
  assert.equal(
    PROMTY_DLYA_II_FOTOSESSII_SEO.intro,
    "Промты для ИИ фотосессии в нейросетях — готовые тексты на серию кадров. Скопируй промт и создай ИИ фотосессию."
  );
  assert.doesNotMatch(PROMTY_DLYA_II_FOTOSESSII_SEO.intro, /не на один снимок|собери съёмку/i);
});

test("hub themes and how-to stay on the series job", () => {
  assert.deepEqual(
    PROMTY_DLYA_II_FOTOSESSII_THEME_ITEMS.map((item) => item.href),
    [
      "/promty-dlya-ii-fotosessii/muzhskie",
      "/promty-dlya-ii-fotosessii/zhenskie",
      "/promty-dlya-ii-fotosessii/pary",
      "/promty-dlya-ii-fotosessii/den-rozhdeniya",
      "/promty-dlya-ii-fotosessii/detskie",
      "/promty-dlya-ii-fotosessii/semeynye",
      "/promty-dlya-ii-fotosessii/studiynye",
      "/promty-dlya-ii-fotosessii/zimnyaya",
      "/promty-dlya-ii-fotosessii/beremennye",
      "/promty-dlya-ii-fotosessii/s-voennymi",
      "/promty-dlya-ii-fotosessii/dlya-dvoih",
      "/promty-dlya-ii-fotosessii/novogodnyaya",
      "/promty-dlya-ii-fotosessii/vesennie",
      "/promty-dlya-ii-fotosessii/delovoy-stil",
      "/promty-dlya-ii-fotosessii/nyuborn",
      "/promty-dlya-ii-fotosessii/s-mashinoy",
      "/promty-dlya-ii-fotosessii/cherno-belye",
    ]
  );
  assert.equal(
    PROMTY_DLYA_II_FOTOSESSII_SEO.themesLead,
    "Готовые промты для ИИ фотосессии на русском: женские, мужские, пары, семья и другие стили серии."
  );
  assert.equal(
    PROMTY_DLYA_II_FOTOSESSII_SEO.howToLead,
    "Как сделать ИИ фотосессию: скопируй готовый промт или создай серию со своим фото. Копирование бесплатное, генерация — за кредиты."
  );
  assert.equal(
    PROMTY_DLYA_II_FOTOSESSII_SEO.examplesIntro,
    "Готовые промты для создания ИИ фотосессии — скопируй текст с карточки или создай серию со своим фото. Для съёмки держи один стиль и одного героя."
  );
  assert.equal(
    PROMTY_DLYA_II_FOTOSESSII_SEO.pricingLead,
    "Кредиты на генерацию ИИ-фотосессии. Промты копируются бесплатно — пакет нужен, чтобы собрать серию кадров."
  );
  assert.equal(PROMTY_DLYA_II_FOTOSESSII_HOW_TO_STEPS.length, 2);
  assert.equal(
    PROMTY_DLYA_II_FOTOSESSII_HOW_TO_STEPS[0].text,
    "Загрузи фото, с которого нужна серия, или возьми готовый промт для создания ИИ фотосессии."
  );
  assert.equal(
    PROMTY_DLYA_II_FOTOSESSII_HOW_TO_STEPS[1].text,
    "Купи кредиты и создай несколько кадров из одного лука — так получается ИИ-фотосессия, а не набор случайных снимков."
  );
  assert.doesNotMatch(
    PROMTY_DLYA_II_FOTOSESSII_HOW_TO_STEPS.map((step) => step.text).join(" "),
    /1 до 5 фото/
  );
  assert.doesNotMatch(
    `${PROMTY_DLYA_II_FOTOSESSII_SEO.howToLead} ${PROMTY_DLYA_II_FOTOSESSII_HOW_TO_STEPS.map((step) => step.text).join(" ")}`,
    /или возьми пример, затем собери серию/
  );
  assert.equal("sessionTitle" in PROMTY_DLYA_II_FOTOSESSII_SEO, false);
});

test("hub FAQ covers tails without stealing L1 keys", () => {
  const questions = PROMTY_DLYA_II_FOTOSESSII_FAQ.map((item) => item.q);
  assert.ok(questions.some((q) => /готовые промты для ИИ фотосессии/i.test(q)));
  assert.ok(questions.some((q) => /на русском/i.test(q)));
  assert.ok(questions.some((q) => /нейрофотосессии/i.test(q)));
  const blob = PROMTY_DLYA_II_FOTOSESSII_FAQ.map(
    (item) => `${item.q} ${flattenFotosessiiFaqAnswer(item.a)}`
  ).join(" ");
  assert.doesNotMatch(blob, PROMPT_TYPO);
  assert.equal(
    PROMTY_DLYA_II_FOTOSESSII_FAQ.some((item) => /сделать фото ии/i.test(item.q)),
    false
  );
});

test("L2 copy owns gender photoshoot queries and points back to L1", () => {
  const women = findPromtyDlyaIiFotosessiiChildCopy("zhenskie");
  const men = findPromtyDlyaIiFotosessiiChildCopy("muzhskie");
  assert.ok(women && men);
  assert.equal(women.h1, "Промты для ИИ фотосессии женские");
  assert.equal(men.h1, "Промты для ИИ фотосессии мужские");
  assert.match(women.metaTitle, /женские/);
  assert.match(men.metaTitle, /мужские/);
  assert.doesNotMatch(women.metaTitle, /с цветами|день рождения/i);
  assert.match(
    women.faq.map((item) => `${item.q} ${item.a}`).join(" "),
    /промт(ы|ов) для фото девушки/i
  );
  assert.match(
    men.faq.map((item) => `${item.q} ${item.a}`).join(" "),
    /промт(ы|ов) для фото мужчины/i
  );
  assert.equal(findPromtyDlyaIiFotosessiiChildCopy("devushki"), null);
});

test("L2 copy owns pair family kids pregnancy queries", () => {
  const pairs = findPromtyDlyaIiFotosessiiChildCopy("pary");
  const family = findPromtyDlyaIiFotosessiiChildCopy("semeynye");
  const kids = findPromtyDlyaIiFotosessiiChildCopy("detskie");
  const pregnancy = findPromtyDlyaIiFotosessiiChildCopy("beremennye");
  assert.ok(pairs && family && kids && pregnancy);
  assert.equal(pairs.h1, "Промты для ИИ фотосессии парные");
  assert.equal(family.h1, "Промты для ИИ фотосессии семейные");
  assert.equal(kids.h1, "Промты для ИИ фотосессии детские");
  assert.equal(pregnancy.h1, "Промты для ИИ фотосессии беременные");
  assert.doesNotMatch(pairs.metaTitle, /свадьб|беремен/i);
  assert.doesNotMatch(family.metaTitle, /детск|беремен/i);
  assert.doesNotMatch(kids.metaTitle, /семейн|день рождения/i);
  assert.match(
    pairs.faq.map((item) => `${item.q} ${item.a}`).join(" "),
    /промт(ы|ов) для фото пар/i
  );
  assert.match(
    family.faq.map((item) => `${item.q} ${item.a}`).join(" "),
    /промт(ы|ов) для семейного фото/i
  );
  assert.match(
    kids.faq.map((item) => `${item.q} ${item.a}`).join(" "),
    /промт(ы|ов) для детских фото/i
  );
  assert.match(
    pregnancy.faq.map((item) => item.q).join(" "),
    /промт для беременной фотосессии/i
  );
});

test("new L2 copy owns theme photoshoot queries", () => {
  const expected: Record<string, string> = {
    "den-rozhdeniya": "Промты для ИИ фотосессии на день рождения",
    studiynye: "Промты для ИИ фотосессии студийные",
    zimnyaya: "Промты для ИИ фотосессии зимняя",
    "s-voennymi": "Промты для ИИ фотосессии с военными",
    "dlya-dvoih": "Промты для ИИ фотосессии для двоих",
    novogodnyaya: "Промты для ИИ фотосессии новогодняя",
    vesennie: "Промты для ИИ фотосессии весенние",
    "delovoy-stil": "Промты для ИИ фотосессии деловой стиль",
    nyuborn: "Промты для ИИ фотосессии ньюборн",
    "s-mashinoy": "Промты для ИИ фотосессии с машиной",
    "cherno-belye": "Промты для ИИ фотосессии чёрно-белые",
  };
  for (const [slug, h1] of Object.entries(expected)) {
    const copy = findPromtyDlyaIiFotosessiiChildCopy(slug);
    assert.ok(copy, slug);
    assert.equal(copy.h1, h1);
    assert.match(copy.metaTitle, new RegExp(h1.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.doesNotMatch(`${copy.h1} ${copy.metaTitle}`, /промпт/i);
  }
  assert.match(
    findPromtyDlyaIiFotosessiiChildCopy("dlya-dvoih")
      ?.faq.map((item) => `${item.q} ${item.a}`)
      .join(" ") ?? "",
    /парн/i
  );
  assert.match(
    findPromtyDlyaIiFotosessiiChildCopy("nyuborn")
      ?.faq.map((item) => `${item.q} ${item.a}`)
      .join(" ") ?? "",
    /детск/i
  );
  assert.match(
    findPromtyDlyaIiFotosessiiChildCopy("den-rozhdeniya")
      ?.faq.map((item) => `${item.q} ${item.a}`)
      .join(" ") ?? "",
    /промт(ы|ов) на день рождения/i
  );
});

test("L2 copy mirrors hub templates without stealing hub or homepage keys", () => {
  assert.equal(PROMTY_DLYA_II_FOTOSESSII_CHILDREN.length, 17);
  for (const { slug } of PROMTY_DLYA_II_FOTOSESSII_CHILDREN) {
    const copy = findPromtyDlyaIiFotosessiiChildCopy(slug);
    assert.ok(copy, slug);
    assert.equal(copy.metaTitle, `${copy.h1} | PromptShot`);
    assert.equal(copy.howToSteps.length, 2);
    assert.equal("sessionTitle" in copy, false);
    assert.equal("catalogCtaTitle" in copy, false);
    assert.match(copy.metaDescription, /^Промты для ИИ фотосессии /);
    assert.match(copy.metaDescription, /готовые промты для создания/i);
    assert.match(copy.metaDescription, /на русском/i);
    assert.match(copy.intro, /скопируй промт и создай/i);
    assert.match(copy.howToTitle, /^Как сделать /);
    assert.match(copy.pricingLead, /кредиты на генерацию/i);
    assert.doesNotMatch(copy.metaTitle, /в нейросетях/i);
    assert.doesNotMatch(copy.h1, /в нейросетях/i);
    assert.doesNotMatch(`${copy.metaTitle} ${copy.h1}`, /промты для фото(?!сесс)/i);
    assert.equal(copy.carouselCtaHref, "#primery");
    assert.doesNotMatch(
      copy.faq.map((item) => item.a).join(" "),
      /Нажми «Сгенерировать/i
    );
    assert.doesNotMatch(
      `${copy.intro} ${copy.howToLead} ${copy.examplesIntro}`,
      /вставь в нейросеть|не описывай внешность/i
    );
  }
});
