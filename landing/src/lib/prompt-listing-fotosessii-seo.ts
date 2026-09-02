import type { TagEntry, Dimension } from "./tag-registry";
import { DIMENSION_PRIORITY } from "./tag-registry";
import type { SeoContent } from "./seo-content";

export const PROMPT_LISTING_BRAND_SUFFIX = " | PromptShot";
export const PROMPT_LISTING_DESCRIPTION_CTA =
  "Бесплатно. Скопируй текст или создай кадр в ChatGPT, Gemini, Nano Banana.";

type DimensionPair = `${Dimension}+${Dimension}`;

/** Curated L1 H1 bases — genitive / natural RU, not raw labelRu. */
const L1_BASE_H1_BY_SLUG: Record<string, string> = {
  devushka: "Промты для фото девушки",
  muzhchina: "Промты для фото мужчины",
  para: "Промты для фото пар",
  semya: "Промты для семейного фото",
  detskie: "Промты для детских фото",
  den_rozhdeniya: "Промты для фото на день рождения",
  studiynoe: "Промты для студийного фото",
  zima: "Промты для зимнего фото",
  novyy_god: "Промты для новогоднего фото",
  v_forme: "Промты для фото в форме",
  beremennaya: "Промты для фото беременной",
  vesna: "Промты для весеннего фото",
  svadba: "Промты для свадебного фото",
  delovoe: "Промты для делового фото",
  cherno_beloe: "Промты для чёрно-белого фото",
  portret: "Промты для портретного фото",
  s_mashinoy: "Промты для фото с машиной",
};

/** Exact «промты для ИИ фотосессии …» tails for Description / H2. */
const FOTOSESSII_TAIL_BY_SLUG: Record<string, string> = {
  devushka: "женские",
  muzhchina: "мужские",
  para: "парные",
  semya: "семейные",
  detskie: "детские",
  beremennaya: "для беременных",
  den_rozhdeniya: "на день рождения",
  novyy_god: "новогодние",
  zima: "зимние",
  vesna: "весенние",
  studiynoe: "студийные",
  v_forme: "в форме",
  cherno_beloe: "чёрно-белые",
  delovoe: "деловые",
  portret: "портретные",
  s_mashinoy: "с машиной",
  realistichnoe: "реалистичные",
  multyashnoe: "мультяшные",
  s_cvetami: "с цветами",
  s_tortom: "с тортом",
};

const PAIR_BASE_H1: Partial<Record<DimensionPair, (a: string, b: string) => string>> = {
  "audience_tag+style_tag": (a, b) => `Промты для фото ${a} — ${b}`,
  "audience_tag+occasion_tag": (a, b) => `Промты для фото ${a} на ${b}`,
  "audience_tag+object_tag": (a, b) => `Промты для фото ${a} ${b}`,
  "audience_tag+doc_task_tag": (a, b) => `Промты для фото ${a} ${b}`,
  "style_tag+occasion_tag": (a, b) => `${cap(a)} фото на ${b}`,
  "style_tag+object_tag": (a, b) => `${cap(a)} фото ${b}`,
  "style_tag+doc_task_tag": (a, b) => `${cap(a)} фото ${b}`,
  "occasion_tag+object_tag": (a, b) => `Промты для фото на ${a} ${b}`,
  "occasion_tag+doc_task_tag": (a, b) => `Промты для фото на ${a} ${b}`,
  "object_tag+doc_task_tag": (a, b) => `Промты для фото ${a} ${b}`,
};

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function labelLower(tag: TagEntry): string {
  return tag.labelRu.toLowerCase();
}

function sortTags(tags: TagEntry[]): TagEntry[] {
  return [...tags].sort(
    (a, b) =>
      DIMENSION_PRIORITY.indexOf(a.dimension) -
      DIMENSION_PRIORITY.indexOf(b.dimension),
  );
}

function makePairKey(d1: Dimension, d2: Dimension): DimensionPair {
  return `${d1}+${d2}`;
}

function defaultTail(tag: TagEntry): string {
  return labelLower(tag);
}

export function promptListingFotosessiiTail(tags: TagEntry[]): string {
  return sortTags(tags)
    .map((tag) => FOTOSESSII_TAIL_BY_SLUG[tag.slug] ?? defaultTail(tag))
    .join(" ");
}

export function promptListingBaseH1(tags: TagEntry[]): string {
  const sorted = sortTags(tags);

  if (sorted.length === 1) {
    const tag = sorted[0]!;
    const curated = L1_BASE_H1_BY_SLUG[tag.slug];
    if (curated) return curated;

    const l = labelLower(tag);
    switch (tag.dimension) {
      case "style_tag":
        return `Промты для фото в стиле ${tag.labelRu}`;
      case "occasion_tag":
        return `Промты для фото на ${l}`;
      case "audience_tag":
        return `Промты для фото ${l}`;
      case "doc_task_tag":
        return `Промты для фото: ${tag.labelRu}`;
      default:
        return /^с\s|^со\s|^в\s|^на\s/.test(l)
          ? `Промты для фото ${l}`
          : `Промты для фото: ${tag.labelRu}`;
    }
  }

  if (sorted.length === 2) {
    const [t1, t2] = sorted;
    const key = makePairKey(t1!.dimension, t2!.dimension);
    const fn = PAIR_BASE_H1[key];
    if (fn) return fn(labelLower(t1!), labelLower(t2!));
    return `Промты для фото: ${labelLower(t1!)}, ${labelLower(t2!)}`;
  }

  const desc = sorted.map((t) => labelLower(t)).join(" + ");
  return `Промты для фото: ${desc}`;
}

export function buildPromptListingHeadline(tags: TagEntry[]): string {
  return promptListingBaseH1(tags);
}

export function buildPromptListingMetaTitle(tags: TagEntry[]): string {
  return `${buildPromptListingHeadline(tags)}${PROMPT_LISTING_BRAND_SUFFIX}`;
}

export function buildPromptListingMetaDescription(tags: TagEntry[]): string {
  const base = promptListingBaseH1(tags);
  const baseLower = base.charAt(0).toLowerCase() + base.slice(1);
  return `Готовые ${baseLower} на русском. ${PROMPT_LISTING_DESCRIPTION_CTA}`;
}

function comboPhrase(tags: TagEntry[]): string {
  return sortTags(tags)
    .map((t) => labelLower(t))
    .join(" + ");
}

function buildIntro(tags: TagEntry[]): string {
  const base = promptListingBaseH1(tags);
  const tail = promptListingFotosessiiTail(tags);
  const phrase = comboPhrase(tags);
  return (
    `Готовые ${base.charAt(0).toLowerCase() + base.slice(1)} на русском — бесплатно. ` +
    `Промты для ИИ фотосессии ${tail} — в ленте на этой странице: «${phrase}». ` +
    `Скопируй текст с карточки или повтори кадр со своим фото в ChatGPT, Gemini и Nano Banana. ` +
    `Серию в одном стиле собирайте в ИИ фотосессии.`
  );
}

function buildFaq(tags: TagEntry[]): { q: string; a: string }[] {
  const phrase = comboPhrase(tags);
  const tail = promptListingFotosessiiTail(tags);
  return [
    {
      q: `Есть готовые промты для ИИ фотосессии ${tail} на русском?`,
      a: `Да. Промты для ИИ фотосессии ${tail} — в ленте на этой странице («${phrase}»). Скопируйте текст с карточки. Серию кадров со своим фото собирайте в ИИ фотосессии.`,
    },
    {
      q: `Как создать фото «${phrase}» в нейросети?`,
      a: "Скопируйте промт с этой страницы, откройте генератор на PromptShot или вставьте текст в ChatGPT, Gemini, Nano Banana. Загрузите своё фото — ИИ соберёт кадр за секунды.",
    },
    {
      q: "Промты бесплатные?",
      a: "Да. Все промты на сайте можно копировать и использовать бесплатно в любых ИИ-генераторах.",
    },
  ];
}

const DEFAULT_HOW_TO = [
  "Выбери карточку с подходящим промтом и нажми «Скопировать промт».",
  "Открой генератор на PromptShot или вставь текст в ChatGPT, Gemini, Nano Banana.",
  "Загрузи своё фото, если нужен кадр с тобой.",
  "Получи результат — серию в одном стиле собери в ИИ фотосессии.",
];

export function buildPromptListingSeoContent(tags: TagEntry[]): SeoContent {
  return {
    h1: buildPromptListingHeadline(tags),
    metaTitle: buildPromptListingMetaTitle(tags),
    metaDescription: buildPromptListingMetaDescription(tags),
    intro: buildIntro(tags),
    faqItems: buildFaq(tags),
    howToSteps: DEFAULT_HOW_TO,
    seoTextBlocks: [
      {
        h2: `Промты для ИИ фотосессии ${promptListingFotosessiiTail(tags)}`,
        paragraphs: [
          `Готовые промты для ИИ фотосессии ${promptListingFotosessiiTail(tags)} на русском — в ленте на этой странице. Открой карточку, скопируй текст или повтори кадр со своим фото. Серию в одном стиле собирайте в ИИ фотосессии.`,
        ],
      },
    ],
  };
}

/** Manual pages with their own long-tail H1 (birthday L2 etc.) — do not rewrite. */
export function isManualPromptLongTailHead(h1: string): boolean {
  return /^Промт(ы)? на /.test(h1);
}

export function enrichPromptListingHead(
  seo: SeoContent,
  tags: TagEntry[],
): SeoContent {
  if (isManualPromptLongTailHead(seo.h1) || !tags.length) {
    return seo;
  }

  const tail = promptListingFotosessiiTail(tags);
  const introHasTail = /промты для ИИ фотосессии/i.test(seo.intro ?? "");

  return {
    ...seo,
    intro: introHasTail
      ? seo.intro
      : `${seo.intro ?? ""} Промты для ИИ фотосессии ${tail} — в ленте на этой странице.`.trim(),
    seoTextBlocks: seo.seoTextBlocks?.length
      ? seo.seoTextBlocks
      : [
          {
            h2: `Промты для ИИ фотосессии ${tail}`,
            paragraphs: [
              `Готовые промты для ИИ фотосессии ${tail} на русском — в ленте на этой странице. Открой карточку, скопируй текст или повтори кадр со своим фото. Серию в одном стиле собирайте в ИИ фотосессии.`,
            ],
          },
        ],
  };
}
