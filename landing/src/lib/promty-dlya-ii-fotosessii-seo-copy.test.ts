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

test("hub snippet owns the commercial photoshoot head", () => {
  assert.equal(
    PROMTY_DLYA_II_FOTOSESSII_SEO.metaTitle,
    "ИИ фотосессия по фото онлайн | PromptShot"
  );
  assert.equal(PROMTY_DLYA_II_FOTOSESSII_SEO.h1, "ИИ фотосессия по своему фото");
  assert.equal(
    PROMTY_DLYA_II_FOTOSESSII_SEO.metaDescription,
    "ИИ фотосессия по своему фото: серия кадров в одном стиле. Загрузи одно фото и собери съёмку онлайн — без студии и фотографа."
  );
  assert.match(PROMTY_DLYA_II_FOTOSESSII_SEO.metaTitle, /по фото онлайн/i);
  assert.match(PROMTY_DLYA_II_FOTOSESSII_SEO.h1, /по своему фото/i);
  assert.doesNotMatch(PROMTY_DLYA_II_FOTOSESSII_SEO.metaTitle, /промты|бесплатн/i);
  assert.doesNotMatch(PROMTY_DLYA_II_FOTOSESSII_SEO.h1, /промты|сделать фото ии/i);
  assert.equal(
    PROMTY_DLYA_II_FOTOSESSII_SEO.examplesCta,
    "Больше идей для фото"
  );
  assert.doesNotMatch(
    PROMTY_DLYA_II_FOTOSESSII_SEO.metaDescription,
    /женск|мужск|купи кредит|бесплатн|сделать фото ии/i
  );
  assert.doesNotMatch(PROMTY_DLYA_II_FOTOSESSII_SEO.metaTitle, /девушк|мужск/i);
  assert.equal("generateBlockTitle" in PROMTY_DLYA_II_FOTOSESSII_SEO, false);
  assert.equal(PROMTY_DLYA_II_FOTOSESSII_SEO.carouselCta, "Собрать фотосессию");
  assert.equal(PROMTY_DLYA_II_FOTOSESSII_SEO.carouselCtaHref, "#primery");
  assert.equal(
    PROMTY_DLYA_II_FOTOSESSII_SEO.intro,
    "Загрузи одно фото и собери ИИ фотосессию: несколько кадров в одном стиле, без студии и фотографа."
  );
  assert.doesNotMatch(PROMTY_DLYA_II_FOTOSESSII_SEO.intro, /скопируй промт/i);
});

test("hub themes and how-to stay on the series-from-photo job", () => {
  assert.deepEqual(
    PROMTY_DLYA_II_FOTOSESSII_THEME_ITEMS.map((item) => item.href),
    [
      "/ii-fotosessiya/muzhskie",
      "/ii-fotosessiya/zhenskie",
      "/ii-fotosessiya/pary",
      "/ii-fotosessiya/den-rozhdeniya",
      "/ii-fotosessiya/detskie",
      "/ii-fotosessiya/semeynye",
      "/ii-fotosessiya/studiynye",
      "/ii-fotosessiya/zimnyaya",
      "/ii-fotosessiya/beremennye",
      "/ii-fotosessiya/s-voennymi",
      "/ii-fotosessiya/dlya-dvoih",
      "/ii-fotosessiya/novogodnyaya",
      "/ii-fotosessiya/vesennie",
      "/ii-fotosessiya/delovoy-stil",
      "/ii-fotosessiya/nyuborn",
      "/ii-fotosessiya/s-mashinoy",
      "/ii-fotosessiya/cherno-belye",
    ]
  );
  assert.equal(
    PROMTY_DLYA_II_FOTOSESSII_SEO.themesLead,
    "Женская, парная, семейная, зимняя, день рождения — у каждого сценария своя страница."
  );
  assert.equal(
    PROMTY_DLYA_II_FOTOSESSII_SEO.howToLead,
    "Сначала фото, потом несколько кадров из одного лука."
  );
  assert.equal(
    PROMTY_DLYA_II_FOTOSESSII_SEO.examplesIntro,
    "Готовые луки для серии. Открой пример и повтори со своим фото."
  );
  assert.equal("pricingLead" in PROMTY_DLYA_II_FOTOSESSII_SEO, false);
  assert.equal(PROMTY_DLYA_II_FOTOSESSII_HOW_TO_STEPS.length, 2);
  assert.equal(
    PROMTY_DLYA_II_FOTOSESSII_HOW_TO_STEPS[0].text,
    "Нужен снимок, где хорошо видно лицо. С него собирается вся серия."
  );
  assert.equal(
    PROMTY_DLYA_II_FOTOSESSII_HOW_TO_STEPS[1].text,
    "Выбери лук из примеров и сделай ещё кадры в том же стиле. Так это фотосессия, а не один файл."
  );
  assert.doesNotMatch(
    PROMTY_DLYA_II_FOTOSESSII_HOW_TO_STEPS.map((step) => step.text).join(" "),
    /купи кредит/i
  );
  assert.equal("sessionTitle" in PROMTY_DLYA_II_FOTOSESSII_SEO, false);
});

test("hub FAQ covers commercial tails without stealing L1 or GF keys", () => {
  const questions = PROMTY_DLYA_II_FOTOSESSII_FAQ.map((item) => item.q);
  assert.ok(questions.some((q) => /по фото/i.test(q)));
  assert.ok(questions.some((q) => /какое фото загрузить/i.test(q)));
  assert.ok(questions.some((q) => /отличается от одного кадра/i.test(q)));
  const blob = PROMTY_DLYA_II_FOTOSESSII_FAQ.map(
    (item) => `${item.q} ${flattenFotosessiiFaqAnswer(item.a)}`
  ).join(" ");
  assert.match(blob, /парн/i);
  assert.match(blob, /семейн/i);
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
  assert.equal(women.h1, "Женская ИИ фотосессия");
  assert.equal(men.h1, "Мужская ИИ фотосессия");
  assert.match(women.metaTitle, /женская/i);
  assert.match(men.metaTitle, /мужская/i);
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
  assert.equal(pairs.h1, "Парная ИИ фотосессия");
  assert.equal(family.h1, "Семейная ИИ фотосессия");
  assert.equal(kids.h1, "Детская ИИ фотосессия");
  assert.equal(pregnancy.h1, "ИИ фотосессия для беременных");
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
    /ИИ фотосессию для беременных/i
  );
});

test("new L2 copy owns theme photoshoot queries", () => {
  const expected: Record<string, string> = {
    "den-rozhdeniya": "ИИ фотосессия на день рождения",
    studiynye: "Студийная ИИ фотосессия",
    zimnyaya: "Зимняя ИИ фотосессия",
    "s-voennymi": "ИИ фотосессия с военными",
    "dlya-dvoih": "ИИ фотосессия для двоих",
    novogodnyaya: "Новогодняя ИИ фотосессия",
    vesennie: "Весенняя ИИ фотосессия",
    "delovoy-stil": "ИИ фотосессия в деловом стиле",
    nyuborn: "Ньюборн ИИ фотосессия",
    "s-mashinoy": "ИИ фотосессия с машиной",
    "cherno-belye": "Чёрно-белая ИИ фотосессия",
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
  const intros = new Set<string>();
  const themeLeads = new Set<string>();
  for (const { slug } of PROMTY_DLYA_II_FOTOSESSII_CHILDREN) {
    const copy = findPromtyDlyaIiFotosessiiChildCopy(slug);
    assert.ok(copy, slug);
    intros.add(copy.intro);
    themeLeads.add(copy.themesLead);
    assert.equal(copy.metaTitle, `${copy.h1} | PromptShot`);
    assert.equal(copy.howToSteps.length, 2);
    assert.equal("sessionTitle" in copy, false);
    assert.equal("catalogCtaTitle" in copy, false);
    assert.match(copy.metaDescription, /по своему фото/i);
    assert.match(copy.metaDescription, /онлайн/i);
    assert.doesNotMatch(copy.metaDescription, /бесплатн|сделать фото ии/i);
    assert.match(copy.intro, /загрузи снимок и собери/i);
    assert.match(copy.howToTitle, /^Как сделать /);
    assert.doesNotMatch(copy.howToTitle, / ии /);
    assert.match(copy.pricingLead, /кредиты на генерацию/i);
    assert.doesNotMatch(copy.metaTitle, /в нейросетях|промты для/i);
    assert.doesNotMatch(copy.h1, /в нейросетях|промты для/i);
    assert.doesNotMatch(`${copy.metaTitle} ${copy.h1}`, /промты для фото(?!сесс)/i);
    assert.equal(copy.carouselCtaHref, "#primery");
    assert.doesNotMatch(
      copy.faq.map((item) => item.q).join(" "),
      /где сделать .+ по промту/i
    );
    assert.doesNotMatch(
      copy.faq.map((item) => item.a).join(" "),
      /Нажми «Сгенерировать/i
    );
    assert.doesNotMatch(
      `${copy.intro} ${copy.howToLead} ${copy.examplesIntro}`,
      /вставь в нейросеть|не описывай внешность/i
    );
  }
  assert.equal(intros.size, PROMTY_DLYA_II_FOTOSESSII_CHILDREN.length);
  assert.equal(themeLeads.size, PROMTY_DLYA_II_FOTOSESSII_CHILDREN.length);
});
