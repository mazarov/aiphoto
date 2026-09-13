import type { TagEntry, Dimension } from "./tag-registry";
import type { SeoContent } from "./seo-content";
import { PROMPT_LISTING_BRAND_SUFFIX } from "./prompt-listing-seo";

const PREP_OBJECT = /^(с\s|со\s|в\s|на\s|под\s|для\s|у\s|к\s|из\s)/i;

/**
 * Шаблонный SeoContent для тега из TAG_REGISTRY (используется скриптом sync-seo-content).
 * Кураторские страницы в seo-content.ts имеют приоритет — сюда попадают только отсутствующие slug.
 */
export function buildSeoContentFromTag(tag: TagEntry): SeoContent {
  const L = tag.labelRu.trim();
  const l = L.toLowerCase();
  const dim = tag.dimension;

  const { h1, metaTitle, metaDescription, intro, topicPhrase } = copyFor(dim, L, l);

  const faqItems = [
    {
      q: `Как создать ${topicPhrase}?`,
      a: `Скопируйте промт или нажмите «Повторить». Загрузите фото или запустите генерацию на сайте.`,
    },
    {
      q: `Какие промты подходят для «${L}»?`,
      a: `На странице собраны проверенные промты для «${L}». Скопируйте текст или повторите кадр со своего фото.`,
    },
    {
      q: "Промты бесплатные?",
      a: "Да. Все промты на сайте можно копировать и использовать бесплатно.",
    },
  ];

  const howToSteps = [
    `Выбери промт для «${L}» и нажми «Скопировать промт».`,
    "Скопируй текст бесплатно или загрузи своё фото.",
    "Нажми «Повторить» и получи новый кадр.",
    "Если кадр не тот — поправь промт и запусти ещё раз.",
  ];

  return { h1, metaTitle, metaDescription, intro, faqItems, howToSteps };
}

function copyFor(dim: Dimension, L: string, l: string) {
  const sufx = ` — готовые на русском${PROMPT_LISTING_BRAND_SUFFIX}`;

  switch (dim) {
    case "style_tag": {
      const h1 = `Промты для фото в стиле ${L}`;
      return {
        h1,
        metaTitle: h1 + sufx,
        metaDescription: `Готовые промты для фото в стиле «${L}» на русском. Скопируй промт бесплатно или повтори кадр со своего фото.`,
        intro: `Промты для создания фото в стиле «${L}» с помощью ИИ. Скопируй бесплатно или загрузи своё фото и повтори кадр в 1 клик.`,
        topicPhrase: `фото в стиле «${L}»`,
      };
    }
    case "occasion_tag": {
      const h1 = `Промты для фото на ${l}`;
      return {
        h1,
        metaTitle: h1 + sufx,
        metaDescription: `Готовые промты для фото на тему «${L}» на русском. Скопируй промт или повтори праздничный кадр со своего фото.`,
        intro: `Промты для создания фото на тему «${L}» с помощью ИИ. Скопируй бесплатно или загрузи своё фото и повтори кадр в 1 клик.`,
        topicPhrase: `фото на тему «${L}»`,
      };
    }
    case "audience_tag": {
      const h1 = `Промты для фото ${l}`;
      return {
        h1,
        metaTitle: h1 + sufx,
        metaDescription: `Готовые промты для фото «${L}» на русском. Скопируй промт бесплатно или повтори кадр со своего фото.`,
        intro: `Промты для создания фото на тему «${L}» с помощью ИИ. Скопируй бесплатно или загрузи своё фото и повтори кадр в 1 клик.`,
        topicPhrase: `фото «${L}»`,
      };
    }
    case "doc_task_tag": {
      const h1 = `Промты для фото: ${L}`;
      const metaTitle = `Промты для фото — ${L}${sufx}`;
      return {
        h1,
        metaTitle,
        metaDescription: `Готовые промты для фото «${L}» на русском. Скопируй промт или подготовь кадр на сайте.`,
        intro: `Промты для фото «${L}» с помощью ИИ. Скопируй бесплатно или загрузи своё фото и повтори кадр в 1 клик.`,
        topicPhrase: `фото «${L}»`,
      };
    }
    default: {
      const h1 = PREP_OBJECT.test(l) ? `Промты для фото ${l}` : `Промты для фото: ${L}`;
      const metaTitle = `Промты для фото ${l}${sufx}`;
      return {
        h1,
        metaTitle,
        metaDescription: `Готовые промты для фото «${L}» на русском. Скопируй промт или повтори кадр со своего фото.`,
        intro: `Промты для создания фото «${L}» с помощью ИИ. Скопируй бесплатно или загрузи своё фото и повтори кадр в 1 клик.`,
        topicPhrase: `фото «${L}»`,
      };
    }
  }
}
