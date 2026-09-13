import {
  flattenGeneraciyaFotoFaqAnswer,
  type GeneraciyaFotoFaqPart,
} from "./generaciya-foto-seo-copy";
import {
  displayLabelForGenerationModel,
  isNanoBananaFamilyModel,
} from "./generation-model-labels";

export const NANO_BANANA_PATH = "/nano-banana";
export const NANO_BANANA_PRO_PATH = "/nano-banana/pro";
export const NANO_BANANA_DEFAULT_MODEL_ID = "gemini-2.5-flash-image";
export const NANO_BANANA_PRO_DEFAULT_MODEL_ID = "gemini-3-pro-image-preview";

export const NANO_BANANA_SEO_PATHS = [
  NANO_BANANA_PATH,
  NANO_BANANA_PRO_PATH,
] as const;

export function isNanoBananaSeoPath(pathname: string): boolean {
  const normalized =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  return (NANO_BANANA_SEO_PATHS as readonly string[]).includes(normalized);
}

const NANO_BANANA_PRO_MODEL_IDS = new Set(["gemini-3-pro-image-preview"]);

export function isNanoBananaProModel(
  id: string,
  fallbackLabel?: string
): boolean {
  if (NANO_BANANA_PRO_MODEL_IDS.has(id)) return true;
  return /nano banana\s*pro/i.test(
    displayLabelForGenerationModel(id, fallbackLabel)
  );
}

/** Landing for a Nano Banana family model. «2» stays on the hub until /nano-banana/2 exists. */
export function hrefForNanoBananaModel(
  id: string,
  fallbackLabel?: string
): string | null {
  if (!isNanoBananaFamilyModel(id, fallbackLabel)) return null;
  if (isNanoBananaProModel(id, fallbackLabel)) return NANO_BANANA_PRO_PATH;
  return NANO_BANANA_PATH;
}

/**
 * URL: /nano-banana
 * Тип: генератор + каталог промтов семейства
 * Ключевой запрос: «промты для нано банана»
 * Синонимы: nano banana, нано банана, нейронка, ru / без VPN.
 * Не берёт: сделать фото ИИ (/generaciya-foto), nano banana pro (/nano-banana/pro),
 *   nano banana 2 как отдельный URL, nana banana (песня).
 *   Себя как «официальный сайт Google» не позиционируем.
 */
export const NANO_BANANA_SEO = {
  metaTitle: "Промты для нано банана — готовые на русском",
  metaDescription:
    "Готовые промты для нано банана (Nano Banana) на русском. Скопируй текст или загрузи фото и собери кадр здесь — без VPN.",
  h1: "Промты для нано банана",
  intro:
    "Готовые промты Nano Banana (нано банана) на русском: скопируй текст или загрузи своё фото и запусти кадр здесь — без VPN.",
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
    "Возьмите образ и повторите кадр: новым описанием или точечной правкой своего снимка.",
  examplesCta: "Больше примеров",
  examplesMoreHref: `${NANO_BANANA_PATH}#primery`,
  howToTitle: "Как пользоваться Nano Banana?",
  howToLead: "Три шага, чтобы сделать фото в Nano Banana онлайн",
  howToCta: "Создать фото",
  faqTitle: "Частые вопросы про Nano Banana",
  modelsEyebrow: "Модели Google",
  modelsTitle: "Модели Nano Banana",
  modelsLead:
    "Обычная Nano Banana — быстрый черновик. Pro — свет и детали. Выбранная модель сразу включится в генераторе.",
} as const;

/**
 * URL: /nano-banana/pro
 * Тип: генератор модели
 * Ключевой запрос: «nano banana pro» + «нано банана про»
 * Не берёт: head без «pro», промты, nano banana 2.
 */
export const NANO_BANANA_PRO_SEO = {
  metaTitle: "Nano Banana Pro (нано банана про) — нейросеть Google для фото",
  metaDescription:
    "Nano Banana Pro (нано банана про) — модель Google для сложных сцен: свет, детали, текст на кадре. В России без VPN, оплата в рублях.",
  h1: "Nano Banana Pro (нано банана про)",
  intro:
    "Nano Banana Pro (нано банана про) — для кадров, где важны свет, фотореализм и мелкие детали. Генерация и правка на русском, без VPN.",
  breadcrumb: "Pro",
  socialProofPrefix: "Более",
  socialProofSuffix: "человек уже сгенерировали фото в Nano Banana Pro",
  secondaryCta: "Выбрать и повторить",
  starterByTextTitle: "Генерация по тексту",
  starterByTextLead: "Напишите сцену своими словами",
  starterByPhotoTitle: "Генерация по фото",
  starterByPhotoLead: "Загрузите снимок — кадр соберём сами",
  examplesTitle: "Примеры фото Nano Banana Pro",
  examplesIntro:
    "Выберите сложный образ — свет, фактуры, текст на кадре — и соберите его в Nano Banana Pro.",
  examplesCta: "Больше примеров",
  examplesMoreHref: `${NANO_BANANA_PRO_PATH}#primery`,
  howToTitle: "Как пользоваться Nano Banana Pro?",
  howToLead: "Три шага, чтобы сделать фото в Nano Banana Pro онлайн",
  howToCta: "Создать фото",
  faqTitle: "Частые вопросы про Nano Banana Pro",
  modelsEyebrow: "Модели Google",
  modelsTitle: "Модели Nano Banana",
  modelsLead:
    "На этой странице уже выбрана Nano Banana Pro. Обычная модель — для черновика, Pro — для финального кадра.",
} as const;

export type NanoBananaSeoCopy =
  | typeof NANO_BANANA_SEO
  | typeof NANO_BANANA_PRO_SEO;

export type NanoBananaFeatureItem = {
  title: string;
  text: string;
};

export type NanoBananaFeaturesCopy = {
  title: string;
  lead: string;
  items: readonly NanoBananaFeatureItem[];
};

export function formatNanoBananaSocialProof(
  count: number,
  copy: Pick<
    NanoBananaSeoCopy,
    "socialProofPrefix" | "socialProofSuffix"
  > = NANO_BANANA_SEO
): string | null {
  if (!Number.isFinite(count) || count <= 0) return null;
  const formatted = Math.trunc(count).toLocaleString("ru-RU");
  return `${copy.socialProofPrefix} ${formatted} ${copy.socialProofSuffix}`;
}

export const NANO_BANANA_HOW_TO_STEPS = [
  {
    n: "01",
    title: "Откройте генератор",
    text: "Nano Banana уже выбран. Остаётся загрузить снимок или описать кадр.",
  },
  {
    n: "02",
    title: "Опишите сцену или правку",
    text: "Для нового кадра задайте место, одежду и свет. Для правки напишите только изменение — фон, причёску или лишний объект.",
  },
  {
    n: "03",
    title: "Скачайте готовое фото",
    text: "Если кадр не тот — уточните правку своими словами и запустите ещё раз.",
  },
] as const;

export const NANO_BANANA_TOOLS = {
  title: "Точечная правка в Nano Banana",
  lead: "Загрузите снимок и опишите изменение: фон, одежду, причёску или лишний объект. Остальное модель старается оставить.",
} as const;

export const NANO_BANANA_FEATURES = {
  title: "Что умеет Nano Banana",
  lead: "Быстрый генератор и редактор: новый кадр с нуля или правка своего снимка своими словами.",
  items: [
    {
      title: "Правка своими словами",
      text: "Загрузите фото и скажите, что поменять. Nano Banana правит указанное и держит остальной кадр.",
    },
    {
      title: "Фото или текст",
      text: "Своё фото даёт портрет с вашей внешностью. Текст без снимка собирает сцену с нуля.",
    },
    {
      title: "Черновик за меньшую цену",
      text: "Обычная Nano Banana и Nano Banana 2 — для проб и серий правок. Pro берите, когда нужны свет и мелкие детали.",
    },
  ],
} as const;

export const NANO_BANANA_PRICING = {
  returnPath: NANO_BANANA_PATH,
} as const;

export const NANO_BANANA_PRO_HOW_TO_STEPS = [
  {
    n: "01",
    title: "Откройте генератор",
    text: "Nano Banana Pro уже выбран. Остаётся загрузить снимок или описать кадр.",
  },
  {
    n: "02",
    title: "Задайте свет, детали и текст",
    text: "Опишите освещение, фактуры и то, что должно читаться на кадре: вывеска, схема, надпись. Своё фото держит внешность.",
  },
  {
    n: "03",
    title: "Скачайте финальный кадр",
    text: "Pro дороже черновика. Для быстрой пробы переключите модель в блоке выше и запустите снова.",
  },
] as const;

export const NANO_BANANA_PRO_TOOLS = {
  title: "Сложный кадр в Nano Banana Pro",
  lead: "Задайте свет, материалы и читаемый текст на кадре. Подходит для финального портрета и сцен с мелкими деталями.",
} as const;

export const NANO_BANANA_PRO_FEATURES = {
  title: "Когда нужна Nano Banana Pro",
  lead: "Берите Pro, когда обычной модели мало: сложный свет, фактуры и текст как часть кадра.",
  items: [
    {
      title: "Фотореализм и свет",
      text: "Pro сильнее держит направление света, объём и правдоподобную кожу — для финального портрета, не наброска.",
    },
    {
      title: "Мелкие детали",
      text: "Сложные сцены с несколькими объектами и фактурами Pro собирает аккуратнее, чем быстрая модель.",
    },
    {
      title: "Текст на кадре",
      text: "Вывеска, открытка или простая схема могут быть частью изображения. Напишите точную формулировку в описании.",
    },
  ],
} as const;

export const NANO_BANANA_PRO_PRICING = {
  returnPath: NANO_BANANA_PRO_PATH,
} as const;

export const NANO_BANANA_ACCESS_ITEMS = [
  {
    title: "Без VPN",
    text: "Генератор открывается в обычном браузере — отдельное приложение не нужно.",
  },
  {
    title: "Интерфейс на русском",
    text: "Нано банана на русском (ru): названия моделей, настройки и подсказки — по-русски.",
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

export const NANO_BANANA_ACCESS = {
  eyebrow: "Доступ к Google Gemini",
  title: "Nano Banana в России",
  lead: "Gemini из РФ часто не открывается. На PromptShot семейство Nano Banana работает без VPN.",
  items: NANO_BANANA_ACCESS_ITEMS,
} as const;

export const NANO_BANANA_PRO_ACCESS_ITEMS = [
  {
    title: "Без VPN",
    text: "Nano Banana Pro открывается в обычном браузере — менять IP и ставить приложение не нужно.",
  },
  {
    title: "Интерфейс на русском",
    text: "Нано банана про на русском (ru): модель, настройки и описание кадра — по-русски.",
  },
  {
    title: "Оплата в рублях",
    text: "Цена Pro видна до запуска. Пакеты кредитов оплачиваются в рублях.",
  },
  {
    title: "Прямо на PromptShot",
    text: "Доступ к модели Google Gemini 3 Pro Image, не сайт Google AI Studio и не подписка Google AI.",
  },
] as const;

export const NANO_BANANA_PRO_ACCESS = {
  eyebrow: "Доступ к Google Gemini",
  title: "Nano Banana Pro в России",
  lead: "Официальный Gemini из РФ часто закрыт. На PromptShot Nano Banana Pro работает без VPN.",
  items: NANO_BANANA_PRO_ACCESS_ITEMS,
} as const;

export const NANO_BANANA_FAQ: readonly {
  q: string;
  a: readonly GeneraciyaFotoFaqPart[];
}[] = [
  {
    q: "Что такое Nano Banana?",
    a: [
      "Nano Banana (нано банана) — народное название моделей Google Gemini для фото, в документации Google это Gemini Image. На PromptShot доступны обычная Nano Banana, Nano Banana Pro и Nano Banana 2.",
    ],
  },
  {
    q: "Нано банана и Nano Banana — это одно и то же?",
    a: [
      "Да. «Нано банана» — русское написание Nano Banana, встречается и как нанабанана, нано банано или нано банан. Нейронка одна и та же — откройте ",
      { href: "#generator", label: "генератор" },
      " и запустите её здесь.",
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
    q: "Есть ли официальный сайт нано банана на русском?",
    a: [
      "Отдельного русского сайта у этой нейросети нет: модели принадлежат Google, и PromptShot не является официальным сайтом Google. Русскоязычный доступ к тем же моделям открыт в ",
      { href: "#generator", label: "генераторе" },
      " на этой странице.",
    ],
  },
  {
    q: "Можно ли в Nano Banana править фото своими словами?",
    a: [
      "Да. Загрузите снимок в ",
      { href: "#generator", label: "генератор" },
      " и напишите только изменение: фон, одежду или лишний объект. Модель правит указанное и старается сохранить остальной кадр.",
    ],
  },
  {
    q: "Чем Nano Banana Pro отличается от Nano Banana?",
    a: [
      "Обычная Nano Banana быстрее и дешевле — черновик и точечная правка. ",
      { href: NANO_BANANA_PRO_PATH, label: "Nano Banana Pro (нано банана про)" },
      " сильнее на свете, фотореализме и мелких деталях. Стоимость видна до запуска.",
    ],
  },
  {
    q: "Что такое Nano Banana 2?",
    a: [
      "Более новая быстрая линейка той же нейросети: итерации и правки со снимком. На PromptShot она в блоке ",
      { href: "#generation-models-heading", label: "моделей Nano Banana" },
      " — выберите карточку, отдельной страницы пока нет.",
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

export const NANO_BANANA_PRO_FAQ: readonly {
  q: string;
  a: readonly GeneraciyaFotoFaqPart[];
}[] = [
  {
    q: "Что такое Nano Banana Pro?",
    a: [
      "Nano Banana Pro (нано банана про) — модель Google Gemini 3 Pro Image. Её берут, когда нужны свет, фотореализм и мелкие детали, а не быстрый черновик. На PromptShot она уже выбрана в ",
      { href: "#generator", label: "генераторе" },
      ".",
    ],
  },
  {
    q: "Чем Nano Banana Pro отличается от Nano Banana?",
    a: [
      "Обычная ",
      { href: NANO_BANANA_PATH, label: "Nano Banana" },
      " — скорость и цена, точечная правка. Pro — финальный кадр: свет, фактуры и читаемый текст на изображении.",
    ],
  },
  {
    q: "Когда выбирать Nano Banana Pro?",
    a: [
      "Когда обычной модели мало: сложный свет, много мелких объектов, надпись или схема на кадре. Для наброска оставьте быструю модель в блоке выше и запустите ",
      { href: "#generator", label: "генератор" },
      ".",
    ],
  },
  {
    q: "Пишет ли Nano Banana Pro текст на картинке?",
    a: [
      "Да. Pro лучше держит вывеску, открытку или простую схему как часть кадра. Напишите точную формулировку в описании и запустите генерацию.",
    ],
  },
  {
    q: "Нано банана про и Nano Banana Pro — это одно и то же?",
    a: [
      "Да. «Нано банана про» — русское написание Nano Banana Pro. Это одна модель: откройте ",
      { href: "#generator", label: "генератор" },
      " и запустите её здесь.",
    ],
  },
  {
    q: "Как пользоваться Nano Banana Pro в России?",
    a: [
      "Откройте ",
      { href: "#generator", label: "генератор" },
      " на этой странице, загрузите фото или опишите кадр и запустите создание. Генератор работает без VPN.",
    ],
  },
  {
    q: "Nano Banana Pro — это официальный Google Gemini?",
    a: [
      "Nano Banana Pro — название модели Google Gemini для изображений. PromptShot даёт к ней доступ, но не является официальным сайтом Google или Google AI Studio.",
    ],
  },
  {
    q: "Сколько стоит Nano Banana Pro и можно ли пользоваться бесплатно?",
    a: [
      "Генерация на PromptShot оплачивается кредитами. Цена выбранной модели видна до запуска. Пакеты — в блоке ",
      { href: "#tarify", label: "тарифов" },
      " или на ",
      { href: "/pricing", label: "странице оплаты" },
      ".",
    ],
  },
  {
    q: "Нужно ли скачивать Nano Banana Pro?",
    a: [
      "Нет. Отдельного приложения нет: генератор открывается в браузере на этой странице.",
    ],
  },
];

export { flattenGeneraciyaFotoFaqAnswer };
