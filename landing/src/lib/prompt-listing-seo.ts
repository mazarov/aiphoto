import type { TagEntry, Dimension } from "./tag-registry";
import { DIMENSION_PRIORITY } from "./tag-registry";
import type { SeoContent } from "./seo-content";

export const PROMPT_LISTING_BRAND_SUFFIX = " | PromptShot";
export const PROMPT_LISTING_DESCRIPTION_CTA =
  "Скопируй промт бесплатно или загрузи своё фото и повтори кадр в 1 клик.";

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
  otkrytka: "Промты для открытки из фото",
  sovetskoe: "Промты для фото в советском стиле",
};

const PAIR_BASE_H1: Partial<
  Record<DimensionPair, (a: string, b: string) => string>
> = {
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

function cap(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
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

export function promptListingBaseH1(tags: TagEntry[]): string {
  const sorted = sortTags(tags);

  if (sorted.length === 1) {
    const tag = sorted[0]!;
    const curated = L1_BASE_H1_BY_SLUG[tag.slug];
    if (curated) return curated;

    const label = labelLower(tag);
    switch (tag.dimension) {
      case "style_tag":
        return `Промты для фото в стиле ${tag.labelRu}`;
      case "occasion_tag":
        return `Промты для фото на ${label}`;
      case "audience_tag":
        return `Промты для фото ${label}`;
      case "doc_task_tag":
        return `Промты для фото: ${tag.labelRu}`;
      default:
        return /^с\s|^со\s|^в\s|^на\s/.test(label)
          ? `Промты для фото ${label}`
          : `Промты для фото: ${tag.labelRu}`;
    }
  }

  if (sorted.length === 2) {
    const [first, second] = sorted;
    const key = makePairKey(first!.dimension, second!.dimension);
    const build = PAIR_BASE_H1[key];
    if (build) return build(labelLower(first!), labelLower(second!));
    return `Промты для фото: ${labelLower(first!)}, ${labelLower(second!)}`;
  }

  return `Промты для фото: ${sorted.map(labelLower).join(" + ")}`;
}

export function buildPromptListingHeadline(tags: TagEntry[]): string {
  return promptListingBaseH1(tags);
}

export function buildPromptListingMetaTitle(tags: TagEntry[]): string {
  return `${buildPromptListingHeadline(tags)} — готовые на русском${PROMPT_LISTING_BRAND_SUFFIX}`;
}

export function buildPromptListingMetaDescription(tags: TagEntry[]): string {
  const base = promptListingBaseH1(tags);
  const baseLower = base.charAt(0).toLowerCase() + base.slice(1);
  return `Готовые ${baseLower} на русском. ${PROMPT_LISTING_DESCRIPTION_CTA}`;
}

function comboPhrase(tags: TagEntry[]): string {
  return sortTags(tags).map(labelLower).join(" + ");
}

function buildIntro(tags: TagEntry[]): string {
  const base = promptListingBaseH1(tags);
  const baseLower = base.charAt(0).toLowerCase() + base.slice(1);
  return `Готовые ${baseLower} на русском. Выбери карточку, скопируй промт бесплатно или загрузи своё фото и повтори кадр в 1 клик.`;
}

function buildFaq(tags: TagEntry[]): { q: string; a: string }[] {
  const phrase = comboPhrase(tags);
  return [
    {
      q: `Как использовать промт «${phrase}» со своим фото?`,
      a: "Открой карточку, загрузи своё фото и нажми «Повторить». PromptShot создаст новый кадр по выбранному промту.",
    },
    {
      q: "Можно ли только скопировать промт?",
      a: "Да. Нажми «Скопировать промт» на карточке — копирование текста бесплатное.",
    },
    {
      q: "Сколько стоит повторить кадр?",
      a: "Генерация списывает кредиты. Точная стоимость видна перед запуском.",
    },
  ];
}

const DEFAULT_HOW_TO = [
  "Выбери карточку с подходящим промтом.",
  "Скопируй текст бесплатно или загрузи своё фото.",
  "Нажми «Повторить» и получи новый кадр.",
];

export function buildPromptListingSeoContent(tags: TagEntry[]): SeoContent {
  return {
    h1: buildPromptListingHeadline(tags),
    metaTitle: buildPromptListingMetaTitle(tags),
    metaDescription: buildPromptListingMetaDescription(tags),
    intro: buildIntro(tags),
    faqItems: buildFaq(tags),
    howToSteps: DEFAULT_HOW_TO,
  };
}
