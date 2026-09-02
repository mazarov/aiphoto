import {
  flattenGeneraciyaFotoFaqAnswer,
  type GeneraciyaFotoFaqPart,
} from "./generaciya-foto-seo-copy";

export const NANO_BANANA_PATH = "/nano-banana";
export const NANO_BANANA_DEFAULT_MODEL_ID = "gemini-2.5-flash-image";

/**
 * URL: /nano-banana
 * Тип: генератор
 * Ключевой запрос: «nano banana»
 * Синонимы и хвосты: нано банана, nano banana нейросеть, nano banana ru,
 *   nano banana google, nano banana онлайн, nano banana в россии
 * Сюда не входит: промты для нано банана (/), сделать фото ИИ (/generaciya-foto),
 *   nano banana pro / 2 (будущие дети), nana banana (песня), официальный сайт Google
 */
export const NANO_BANANA_SEO = {
  metaTitle: "Nano Banana — нейросеть Google для фото онлайн",
  metaDescription:
    "Создавайте и редактируйте фото в Nano Banana. Доступ к моделям Google Gemini в России без VPN, оплата в рублях.",
  h1: "Nano Banana",
  intro:
    "Генерация и редактирование фото в моделях Google Gemini — на русском языке, без VPN.",
  breadcrumb: "Nano Banana",
  socialProofPrefix: "Более",
  socialProofSuffix: "человек уже сгенерировали фото в Nano Banana",
  secondaryCta: "Выбрать и повторить",
  starterByTextTitle: "Генерация по тексту",
  starterByTextLead: "Напишите сцену своими словами",
  starterByPhotoTitle: "Генерация по фото",
  starterByPhotoLead: "Загрузите снимок — кадр соберём сами",
  examplesTitle: "Примеры фото Nano Banana",
  examplesIntro:
    "Выберите образ и сгенерируйте фото в Nano Banana — со своего снимка или по тексту.",
  examplesCta: "Больше примеров",
  examplesMoreHref: `${NANO_BANANA_PATH}#primery`,
  howToTitle: "Как пользоваться Nano Banana?",
  howToLead: "Три шага, чтобы сделать фото в Nano Banana онлайн",
  howToCta: "Создать фото",
  faqTitle: "Частые вопросы про Nano Banana",
  modelsEyebrow: "Модели Google",
  modelsTitle: "Модели Nano Banana",
  modelsLead:
    "Сравните скорость, точность и стоимость. Выбранная модель сразу включится в генераторе.",
} as const;

export function formatNanoBananaSocialProof(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) return null;
  const formatted = Math.trunc(count).toLocaleString("ru-RU");
  return `${NANO_BANANA_SEO.socialProofPrefix} ${formatted} ${NANO_BANANA_SEO.socialProofSuffix}`;
}

export const NANO_BANANA_HOW_TO_STEPS = [
  {
    n: "01",
    title: "Откройте генератор",
    text: "Nano Banana уже выбран. Остаётся загрузить снимок или описать кадр.",
  },
  {
    n: "02",
    title: "Загрузите фото или опишите кадр",
    text: "Своё фото даёт портрет с вашим лицом. Текст задаёт сцену, одежду и свет.",
  },
  {
    n: "03",
    title: "Скачайте готовое фото",
    text: "Файл появится в генераторе. Если кадр не тот — поправьте описание и запустите ещё раз.",
  },
] as const;

export const NANO_BANANA_TOOLS = {
  title: "Что можно изменить в Nano Banana",
  lead: "Загрузите снимок и выберите задачу: заменить фон, причёску или деталь, убрать объект либо повысить качество.",
} as const;

export const NANO_BANANA_PRICING = {
  returnPath: NANO_BANANA_PATH,
} as const;

export const NANO_BANANA_ACCESS_ITEMS = [
  {
    title: "Без VPN",
    text: "Генератор открывается в обычном браузере — отдельное приложение не нужно.",
  },
  {
    title: "Интерфейс на русском",
    text: "Названия моделей, настройки и подсказки доступны на русском языке.",
  },
  {
    title: "Оплата в рублях",
    text: "Стоимость видна до запуска, пакеты кредитов оплачиваются в рублях.",
  },
  {
    title: "Прямо на PromptShot",
    text: "Это самостоятельный сервис с доступом к моделям Google Gemini, не сайт Google AI Studio.",
  },
] as const;

export const NANO_BANANA_FAQ: readonly {
  q: string;
  a: readonly GeneraciyaFotoFaqPart[];
}[] = [
  {
    q: "Что такое Nano Banana?",
    a: [
      "Nano Banana — название моделей Google Gemini для генерации и правки фото. На PromptShot это те же модели: Nano Banana, Nano Banana Pro и Nano Banana 2.",
    ],
  },
  {
    q: "Как пользоваться Nano Banana в России?",
    a: [
      "Откройте ",
      { href: "#generator", label: "генератор" },
      " на этой странице, загрузите фото или опишите кадр и запустите создание. Генератор работает без VPN.",
    ],
  },
  {
    q: "Nano Banana — это официальный Google Gemini?",
    a: [
      "Nano Banana — название моделей Google Gemini для изображений. PromptShot даёт к ним доступ, но не является официальным сайтом Google или Google AI Studio.",
    ],
  },
  {
    q: "Чем Nano Banana Pro отличается от Nano Banana?",
    a: [
      "Nano Banana быстрее и дешевле, подходит для черновика. Nano Banana Pro даёт больше деталей на сложных сценах. Стоимость видна рядом с моделью до запуска.",
    ],
  },
  {
    q: "Что такое Nano Banana 2?",
    a: [
      "Следующая линейка той же нейросети. На PromptShot она в блоке ",
      { href: "#generation-models-heading", label: "моделей Nano Banana" },
      " — выберите карточку, и генератор переключится.",
    ],
  },
  {
    q: "Сколько стоит Nano Banana и можно ли пользоваться бесплатно?",
    a: [
      "Генерация на PromptShot оплачивается кредитами. Цена выбранной модели видна до запуска. Пакеты — в блоке ",
      { href: "#tarify", label: "тарифов" },
      " или на ",
      { href: "/pricing", label: "странице оплаты" },
      ".",
    ],
  },
  {
    q: "Нужно ли скачивать Nano Banana?",
    a: [
      "Нет. Отдельного приложения нет: генератор открывается в браузере на этой странице.",
    ],
  },
];

export { flattenGeneraciyaFotoFaqAnswer };
