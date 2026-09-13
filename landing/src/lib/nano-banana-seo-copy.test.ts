import assert from "node:assert/strict";
import test from "node:test";
import {
  flattenGeneraciyaFotoFaqAnswer,
  isGeneraciyaFotoFaqLink,
} from "./generaciya-foto-seo-copy";
import {
  formatNanoBananaSocialProof,
  hrefForNanoBananaModel,
  isNanoBananaSeoPath,
  NANO_BANANA_ACCESS_ITEMS,
  NANO_BANANA_FAQ,
  NANO_BANANA_FEATURES,
  NANO_BANANA_HOW_TO_STEPS,
  NANO_BANANA_PATH,
  NANO_BANANA_PRICING,
  NANO_BANANA_PRO_ACCESS_ITEMS,
  NANO_BANANA_PRO_DEFAULT_MODEL_ID,
  NANO_BANANA_PRO_FAQ,
  NANO_BANANA_PRO_FEATURES,
  NANO_BANANA_PRO_HOW_TO_STEPS,
  NANO_BANANA_PRO_PATH,
  NANO_BANANA_PRO_PRICING,
  NANO_BANANA_PRO_SEO,
  NANO_BANANA_PRO_TOOLS,
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
    NANO_BANANA_FEATURES.title,
    NANO_BANANA_FEATURES.lead,
    ...NANO_BANANA_FEATURES.items.map((item) => `${item.title} ${item.text}`),
    ...NANO_BANANA_ACCESS_ITEMS.map((item) => `${item.title} ${item.text}`),
    ...NANO_BANANA_HOW_TO_STEPS.map((step) => `${step.title} ${step.text}`),
    ...NANO_BANANA_FAQ.map(
      (item) => `${item.q} ${flattenGeneraciyaFotoFaqAnswer(item.a)}`
    ),
  ].join("\n");
}

function proPagePlainText(): string {
  return [
    NANO_BANANA_PRO_SEO.metaTitle,
    NANO_BANANA_PRO_SEO.metaDescription,
    NANO_BANANA_PRO_SEO.h1,
    NANO_BANANA_PRO_SEO.intro,
    NANO_BANANA_PRO_SEO.howToTitle,
    NANO_BANANA_PRO_SEO.howToLead,
    NANO_BANANA_PRO_SEO.examplesTitle,
    NANO_BANANA_PRO_SEO.examplesIntro,
    NANO_BANANA_PRO_TOOLS.title,
    NANO_BANANA_PRO_TOOLS.lead,
    NANO_BANANA_PRO_FEATURES.title,
    NANO_BANANA_PRO_FEATURES.lead,
    ...NANO_BANANA_PRO_FEATURES.items.map((item) => `${item.title} ${item.text}`),
    ...NANO_BANANA_PRO_ACCESS_ITEMS.map((item) => `${item.title} ${item.text}`),
    ...NANO_BANANA_PRO_HOW_TO_STEPS.map((step) => `${step.title} ${step.text}`),
    ...NANO_BANANA_PRO_FAQ.map(
      (item) => `${item.q} ${flattenGeneraciyaFotoFaqAnswer(item.a)}`
    ),
  ].join("\n");
}

test("hub keeps one key and CWS-safe snippet", () => {
  assert.equal(NANO_BANANA_PATH, "/nano-banana");
  assert.equal(NANO_BANANA_SEO.h1, "Промты для нано банана");
  assert.equal(
    NANO_BANANA_SEO.metaTitle,
    "Промты для нано банана — готовые на русском"
  );
  assert.ok(NANO_BANANA_SEO.metaTitle.length <= 70);
  assert.match(NANO_BANANA_SEO.metaTitle, /^Промты для нано банана/);
  assert.doesNotMatch(NANO_BANANA_SEO.metaTitle, /Pro|сделать фото ИИ/i);
  assert.equal(
    NANO_BANANA_SEO.metaDescription,
    "Готовые промты для нано банана (Nano Banana) на русском. Скопируй текст или загрузи фото и собери кадр здесь — без VPN."
  );
  assert.ok(NANO_BANANA_SEO.metaDescription.length <= 160);
  assert.ok(NANO_BANANA_SEO.metaDescription.length >= 80);
  assert.doesNotMatch(NANO_BANANA_SEO.metaTitle, BANNED_META);
  assert.doesNotMatch(NANO_BANANA_SEO.metaDescription, BANNED_META);
  assert.match(NANO_BANANA_SEO.intro, /без VPN/);
  assert.match(NANO_BANANA_SEO.intro, /Nano Banana/);
});

// Кириллическая ветка кластера — половина спроса (~78k clicks) и до этой
// правки не встречалась в тексте ни разу. Латиница остаётся основной формой.
test("cyrillic branch of the cluster is covered", () => {
  const CYRILLIC = /нано банана/i;
  assert.match(NANO_BANANA_SEO.metaTitle, CYRILLIC);
  assert.match(NANO_BANANA_SEO.metaDescription, CYRILLIC);
  assert.match(NANO_BANANA_SEO.h1, CYRILLIC);
  assert.match(NANO_BANANA_SEO.intro, CYRILLIC);

  assert.match(
    NANO_BANANA_ACCESS_ITEMS.map((item) => item.text).join("\n"),
    /\(ru\)/i
  );

  assert.match(NANO_BANANA_SEO.h1, /^Промты для нано банана/);
  assert.match(NANO_BANANA_SEO.metaTitle, /^Промты для нано банана/);
});

test("hub owns prompt-for-nano-banana and does not send people away", () => {
  assert.match(NANO_BANANA_SEO.h1, /промты для нано банана/i);
  assert.match(NANO_BANANA_SEO.metaTitle, /промты для нано банана/i);
  assert.match(NANO_BANANA_SEO.metaDescription, /промты для нано банана/i);
  assert.match(NANO_BANANA_SEO.intro, PROMPT_WORD);
  assert.doesNotMatch(pagePlainText(), SEND_AWAY);
  assert.equal(NANO_BANANA_HOW_TO_STEPS.length, 3);
  assert.equal(NANO_BANANA_HOW_TO_STEPS[1].title, "Опишите сцену или правку");
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
    NANO_BANANA_PRO_PATH,
  ]);
  const questions = NANO_BANANA_FAQ.map((item) => item.q);
  assert.equal(questions.length, 10);
  assert.ok(
    questions.includes("Можно ли в Nano Banana править фото своими словами?")
  );
  assert.ok(questions.includes("Что такое Nano Banana?"));
  assert.ok(questions.includes("Nano Banana — это официальный Google Gemini?"));
  assert.ok(questions.includes("Как пользоваться Nano Banana в России?"));
  assert.ok(
    questions.includes(
      "Сколько стоит Nano Banana и можно ли пользоваться бесплатно?"
    )
  );
  // Кириллические написания и ветка «официальный сайт» (~10.7k clicks).
  assert.ok(
    questions.includes("Нано банана и Nano Banana — это одно и то же?")
  );
  assert.ok(
    questions.includes("Есть ли официальный сайт нано банана на русском?")
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

  const proDiff = NANO_BANANA_FAQ.find(
    (item) => item.q === "Чем Nano Banana Pro отличается от Nano Banana?"
  );
  assert.ok(
    (proDiff?.a ?? [])
      .filter(isGeneraciyaFotoFaqLink)
      .some((part) => part.href === NANO_BANANA_PRO_PATH)
  );
});

test("pro landing owns nano banana pro and cyrillic нано банана про", () => {
  const CYRILLIC = /нано банана про/i;
  assert.equal(NANO_BANANA_PRO_PATH, "/nano-banana/pro");
  assert.equal(NANO_BANANA_PRO_DEFAULT_MODEL_ID, "gemini-3-pro-image-preview");
  assert.equal(NANO_BANANA_PRO_PRICING.returnPath, "/nano-banana/pro");
  assert.equal(
    NANO_BANANA_PRO_SEO.metaTitle,
    "Nano Banana Pro (нано банана про) — нейросеть Google для фото"
  );
  assert.equal(NANO_BANANA_PRO_SEO.h1, "Nano Banana Pro (нано банана про)");
  assert.equal(
    NANO_BANANA_PRO_SEO.metaDescription,
    "Nano Banana Pro (нано банана про) — модель Google для сложных сцен: свет, детали, текст на кадре. В России без VPN, оплата в рублях."
  );
  assert.ok(NANO_BANANA_PRO_SEO.metaTitle.length <= 70);
  assert.ok(NANO_BANANA_PRO_SEO.metaDescription.length <= 132);
  assert.ok(NANO_BANANA_PRO_SEO.metaDescription.length >= 80);
  assert.match(NANO_BANANA_PRO_SEO.metaTitle, /^Nano Banana Pro/);
  assert.match(NANO_BANANA_PRO_SEO.h1, /^Nano Banana Pro/);
  assert.match(NANO_BANANA_PRO_SEO.metaTitle, CYRILLIC);
  assert.match(NANO_BANANA_PRO_SEO.metaDescription, CYRILLIC);
  assert.match(NANO_BANANA_PRO_SEO.h1, CYRILLIC);
  assert.match(NANO_BANANA_PRO_SEO.intro, CYRILLIC);
  assert.doesNotMatch(NANO_BANANA_PRO_SEO.metaTitle, BANNED_META);
  assert.doesNotMatch(NANO_BANANA_PRO_SEO.metaDescription, BANNED_META);
  assert.doesNotMatch(proPagePlainText(), PROMPT_WORD);
  assert.doesNotMatch(proPagePlainText(), SEND_AWAY);
  assert.match(
    formatNanoBananaSocialProof(4821, NANO_BANANA_PRO_SEO) ?? "",
    /^Более 4\s821 человек уже сгенерировали фото в Nano Banana Pro$/
  );
});

test("pro FAQ stays on-page and links the hub, not a /2 URL", () => {
  const allowedHrefs = new Set([
    "#generator",
    "#tarify",
    "/pricing",
    NANO_BANANA_PATH,
  ]);
  const questions = NANO_BANANA_PRO_FAQ.map((item) => item.q);
  assert.ok(questions.includes("Что такое Nano Banana Pro?"));
  assert.ok(
    questions.includes("Нано банана про и Nano Banana Pro — это одно и то же?")
  );
  assert.ok(
    questions.includes("Чем Nano Banana Pro отличается от Nano Banana?")
  );
  assert.ok(questions.includes("Когда выбирать Nano Banana Pro?"));
  assert.ok(questions.includes("Пишет ли Nano Banana Pro текст на картинке?"));
  assert.equal(
    questions.some((q) => /nano banana 2|нано банана 2/i.test(q)),
    false
  );

  for (const item of NANO_BANANA_PRO_FAQ) {
    const plain = flattenGeneraciyaFotoFaqAnswer(item.a);
    assert.doesNotMatch(plain, PROMPT_WORD);
    const hrefs = item.a.filter(isGeneraciyaFotoFaqLink).map((part) => part.href);
    for (const href of hrefs) {
      assert.ok(allowedHrefs.has(href), `${item.q} → ${href}`);
    }
  }

  const vsHub = NANO_BANANA_PRO_FAQ.find(
    (item) => item.q === "Чем Nano Banana Pro отличается от Nano Banana?"
  );
  assert.ok(
    (vsHub?.a ?? [])
      .filter(isGeneraciyaFotoFaqLink)
      .some((part) => part.href === NANO_BANANA_PATH)
  );
});

test("hub and pro pages split capabilities instead of repeating the same body", () => {
  assert.equal(NANO_BANANA_FEATURES.title, "Что умеет Nano Banana");
  assert.equal(NANO_BANANA_PRO_FEATURES.title, "Когда нужна Nano Banana Pro");
  assert.match(NANO_BANANA_SEO.intro, /промты Nano Banana/i);
  assert.doesNotMatch(NANO_BANANA_SEO.metaDescription, /фотореализм|текст на кадр/i);
  assert.match(NANO_BANANA_PRO_SEO.intro, /фотореализм|свет/i);
  assert.doesNotMatch(NANO_BANANA_PRO_SEO.intro, /нейронка/i);
  assert.match(NANO_BANANA_FEATURES.lead, /правка/i);
  assert.match(NANO_BANANA_PRO_FEATURES.lead, /свет|текст/i);
  assert.match(pagePlainText(), /точечн|своими словами/i);
  assert.match(proPagePlainText(), /фотореализм|текст на кадр/i);
});

test("hrefForNanoBananaModel sends Pro to /pro and the rest to the hub", () => {
  assert.equal(
    hrefForNanoBananaModel("gemini-3-pro-image-preview"),
    "/nano-banana/pro"
  );
  assert.equal(
    hrefForNanoBananaModel("gemini-2.5-flash-image"),
    "/nano-banana"
  );
  assert.equal(
    hrefForNanoBananaModel("gemini-3.1-flash-image-preview"),
    "/nano-banana"
  );
  assert.equal(hrefForNanoBananaModel("grok-imagine-image-2.0"), null);
  assert.equal(isNanoBananaSeoPath("/nano-banana"), true);
  assert.equal(isNanoBananaSeoPath("/nano-banana/pro"), true);
  assert.equal(isNanoBananaSeoPath("/nano-banana/pro/"), true);
  assert.equal(isNanoBananaSeoPath("/nano-banana/2"), false);
  assert.equal(isNanoBananaSeoPath("/nano-banana/foo"), false);
});
