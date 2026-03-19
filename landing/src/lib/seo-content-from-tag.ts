import type { TagEntry, Dimension } from "./tag-registry";
import type { SeoContent } from "./seo-content";

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
      q: `Как создать ${topicPhrase} в Nano Banana?`,
      a: `Скопируйте промт, откройте Nano Banana (нано банана) и вставьте текст. Загрузите фото или запустите генерацию — ИИ создаст результат за секунды.`,
    },
    {
      q: `Какие промты подходят для «${L}»?`,
      a: `На странице собраны проверенные промты для «${L}». Их можно использовать в Nano Banana, Midjourney, Kandinsky и других ИИ-генераторах изображений.`,
    },
    {
      q: "Промты бесплатные?",
      a: "Да. Все промты на сайте можно копировать и использовать бесплатно в любых ИИ-генераторах.",
    },
  ];

  const howToSteps = [
    `Выбери промт для «${L}» и нажми «Скопировать промт».`,
    "Открой Nano Banana (нано банана), Kandinsky или другой ИИ-генератор.",
    "Вставь текст и при необходимости загрузи своё фото.",
    "Получи результат и при необходимости скорректируй промт под детали кадра.",
  ];

  return { h1, metaTitle, metaDescription, intro, faqItems, howToSteps };
}

function copyFor(dim: Dimension, L: string, l: string) {
  const sufx = " — Nano Banana, ИИ-генератор | Бесплатно 2026";

  switch (dim) {
    case "style_tag": {
      const h1 = `Промты для фото в стиле ${L}`;
      return {
        h1,
        metaTitle: h1 + sufx,
        metaDescription: `Готовые промты для фото в стиле «${L}» в Nano Banana и ИИ-нейросетях. Скопируй промт бесплатно и создай изображение за секунды.`,
        intro: `Промты для создания фото в стиле «${L}» с помощью ИИ. Промпты проверены в Nano Banana (нано банана) и других нейросетях. Скопируй бесплатно и получи результат за секунды.`,
        topicPhrase: `фото в стиле «${L}»`,
      };
    }
    case "occasion_tag": {
      const h1 = `Промты для фото на ${l}`;
      return {
        h1,
        metaTitle: h1 + sufx,
        metaDescription: `Готовые промты для фото на тему «${L}» в Nano Banana и ИИ-нейросетях. Скопируй промт и создай праздничный или тематический кадр.`,
        intro: `Промты для создания фото на тему «${L}» с помощью ИИ. Промпты проверены в Nano Banana (нано банана) и других нейросетях. Скопируй бесплатно и получи кадр за секунды.`,
        topicPhrase: `фото на тему «${L}»`,
      };
    }
    case "audience_tag": {
      const h1 = `Промты для фото ${l}`;
      return {
        h1,
        metaTitle: h1 + sufx,
        metaDescription: `Готовые промты для фото «${L}» в Nano Banana и ИИ-нейросетях. Скопируй промт бесплатно и создай портрет или сцену за секунды.`,
        intro: `Промты для создания фото на тему «${L}» с помощью ИИ. Промпты проверены в Nano Banana (нано банана) и других нейросетях. Скопируй бесплатно и получи результат за секунды.`,
        topicPhrase: `фото «${L}»`,
      };
    }
    case "doc_task_tag": {
      const h1 = `Промты для фото: ${L}`;
      const metaTitle = `Промты для фото — ${L}${sufx}`;
      return {
        h1,
        metaTitle,
        metaDescription: `Готовые промты для фото «${L}» в Nano Banana и ИИ-нейросетях. Скопируй промт и подготовь кадр для документов или задачи.`,
        intro: `Промты для фото «${L}» с помощью ИИ. Промпты проверены в Nano Banana (нано банана) и других нейросетях. Скопируй бесплатно и получи результат за секунды.`,
        topicPhrase: `фото «${L}»`,
      };
    }
    default: {
      const h1 = PREP_OBJECT.test(l) ? `Промты для фото ${l}` : `Промты для фото: ${L}`;
      const metaTitle = `Промты для фото ${l}${sufx}`;
      return {
        h1,
        metaTitle,
        metaDescription: `Готовые промты для фото «${L}» в Nano Banana и ИИ-нейросетях. Скопируй промт и создай изображение за секунды.`,
        intro: `Промты для создания фото «${L}» с помощью ИИ. Промпты проверены в Nano Banana (нано банана) и других нейросетях. Скопируй бесплатно и получи результат за секунды.`,
        topicPhrase: `фото «${L}»`,
      };
    }
  }
}
