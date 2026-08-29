import {
  PROMTY_DLYA_II_FOTOSESSII_CHILDREN,
  PROMTY_DLYA_II_FOTOSESSII_HUB_PATH,
  getPromtyDlyaIiFotosessiiChildPath,
  type FotosessiiClusterChildSlug,
} from "./promty-dlya-ii-fotosessii-cluster";

export const PROMTY_DLYA_II_FOTOSESSII_SEO = {
  metaTitle: "Промты для ИИ фотосессии в нейросетях | PromptShot",
  metaDescription:
    "Промты для ИИ фотосессии в нейросетях. Готовые промты для создания ИИ фотосессии на русском — скопируй или создай серию со своим фото.",
  h1: "Промты для ИИ фотосессии в нейросетях",
  intro:
    "Промты для ИИ фотосессии в нейросетях — готовые тексты на серию кадров. Скопируй промт и создай ИИ фотосессию.",
  breadcrumb: "Промты для ИИ фотосессии",
  carouselCta: "Выберите стиль ИИ фотосессии",
  carouselCtaHref: "#primery",
  examplesTitle: "Промты для создания ии фотосессии",
  examplesIntro:
    "Готовые промты для создания ИИ фотосессии — скопируй текст с карточки или создай серию со своим фото. Для съёмки держи один стиль и одного героя.",
  examplesCta: "Все промты для фото",
  themesTitle: "Готовые промты для ИИ фотосессии на русском",
  themesLead:
    "Готовые промты для ИИ фотосессии на русском: женские, мужские, пары, семья и другие стили серии.",
  howToTitle: "Как сделать ии фотосессию",
  howToEyebrow: "Два шага",
  howToLead:
    "Как сделать ИИ фотосессию: скопируй готовый промт или создай серию со своим фото. Копирование бесплатное, генерация — за кредиты.",
  howToPickExampleLabel: "Выбрать пример",
  howToPickExampleHref: "#primery",
  pricingLead:
    "Кредиты на генерацию ИИ-фотосессии. Промты копируются бесплатно — пакет нужен, чтобы собрать серию кадров.",
  faqTitle: "Частые вопросы",
} as const;

export const PROMTY_DLYA_II_FOTOSESSII_HOW_TO_STEPS = [
  {
    n: "01",
    title: "Загрузи фото или выбери пример",
    text: "Загрузи фото, с которого нужна серия, или возьми готовый промт для создания ИИ фотосессии.",
  },
  {
    n: "02",
    title: "Купи кредиты и собери серию",
    text: "Купи кредиты и создай несколько кадров из одного лука — так получается ИИ-фотосессия, а не набор случайных снимков.",
  },
] as const;

export const PROMTY_DLYA_II_FOTOSESSII_THEME_ITEMS =
  PROMTY_DLYA_II_FOTOSESSII_CHILDREN.map((child) => ({
    title: child.label,
    href: getPromtyDlyaIiFotosessiiChildPath(child.slug),
    dimension: child.dimension,
    tagValue: child.tagValue,
  }));

export type FotosessiiFaqLink = {
  href: string;
  label: string;
};

export type FotosessiiFaqPart = string | FotosessiiFaqLink;

export function flattenFotosessiiFaqAnswer(
  parts: readonly FotosessiiFaqPart[]
): string {
  return parts
    .map((part) => (typeof part === "string" ? part : part.label))
    .join("");
}

export function isFotosessiiFaqLink(
  part: FotosessiiFaqPart
): part is FotosessiiFaqLink {
  return typeof part !== "string";
}

export const PROMTY_DLYA_II_FOTOSESSII_FAQ: {
  q: string;
  a: FotosessiiFaqPart[];
}[] = [
  {
    q: "Где взять готовые промты для ИИ фотосессии?",
    a: [
      "На этой странице: в блоке «Примеры луков» и в подборках ",
      {
        href: getPromtyDlyaIiFotosessiiChildPath("zhenskie"),
        label: "женские",
      },
      ", ",
      {
        href: getPromtyDlyaIiFotosessiiChildPath("pary"),
        label: "парные",
      },
      ", ",
      {
        href: getPromtyDlyaIiFotosessiiChildPath("muzhskie"),
        label: "мужские",
      },
      " и ",
      {
        href: getPromtyDlyaIiFotosessiiChildPath("semeynye"),
        label: "семейные",
      },
      ". Скопируй текст с карточки или запусти кадр на PromptShot.",
    ],
  },
  {
    q: "Чем промт для нейрофотосессии отличается от промта для одного фото?",
    a: [
      "Нейрофотосессия — серия: несколько образов, одно лицо. Один промт для фото лежит в ",
      { href: "/", label: "каталоге на главной" },
      ". Здесь собирают набор луков, а не ищут единственную формулировку.",
    ],
  },
  {
    q: "Промты для ИИ фотосессии на русском?",
    a: [
      "Да. Все тексты на русском, копировать можно бесплатно. Те же формулировки подходят для ChatGPT, Gemini и Nano Banana — генерировать можно здесь.",
    ],
  },
  {
    q: "Какие промты для ИИ фотосессии лучше?",
    a: [
      "Те, у которых уже есть удачный кадр и которые держат один стиль на всю серию. Не бери в один набор студию, аниме и пляж — серия развалится.",
    ],
  },
  {
    q: "Как создать ИИ-фотосессию в нейросети со своим фото?",
    a: [
      "Загрузи одно и то же фото или выбери пример из базы, купи кредиты и запусти серию из одного лука. Старт генерации — ",
      { href: "/generaciya-foto", label: "Сделать фото ИИ" },
      ".",
    ],
  },
  {
    q: "Где промты для фотосессии на день рождения или для пар?",
    a: [
      "Серия на день рождения — ",
      {
        href: getPromtyDlyaIiFotosessiiChildPath("den-rozhdeniya"),
        label: "промты для ИИ фотосессии на день рождения",
      },
      ". Один кадр праздника — ",
      { href: "/sobytiya/den-rozhdeniya", label: "промты на день рождения" },
      ". Пары — ",
      {
        href: getPromtyDlyaIiFotosessiiChildPath("pary"),
        label: "промты для ИИ фотосессии парные",
      },
      ", вдвоём — ",
      {
        href: getPromtyDlyaIiFotosessiiChildPath("dlya-dvoih"),
        label: "для двоих",
      },
      ". Этот хаб держит запрос «промты для ии фотосессии в нейросетях».",
    ],
  },
];

export type FotosessiiHowToStep = {
  n: string;
  title: string;
  text: string;
};

export type FotosessiiChildCopy = {
  slug: FotosessiiClusterChildSlug;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  intro: string;
  carouselCta: string;
  carouselCtaHref: string;
  examplesTitle: string;
  examplesIntro: string;
  examplesCta: string;
  themesTitle: string;
  themesLead: string;
  howToTitle: string;
  howToEyebrow: string;
  howToLead: string;
  howToPickExampleLabel: string;
  howToPickExampleHref: string;
  howToSteps: readonly FotosessiiHowToStep[];
  pricingLead: string;
  faqTitle: string;
  faq: { q: string; a: string }[];
};

type ChildCopyForms = {
  h1: string;
  creating: string;
  howToMake: string;
  createCta: string;
  pricingOf: string;
  resultNoun: string;
  examplesTitle: string;
  faq: { q: string; a: string }[];
};

const COPY_CTA = "скопируй или создай серию со своим фото";
const COPY_CARD_CTA =
  "Скопируй текст с карточки или создай серию со своим фото";

function buildFotosessiiChildCopy(
  forms: ChildCopyForms
): Omit<FotosessiiChildCopy, "slug"> {
  return {
    metaTitle: `${forms.h1} | PromptShot`,
    metaDescription: `${forms.h1}. Готовые промты для создания ${forms.creating} на русском — ${COPY_CTA}.`,
    h1: forms.h1,
    intro: `${forms.h1} — готовые тексты на серию кадров. Скопируй промт и создай ${forms.createCta}.`,
    carouselCta: PROMTY_DLYA_II_FOTOSESSII_SEO.carouselCta,
    carouselCtaHref: PROMTY_DLYA_II_FOTOSESSII_SEO.carouselCtaHref,
    examplesTitle: forms.examplesTitle,
    examplesIntro: `Готовые промты для создания ${forms.creating} — ${COPY_CARD_CTA.toLowerCase()}. Для съёмки держи один стиль и одного героя.`,
    examplesCta: PROMTY_DLYA_II_FOTOSESSII_SEO.examplesCta,
    themesTitle: `Готовые промты для ${forms.creating} на русском`,
    themesLead: `Готовые промты для ${forms.creating} на русском: женские, мужские, пары, семья и другие стили серии.`,
    howToTitle: `Как сделать ${forms.howToMake}`,
    howToEyebrow: PROMTY_DLYA_II_FOTOSESSII_SEO.howToEyebrow,
    howToLead: `Как сделать ${forms.howToMake}: скопируй готовый промт или создай серию со своим фото. Копирование бесплатное, генерация — за кредиты.`,
    howToPickExampleLabel: PROMTY_DLYA_II_FOTOSESSII_SEO.howToPickExampleLabel,
    howToPickExampleHref: PROMTY_DLYA_II_FOTOSESSII_SEO.howToPickExampleHref,
    howToSteps: [
      {
        n: "01",
        title: PROMTY_DLYA_II_FOTOSESSII_HOW_TO_STEPS[0].title,
        text: `Загрузи фото, с которого нужна серия, или возьми готовый промт для создания ${forms.creating}.`,
      },
      {
        n: "02",
        title: PROMTY_DLYA_II_FOTOSESSII_HOW_TO_STEPS[1].title,
        text: `Купи кредиты и создай несколько кадров из одного лука — так получается ${forms.resultNoun}, а не набор случайных снимков.`,
      },
    ],
    pricingLead: `Кредиты на генерацию ${forms.pricingOf}. Промты копируются бесплатно — пакет нужен, чтобы собрать серию кадров.`,
    faqTitle: PROMTY_DLYA_II_FOTOSESSII_SEO.faqTitle,
    faq: forms.faq,
  };
}

const FAQ_RU =
  "Да. Все тексты на русском. Скопируй с карточки или создай серию со своим фото.";
const FAQ_CREATE =
  "Скопируй промт с карточки или создай серию со своим фото.";

function childFaq(
  ruQuestion: string,
  vsCatalog: { q: string; a: string },
  whereQuestion: string
): { q: string; a: string }[] {
  return [
    { q: ruQuestion, a: FAQ_RU },
    vsCatalog,
    { q: whereQuestion, a: FAQ_CREATE },
  ];
}

const CHILD_COPY: Record<FotosessiiClusterChildSlug, Omit<FotosessiiChildCopy, "slug">> = {
  zhenskie: buildFotosessiiChildCopy({
    h1: "Промты для ИИ фотосессии женские",
    creating: "женской ИИ фотосессии",
    howToMake: "женскую ии фотосессию",
    createCta: "женскую ИИ фотосессию",
    pricingOf: "женской ИИ-фотосессии",
    resultNoun: "женская ИИ-фотосессия",
    examplesTitle: "Промты для создания ии фотосессии женские",
    faq: childFaq(
      "Есть промты для ИИ фотосессии женские на русском?",
      {
        q: "Чем эта страница отличается от промтов для фото девушки?",
        a: "Здесь серия луков. Каталог промтов для фото девушки — один кадр и фильтры вроде портрета или цветов.",
      },
      "Где сделать женское фото по промту?"
    ),
  }),
  muzhskie: buildFotosessiiChildCopy({
    h1: "Промты для ИИ фотосессии мужские",
    creating: "мужской ИИ фотосессии",
    howToMake: "мужскую ии фотосессию",
    createCta: "мужскую ИИ фотосессию",
    pricingOf: "мужской ИИ-фотосессии",
    resultNoun: "мужская ИИ-фотосессия",
    examplesTitle: "Промты для создания ии фотосессии мужские",
    faq: childFaq(
      "Есть промты для ИИ фотосессии мужские на русском?",
      {
        q: "Чем эта страница отличается от промтов для фото мужчины?",
        a: "Здесь серия луков. Каталог промтов для фото мужчины — один кадр и сюжеты вроде формы или машины.",
      },
      "Где сделать мужское фото по промту?"
    ),
  }),
  pary: buildFotosessiiChildCopy({
    h1: "Промты для ИИ фотосессии парные",
    creating: "парной ИИ фотосессии",
    howToMake: "парную ии фотосессию",
    createCta: "парную ИИ фотосессию",
    pricingOf: "парной ИИ-фотосессии",
    resultNoun: "парная ИИ-фотосессия",
    examplesTitle: "Промты для создания ии фотосессии парные",
    faq: childFaq(
      "Есть парные промты для ИИ фотосессии на русском?",
      {
        q: "Чем эта страница отличается от промтов для фото пар?",
        a: "Здесь серия луков вдвоём. Каталог промтов для фото пар — один кадр и узкие хвосты вроде Love Is.",
      },
      "Где сделать парное фото по промту?"
    ),
  }),
  semeynye: buildFotosessiiChildCopy({
    h1: "Промты для ИИ фотосессии семейные",
    creating: "семейной ИИ фотосессии",
    howToMake: "семейную ии фотосессию",
    createCta: "семейную ИИ фотосессию",
    pricingOf: "семейной ИИ-фотосессии",
    resultNoun: "семейная ИИ-фотосессия",
    examplesTitle: "Промты для создания ии фотосессии семейные",
    faq: childFaq(
      "Есть промты для ИИ фотосессии семейные на русском?",
      {
        q: "Чем эта страница отличается от промтов для семейного фото?",
        a: "Здесь серия луков. Каталог промтов для семейного фото — один кадр.",
      },
      "Где сделать семейное фото по промту?"
    ),
  }),
  detskie: buildFotosessiiChildCopy({
    h1: "Промты для ИИ фотосессии детские",
    creating: "детской ИИ фотосессии",
    howToMake: "детскую ии фотосессию",
    createCta: "детскую ИИ фотосессию",
    pricingOf: "детской ИИ-фотосессии",
    resultNoun: "детская ИИ-фотосессия",
    examplesTitle: "Промты для создания ии фотосессии детские",
    faq: childFaq(
      "Есть промты для ИИ фотосессии детские на русском?",
      {
        q: "Чем эта страница отличается от промтов для детских фото?",
        a: "Здесь серия луков. Каталог промтов для детских фото — один кадр.",
      },
      "Где сделать детское фото по промту?"
    ),
  }),
  beremennye: buildFotosessiiChildCopy({
    h1: "Промты для ИИ фотосессии беременные",
    creating: "беременной ИИ фотосессии",
    howToMake: "беременную ии фотосессию",
    createCta: "беременную ИИ фотосессию",
    pricingOf: "беременной ИИ-фотосессии",
    resultNoun: "беременная ИИ-фотосессия",
    examplesTitle: "Промты для создания ии фотосессии беременные",
    faq: childFaq(
      "Есть промт для беременной фотосессии ИИ на русском?",
      {
        q: "Чем эта страница отличается от промтов для фото беременной?",
        a: "Здесь серия луков. Каталог промтов для фото беременной — один кадр.",
      },
      "Где сделать фото беременной по промту?"
    ),
  }),
  "den-rozhdeniya": buildFotosessiiChildCopy({
    h1: "Промты для ИИ фотосессии на день рождения",
    creating: "ИИ фотосессии на день рождения",
    howToMake: "ии фотосессию на день рождения",
    createCta: "ИИ фотосессию на день рождения",
    pricingOf: "ИИ-фотосессии на день рождения",
    resultNoun: "ИИ-фотосессия на день рождения",
    examplesTitle: "Промты для создания ии фотосессии на день рождения",
    faq: childFaq(
      "Есть промты для ИИ фотосессии на день рождения на русском?",
      {
        q: "Чем эта страница отличается от промтов на день рождения?",
        a: "Здесь серия луков. Каталог промтов на день рождения — один кадр и фильтры вроде торта или детского праздника.",
      },
      "Где сделать фото на день рождения по промту?"
    ),
  }),
  studiynye: buildFotosessiiChildCopy({
    h1: "Промты для ИИ фотосессии студийные",
    creating: "студийной ИИ фотосессии",
    howToMake: "студийную ии фотосессию",
    createCta: "студийную ИИ фотосессию",
    pricingOf: "студийной ИИ-фотосессии",
    resultNoun: "студийная ИИ-фотосессия",
    examplesTitle: "Промты для создания ии фотосессии студийные",
    faq: childFaq(
      "Есть студийные промты для ИИ фотосессии на русском?",
      {
        q: "Чем эта страница отличается от промтов для студийного фото?",
        a: "Здесь серия луков в одном свете. Каталог студийных промтов — один кадр.",
      },
      "Где сделать студийное фото по промту?"
    ),
  }),
  zimnyaya: buildFotosessiiChildCopy({
    h1: "Промты для ИИ фотосессии зимняя",
    creating: "зимней ИИ фотосессии",
    howToMake: "зимнюю ии фотосессию",
    createCta: "зимнюю ИИ фотосессию",
    pricingOf: "зимней ИИ-фотосессии",
    resultNoun: "зимняя ИИ-фотосессия",
    examplesTitle: "Промты для создания ии фотосессии зимняя",
    faq: childFaq(
      "Есть промты для ИИ фотосессии зимняя на русском?",
      {
        q: "Чем эта страница отличается от промтов про зиму?",
        a: "Здесь серия луков. Каталог зимних промтов — один кадр.",
      },
      "Где сделать зимнее фото по промту?"
    ),
  }),
  "s-voennymi": buildFotosessiiChildCopy({
    h1: "Промты для ИИ фотосессии с военными",
    creating: "ИИ фотосессии с военными",
    howToMake: "ии фотосессию с военными",
    createCta: "ИИ фотосессию с военными",
    pricingOf: "ИИ-фотосессии с военными",
    resultNoun: "ИИ-фотосессия с военными",
    examplesTitle: "Промты для создания ии фотосессии с военными",
    faq: childFaq(
      "Есть промты для ИИ фотосессии с военными на русском?",
      {
        q: "Чем эта страница отличается от промтов для фото в форме?",
        a: "Здесь серия луков в военной форме. Каталог промтов в форме — один кадр.",
      },
      "Где сделать фото в военной форме по промту?"
    ),
  }),
  "dlya-dvoih": buildFotosessiiChildCopy({
    h1: "Промты для ИИ фотосессии для двоих",
    creating: "ИИ фотосессии для двоих",
    howToMake: "ии фотосессию для двоих",
    createCta: "ИИ фотосессию для двоих",
    pricingOf: "ИИ-фотосессии для двоих",
    resultNoun: "ИИ-фотосессия для двоих",
    examplesTitle: "Промты для создания ии фотосессии для двоих",
    faq: childFaq(
      "Есть промты для ИИ фотосессии для двоих на русском?",
      {
        q: "Чем эта страница отличается от парной ИИ-фотосессии?",
        a: "Здесь серия «для двоих» и влюблённых. Парная страница держит более широкий набор кадров вдвоём.",
      },
      "Где сделать фото для двоих по промту?"
    ),
  }),
  novogodnyaya: buildFotosessiiChildCopy({
    h1: "Промты для ИИ фотосессии новогодняя",
    creating: "новогодней ИИ фотосессии",
    howToMake: "новогоднюю ии фотосессию",
    createCta: "новогоднюю ИИ фотосессию",
    pricingOf: "новогодней ИИ-фотосессии",
    resultNoun: "новогодняя ИИ-фотосессия",
    examplesTitle: "Промты для создания ии фотосессии новогодняя",
    faq: childFaq(
      "Есть промты для ИИ фотосессии новогодняя на русском?",
      {
        q: "Чем эта страница отличается от зимней ИИ-фотосессии?",
        a: "Здесь серия про Новый год: ёлка, гирлянды, праздник. Зимняя страница — снег и холод без обязательного нового года.",
      },
      "Где сделать новогоднее фото по промту?"
    ),
  }),
  vesennie: buildFotosessiiChildCopy({
    h1: "Промты для ИИ фотосессии весенние",
    creating: "весенней ИИ фотосессии",
    howToMake: "весеннюю ии фотосессию",
    createCta: "весеннюю ИИ фотосессию",
    pricingOf: "весенней ИИ-фотосессии",
    resultNoun: "весенняя ИИ-фотосессия",
    examplesTitle: "Промты для создания ии фотосессии весенние",
    faq: childFaq(
      "Есть промты для ИИ фотосессии весенние на русском?",
      {
        q: "Чем эта страница отличается от промтов про весну?",
        a: "Здесь серия луков. Каталог весенних промтов — один кадр.",
      },
      "Где сделать весеннее фото по промту?"
    ),
  }),
  "delovoy-stil": buildFotosessiiChildCopy({
    h1: "Промты для ИИ фотосессии деловой стиль",
    creating: "ИИ фотосессии в деловом стиле",
    howToMake: "ии фотосессию в деловом стиле",
    createCta: "ИИ фотосессию в деловом стиле",
    pricingOf: "ИИ-фотосессии в деловом стиле",
    resultNoun: "ИИ-фотосессия в деловом стиле",
    examplesTitle: "Промты для создания ии фотосессии деловой стиль",
    faq: childFaq(
      "Есть промты для ИИ фотосессии деловой стиль на русском?",
      {
        q: "Чем эта страница отличается от промтов для делового фото?",
        a: "Здесь серия луков. Каталог деловых промтов — один кадр.",
      },
      "Где сделать деловое фото по промту?"
    ),
  }),
  nyuborn: buildFotosessiiChildCopy({
    h1: "Промты для ИИ фотосессии ньюборн",
    creating: "ньюборн ИИ фотосессии",
    howToMake: "ньюборн ии фотосессию",
    createCta: "ньюборн ИИ фотосессию",
    pricingOf: "ньюборн ИИ-фотосессии",
    resultNoun: "ньюборн ИИ-фотосессия",
    examplesTitle: "Промты для создания ии фотосессии ньюборн",
    faq: childFaq(
      "Есть промты для ИИ фотосессии ньюборн на русском?",
      {
        q: "Чем эта страница отличается от детской ИИ-фотосессии?",
        a: "Здесь серия новорождённого. Детская страница — дети старше младенца.",
      },
      "Где сделать ньюборн-фото по промту?"
    ),
  }),
  "s-mashinoy": buildFotosessiiChildCopy({
    h1: "Промты для ИИ фотосессии с машиной",
    creating: "ИИ фотосессии с машиной",
    howToMake: "ии фотосессию с машиной",
    createCta: "ИИ фотосессию с машиной",
    pricingOf: "ИИ-фотосессии с машиной",
    resultNoun: "ИИ-фотосессия с машиной",
    examplesTitle: "Промты для создания ии фотосессии с машиной",
    faq: childFaq(
      "Есть промты для ИИ фотосессии с машиной на русском?",
      {
        q: "Чем эта страница отличается от промтов для фото с машиной?",
        a: "Здесь серия луков у авто. Каталог промтов с машиной — один кадр.",
      },
      "Где сделать фото с машиной по промту?"
    ),
  }),
  "cherno-belye": buildFotosessiiChildCopy({
    h1: "Промты для ИИ фотосессии чёрно-белые",
    creating: "чёрно-белой ИИ фотосессии",
    howToMake: "чёрно-белую ии фотосессию",
    createCta: "чёрно-белую ИИ фотосессию",
    pricingOf: "чёрно-белой ИИ-фотосессии",
    resultNoun: "чёрно-белая ИИ-фотосессия",
    examplesTitle: "Промты для создания ии фотосессии чёрно-белые",
    faq: childFaq(
      "Есть чёрно-белые промты для ИИ фотосессии на русском?",
      {
        q: "Чем эта страница отличается от промтов для чёрно-белого фото?",
        a: "Здесь серия монохромных луков. Каталог чёрно-белых промтов — один кадр.",
      },
      "Где сделать чёрно-белое фото по промту?"
    ),
  }),
};

export function findPromtyDlyaIiFotosessiiChildCopy(
  slug: string
): FotosessiiChildCopy | null {
  if (!Object.hasOwn(CHILD_COPY, slug)) return null;
  const childSlug = slug as FotosessiiClusterChildSlug;
  return { slug: childSlug, ...CHILD_COPY[childSlug] };
}

export function getPromtyDlyaIiFotosessiiHubUrl(siteUrl: string): string {
  return `${siteUrl}${PROMTY_DLYA_II_FOTOSESSII_HUB_PATH}`;
}
