import assert from "node:assert/strict";
import test from "node:test";
import {
  flattenGeneraciyaFotoFaqAnswer,
  isGeneraciyaFotoFaqLink,
} from "./generaciya-foto-seo-copy";
import {
  formatNanoBananaSocialProof,
  NANO_BANANA_ACCESS_ITEMS,
  NANO_BANANA_FAQ,
  NANO_BANANA_HOW_TO_STEPS,
  NANO_BANANA_PATH,
  NANO_BANANA_PRICING,
  NANO_BANANA_SEO,
  NANO_BANANA_TOOLS,
} from "./nano-banana-seo-copy";

const PROMPT_WORD = /промт|промпт|(?<![a-z])prompt(?![a-z])/i;
const SEND_AWAY = /вставь в нейросеть|открой Nano Banana|вставь в ChatGPT/i;
const BANNED_META = /best|recommended|premium|\bfree\b|#1|бесплатно/i;

function pagePlainText(): string {
  return [
    NANO_BANANA_SEO.metaTitle,
    NANO_BANANA_SEO.metaDescription,
    NANO_BANANA_SEO.h1,
    NANO_BANANA_SEO.intro,
    NANO_BANANA_SEO.howToTitle,
    NANO_BANANA_SEO.howToLead,
    NANO_BANANA_SEO.examplesTitle,
    NANO_BANANA_SEO.examplesIntro,
    NANO_BANANA_TOOLS.title,
    NANO_BANANA_TOOLS.lead,
    ...NANO_BANANA_ACCESS_ITEMS.map((item) => `${item.title} ${item.text}`),
    ...NANO_BANANA_HOW_TO_STEPS.map((step) => `${step.title} ${step.text}`),
    ...NANO_BANANA_FAQ.map(
      (item) => `${item.q} ${flattenGeneraciyaFotoFaqAnswer(item.a)}`
    ),
  ].join("\n");
}

test("hub keeps one key and CWS-safe snippet", () => {
  assert.equal(NANO_BANANA_PATH, "/nano-banana");
  assert.equal(NANO_BANANA_SEO.h1, "Nano Banana");
  assert.equal(
    NANO_BANANA_SEO.metaTitle,
    "Nano Banana — нейросеть Google для фото онлайн"
  );
  assert.ok(NANO_BANANA_SEO.metaTitle.length <= 70);
  assert.match(NANO_BANANA_SEO.metaTitle, /^Nano Banana/);
  assert.doesNotMatch(NANO_BANANA_SEO.metaTitle, /Pro|промт|сделать фото ИИ/i);
  assert.equal(
    NANO_BANANA_SEO.metaDescription,
    "Создавайте и редактируйте фото в Nano Banana. Доступ к моделям Google Gemini в России без VPN, оплата в рублях."
  );
  assert.ok(NANO_BANANA_SEO.metaDescription.length <= 132);
  assert.ok(NANO_BANANA_SEO.metaDescription.length >= 80);
  assert.doesNotMatch(NANO_BANANA_SEO.metaTitle, BANNED_META);
  assert.doesNotMatch(NANO_BANANA_SEO.metaDescription, BANNED_META);
  assert.match(NANO_BANANA_SEO.intro, /без VPN/);
  assert.match(NANO_BANANA_SEO.intro, /Google/);
});

test("generator copy does not own prompt queries", () => {
  assert.doesNotMatch(pagePlainText(), PROMPT_WORD);
  assert.doesNotMatch(pagePlainText(), SEND_AWAY);
  assert.equal(NANO_BANANA_HOW_TO_STEPS.length, 3);
  assert.equal(NANO_BANANA_HOW_TO_STEPS[1].title, "Загрузите фото или опишите кадр");
  assert.equal(NANO_BANANA_PRICING.returnPath, "/nano-banana");
  assert.match(
    formatNanoBananaSocialProof(4821) ?? "",
    /^Более 4\s821 человек уже сгенерировали фото в Nano Banana$/
  );
  assert.equal(formatNanoBananaSocialProof(0), null);
});

test("Russia access block states the commercial facts plainly", () => {
  assert.equal(NANO_BANANA_ACCESS_ITEMS.length, 4);
  const accessText = NANO_BANANA_ACCESS_ITEMS.map(
    (item) => `${item.title} ${item.text}`
  ).join("\n");
  assert.match(accessText, /Без VPN/);
  assert.match(accessText, /рублях/);
  assert.match(accessText, /не сайт Google AI Studio/);
});

test("FAQ answers action questions without sending people to Google", () => {
  const allowedHrefs = new Set([
    "#generator",
    "#generation-models-heading",
    "#tarify",
    "/pricing",
  ]);
  const questions = NANO_BANANA_FAQ.map((item) => item.q);
  assert.equal(questions.length, 7);
  assert.ok(questions.includes("Что такое Nano Banana?"));
  assert.ok(questions.includes("Nano Banana — это официальный Google Gemini?"));
  assert.ok(questions.includes("Как пользоваться Nano Banana в России?"));
  assert.ok(
    questions.includes(
      "Сколько стоит Nano Banana и можно ли пользоваться бесплатно?"
    )
  );
  assert.equal(
    questions.some((q) => PROMPT_WORD.test(q)),
    false
  );

  for (const item of NANO_BANANA_FAQ) {
    const plain = flattenGeneraciyaFotoFaqAnswer(item.a);
    assert.doesNotMatch(plain, PROMPT_WORD);
    assert.doesNotMatch(plain, /официальный сайт PromptShot|скачайте приложение/i);
    const hrefs = item.a.filter(isGeneraciyaFotoFaqLink).map((part) => part.href);
    for (const href of hrefs) {
      assert.ok(allowedHrefs.has(href), `${item.q} → ${href}`);
    }
  }

  const official = NANO_BANANA_FAQ.find(
    (item) => item.q === "Nano Banana — это официальный Google Gemini?"
  );
  assert.match(
    flattenGeneraciyaFotoFaqAnswer(official?.a ?? []),
    /не является официальным сайтом Google/
  );
});
