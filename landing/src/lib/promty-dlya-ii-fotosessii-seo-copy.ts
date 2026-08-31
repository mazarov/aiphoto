import {
  PROMTY_DLYA_II_FOTOSESSII_CHILDREN,
  PROMTY_DLYA_II_FOTOSESSII_HUB_PATH,
  getPromtyDlyaIiFotosessiiChildPath,
  type FotosessiiClusterChildSlug,
} from "./promty-dlya-ii-fotosessii-cluster";

export const PROMTY_DLYA_II_FOTOSESSII_SEO = {
  metaTitle: "ИИ фотосессия по фото онлайн | PromptShot",
  metaDescription:
    "ИИ фотосессия по своему фото: серия кадров в одном стиле. Загрузи одно фото и собери съёмку онлайн — без студии и фотографа.",
  h1: "ИИ фотосессия по своему фото",
  intro:
    "ИИ фотосессия по своему фото — несколько кадров из одного снимка, один стиль и одно лицо. Загрузи фото и собери серию.",
  breadcrumb: "ИИ фотосессия",
  carouselCta: "Собрать фотосессию",
  carouselCtaHref: "#primery",
  examplesTitle: "Примеры ИИ фотосессии",
  examplesIntro:
    "Серия из одного фото: один стиль и один герой. Открой пример или загрузи свой снимок.",
  examplesCta: "Все промты для фото",
  themesTitle: "Сценарии ИИ фотосессии",
  themesLead:
    "Парная, семейная, зимняя, женская и другие серии: одно фото, один стиль.",
  howToTitle: "Как сделать ИИ фотосессию по фото",
  howToEyebrow: "Два шага",
  howToLead:
    "Загрузи одно фото и собери серию кадров в одном стиле. Это ИИ фотосессия, а не один снимок.",
  howToPickExampleLabel: "Выбрать пример",
  howToPickExampleHref: "#primery",
  pricingLead:
    "Кредиты нужны, чтобы собрать серию. Просмотр примеров на странице — без оплаты.",
  faqTitle: "Частые вопросы",
} as const;

export const PROMTY_DLYA_II_FOTOSESSII_HOW_TO_STEPS = [
  {
    n: "01",
    title: "Загрузи одно фото",
    text: "Загрузи фото, с которого нужна серия. Одно лицо — вся съёмка в одном стиле.",
  },
  {
    n: "02",
    title: "Собери несколько кадров",
    text: "Выбери стиль и создай несколько кадров из одного лука — так получается ИИ фотосессия по фото, а не набор случайных снимков.",
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
    q: "Как сделать ИИ фотосессию по фото?",
    a: [
      "Загрузи одно фото, выбери стиль и собери несколько кадров в одном образе. Старт — кнопка «Собрать фотосессию» на этой странице.",
    ],
  },
  {
    q: "Чем ИИ фотосессия отличается от одного кадра?",
    a: [
      "ИИ фотосессия — серия: несколько образов, одно лицо, один стиль. Один кадр лежит в ",
      { href: "/", label: "каталоге промтов" },
      " и на ",
      { href: "/generaciya-foto", label: "странице «Сделать фото ИИ»" },
      ".",
    ],
  },
  {
    q: "Где парная, семейная или зимняя ИИ фотосессия?",
    a: [
      "Сценарии ниже: ",
      {
        href: getPromtyDlyaIiFotosessiiChildPath("pary"),
        label: "парная",
      },
      ", ",
      {
        href: getPromtyDlyaIiFotosessiiChildPath("semeynye"),
        label: "семейная",
      },
      ", ",
      {
        href: getPromtyDlyaIiFotosessiiChildPath("zimnyaya"),
        label: "зимняя",
      },
      ", ",
      {
        href: getPromtyDlyaIiFotosessiiChildPath("zhenskie"),
        label: "женская",
      },
      " и ",
      {
        href: getPromtyDlyaIiFotosessiiChildPath("den-rozhdeniya"),
        label: "на день рождения",
      },
      ". Один праздничный кадр — ",
      { href: "/sobytiya/den-rozhdeniya", label: "промты на день рождения" },
      ".",
    ],
  },
  {
    q: "Можно скопировать промт без генерации?",
    a: [
      "Да. Текст с карточки копируется бесплатно. Генерация серии из своего фото идёт за кредиты.",
    ],
  },
  {
    q: "Нужна регистрация для ИИ фотосессии онлайн?",
    a: [
      "Посмотреть примеры можно сразу. Чтобы загрузить своё фото и собрать серию, нужен вход — так кадры сохраняются в библиотеке.",
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

function buildFotosessiiChildCopy(
  forms: ChildCopyForms
): Omit<FotosessiiChildCopy, "slug"> {
  return {
    metaTitle: `${forms.h1} | PromptShot`,
    metaDescription: `${forms.h1} по своему фото: серия кадров в одном стиле. Загрузи фото и собери съёмку онлайн.`,
    h1: forms.h1,
    intro: `${forms.h1} — серия кадров из одного фото. Загрузи снимок и собери ${forms.createCta}.`,
    carouselCta: PROMTY_DLYA_II_FOTOSESSII_SEO.carouselCta,
    carouselCtaHref: PROMTY_DLYA_II_FOTOSESSII_SEO.carouselCtaHref,
    examplesTitle: forms.examplesTitle,
    examplesIntro: `Серия для ${forms.creating} из одного фото. Один стиль и один герой.`,
    examplesCta: PROMTY_DLYA_II_FOTOSESSII_SEO.examplesCta,
    themesTitle: `Сценарии рядом с ${forms.creating}`,
    themesLead:
      "Парная, семейная, зимняя, женская и другие серии: одно фото, один стиль.",
    howToTitle: `Как сделать ${forms.howToMake}`,
    howToEyebrow: PROMTY_DLYA_II_FOTOSESSII_SEO.howToEyebrow,
    howToLead: `Загрузи одно фото и собери ${forms.howToMake} в одном стиле.`,
    howToPickExampleLabel: PROMTY_DLYA_II_FOTOSESSII_SEO.howToPickExampleLabel,
    howToPickExampleHref: PROMTY_DLYA_II_FOTOSESSII_SEO.howToPickExampleHref,
    howToSteps: [
      {
        n: "01",
        title: PROMTY_DLYA_II_FOTOSESSII_HOW_TO_STEPS[0].title,
        text: `Загрузи фото, с которого нужна серия ${forms.creating}. Одно лицо — вся съёмка в одном стиле.`,
      },
      {
        n: "02",
        title: PROMTY_DLYA_II_FOTOSESSII_HOW_TO_STEPS[1].title,
        text: `Выбери стиль и создай несколько кадров из одного лука — так получается ${forms.resultNoun}.`,
      },
    ],
    pricingLead: `Кредиты на генерацию ${forms.pricingOf}. Просмотр примеров — без оплаты.`,
    faqTitle: PROMTY_DLYA_II_FOTOSESSII_SEO.faqTitle,
    faq: forms.faq,
  };
}

const FAQ_RU =
  "Да. Загрузи одно фото и собери серию в одном стиле — или скопируй текст с карточки.";
const FAQ_CREATE =
  "Загрузи своё фото и собери серию на этой странице.";

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
    h1: "Женская ИИ фотосессия",
    creating: "женской ИИ фотосессии",
    howToMake: "женскую ии фотосессию",
    createCta: "женскую ИИ фотосессию",
    pricingOf: "женской ИИ-фотосессии",
    resultNoun: "женская ИИ-фотосессия",
    examplesTitle: "Примеры женской ИИ фотосессии",
    faq: childFaq(
      "Как сделать женскую ИИ фотосессию по фото?",
      {
        q: "Чем эта страница отличается от промтов для фото девушки?",
        a: "Здесь серия луков. Каталог промтов для фото девушки — один кадр и фильтры вроде портрета или цветов.",
      },
      "Где сделать женское фото по промту?"
    ),
  }),
  muzhskie: buildFotosessiiChildCopy({
    h1: "Мужская ИИ фотосессия",
    creating: "мужской ИИ фотосессии",
    howToMake: "мужскую ии фотосессию",
    createCta: "мужскую ИИ фотосессию",
    pricingOf: "мужской ИИ-фотосессии",
    resultNoun: "мужская ИИ-фотосессия",
    examplesTitle: "Примеры мужской ИИ фотосессии",
    faq: childFaq(
      "Как сделать мужскую ИИ фотосессию по фото?",
      {
        q: "Чем эта страница отличается от промтов для фото мужчины?",
        a: "Здесь серия луков. Каталог промтов для фото мужчины — один кадр и сюжеты вроде формы или машины.",
      },
      "Где сделать мужское фото по промту?"
    ),
  }),
  pary: buildFotosessiiChildCopy({
    h1: "Парная ИИ фотосессия",
    creating: "парной ИИ фотосессии",
    howToMake: "парную ии фотосессию",
    createCta: "парную ИИ фотосессию",
    pricingOf: "парной ИИ-фотосессии",
    resultNoun: "парная ИИ-фотосессия",
    examplesTitle: "Примеры парной ИИ фотосессии",
    faq: childFaq(
      "Как сделать парную ИИ фотосессию по фото?",
      {
        q: "Чем эта страница отличается от промтов для фото пар?",
        a: "Здесь серия луков вдвоём. Каталог промтов для фото пар — один кадр и узкие хвосты вроде Love Is.",
      },
      "Где сделать парное фото по промту?"
    ),
  }),
  semeynye: buildFotosessiiChildCopy({
    h1: "Семейная ИИ фотосессия",
    creating: "семейной ИИ фотосессии",
    howToMake: "семейную ии фотосессию",
    createCta: "семейную ИИ фотосессию",
    pricingOf: "семейной ИИ-фотосессии",
    resultNoun: "семейная ИИ-фотосессия",
    examplesTitle: "Примеры семейной ИИ фотосессии",
    faq: childFaq(
      "Как сделать семейную ИИ фотосессию по фото?",
      {
        q: "Чем эта страница отличается от промтов для семейного фото?",
        a: "Здесь серия луков. Каталог промтов для семейного фото — один кадр.",
      },
      "Где сделать семейное фото по промту?"
    ),
  }),
  detskie: buildFotosessiiChildCopy({
    h1: "Детская ИИ фотосессия",
    creating: "детской ИИ фотосессии",
    howToMake: "детскую ии фотосессию",
    createCta: "детскую ИИ фотосессию",
    pricingOf: "детской ИИ-фотосессии",
    resultNoun: "детская ИИ-фотосессия",
    examplesTitle: "Примеры детской ИИ фотосессии",
    faq: childFaq(
      "Как сделать детскую ИИ фотосессию по фото?",
      {
        q: "Чем эта страница отличается от промтов для детских фото?",
        a: "Здесь серия луков. Каталог промтов для детских фото — один кадр.",
      },
      "Где сделать детское фото по промту?"
    ),
  }),
  beremennye: buildFotosessiiChildCopy({
    h1: "Беременная ИИ фотосессия",
    creating: "беременной ИИ фотосессии",
    howToMake: "беременную ии фотосессию",
    createCta: "беременную ИИ фотосессию",
    pricingOf: "беременной ИИ-фотосессии",
    resultNoun: "беременная ИИ-фотосессия",
    examplesTitle: "Примеры беременной ИИ фотосессии",
    faq: childFaq(
      "Как сделать беременную фотосессию ИИ по фото?",
      {
        q: "Чем эта страница отличается от промтов для фото беременной?",
        a: "Здесь серия луков. Каталог промтов для фото беременной — один кадр.",
      },
      "Где сделать фото беременной по промту?"
    ),
  }),
  "den-rozhdeniya": buildFotosessiiChildCopy({
    h1: "ИИ фотосессия на день рождения",
    creating: "ИИ фотосессии на день рождения",
    howToMake: "ии фотосессию на день рождения",
    createCta: "ИИ фотосессию на день рождения",
    pricingOf: "ИИ-фотосессии на день рождения",
    resultNoun: "ИИ-фотосессия на день рождения",
    examplesTitle: "Примеры ИИ фотосессии на день рождения",
    faq: childFaq(
      "Как сделать ИИ фотосессию на день рождения по фото?",
      {
        q: "Чем эта страница отличается от промтов на день рождения?",
        a: "Здесь серия луков. Каталог промтов на день рождения — один кадр и фильтры вроде торта или детского праздника.",
      },
      "Где сделать фото на день рождения по промту?"
    ),
  }),
  studiynye: buildFotosessiiChildCopy({
    h1: "Студийная ИИ фотосессия",
    creating: "студийной ИИ фотосессии",
    howToMake: "студийную ии фотосессию",
    createCta: "студийную ИИ фотосессию",
    pricingOf: "студийной ИИ-фотосессии",
    resultNoun: "студийная ИИ-фотосессия",
    examplesTitle: "Примеры студийной ИИ фотосессии",
    faq: childFaq(
      "Как сделать студийную ИИ фотосессию по фото?",
      {
        q: "Чем эта страница отличается от промтов для студийного фото?",
        a: "Здесь серия луков в одном свете. Каталог студийных промтов — один кадр.",
      },
      "Где сделать студийное фото по промту?"
    ),
  }),
  zimnyaya: buildFotosessiiChildCopy({
    h1: "Зимняя ИИ фотосессия",
    creating: "зимней ИИ фотосессии",
    howToMake: "зимнюю ии фотосессию",
    createCta: "зимнюю ИИ фотосессию",
    pricingOf: "зимней ИИ-фотосессии",
    resultNoun: "зимняя ИИ-фотосессия",
    examplesTitle: "Примеры зимней ИИ фотосессии",
    faq: childFaq(
      "Как сделать зимнюю ИИ фотосессию по фото?",
      {
        q: "Чем эта страница отличается от промтов про зиму?",
        a: "Здесь серия луков. Каталог зимних промтов — один кадр.",
      },
      "Где сделать зимнее фото по промту?"
    ),
  }),
  "s-voennymi": buildFotosessiiChildCopy({
    h1: "ИИ фотосессия с военными",
    creating: "ИИ фотосессии с военными",
    howToMake: "ии фотосессию с военными",
    createCta: "ИИ фотосессию с военными",
    pricingOf: "ИИ-фотосессии с военными",
    resultNoun: "ИИ-фотосессия с военными",
    examplesTitle: "Примеры ИИ фотосессии с военными",
    faq: childFaq(
      "Как сделать ИИ фотосессию с военными по фото?",
      {
        q: "Чем эта страница отличается от промтов для фото в форме?",
        a: "Здесь серия луков в военной форме. Каталог промтов в форме — один кадр.",
      },
      "Где сделать фото в военной форме по промту?"
    ),
  }),
  "dlya-dvoih": buildFotosessiiChildCopy({
    h1: "ИИ фотосессия для двоих",
    creating: "ИИ фотосессии для двоих",
    howToMake: "ии фотосессию для двоих",
    createCta: "ИИ фотосессию для двоих",
    pricingOf: "ИИ-фотосессии для двоих",
    resultNoun: "ИИ-фотосессия для двоих",
    examplesTitle: "Примеры ИИ фотосессии для двоих",
    faq: childFaq(
      "Как сделать ИИ фотосессию для двоих по фото?",
      {
        q: "Чем эта страница отличается от парной ИИ-фотосессии?",
        a: "Здесь серия «для двоих» и влюблённых. Парная страница держит более широкий набор кадров вдвоём.",
      },
      "Где сделать фото для двоих по промту?"
    ),
  }),
  novogodnyaya: buildFotosessiiChildCopy({
    h1: "Новогодняя ИИ фотосессия",
    creating: "новогодней ИИ фотосессии",
    howToMake: "новогоднюю ии фотосессию",
    createCta: "новогоднюю ИИ фотосессию",
    pricingOf: "новогодней ИИ-фотосессии",
    resultNoun: "новогодняя ИИ-фотосессия",
    examplesTitle: "Примеры новогодней ИИ фотосессии",
    faq: childFaq(
      "Как сделать новогоднюю ИИ фотосессию по фото?",
      {
        q: "Чем эта страница отличается от зимней ИИ-фотосессии?",
        a: "Здесь серия про Новый год: ёлка, гирлянды, праздник. Зимняя страница — снег и холод без обязательного нового года.",
      },
      "Где сделать новогоднее фото по промту?"
    ),
  }),
  vesennie: buildFotosessiiChildCopy({
    h1: "Весенняя ИИ фотосессия",
    creating: "весенней ИИ фотосессии",
    howToMake: "весеннюю ии фотосессию",
    createCta: "весеннюю ИИ фотосессию",
    pricingOf: "весенней ИИ-фотосессии",
    resultNoun: "весенняя ИИ-фотосессия",
    examplesTitle: "Примеры весенней ИИ фотосессии",
    faq: childFaq(
      "Как сделать весеннюю ИИ фотосессию по фото?",
      {
        q: "Чем эта страница отличается от промтов про весну?",
        a: "Здесь серия луков. Каталог весенних промтов — один кадр.",
      },
      "Где сделать весеннее фото по промту?"
    ),
  }),
  "delovoy-stil": buildFotosessiiChildCopy({
    h1: "ИИ фотосессия в деловом стиле",
    creating: "ИИ фотосессии в деловом стиле",
    howToMake: "ии фотосессию в деловом стиле",
    createCta: "ИИ фотосессию в деловом стиле",
    pricingOf: "ИИ-фотосессии в деловом стиле",
    resultNoun: "ИИ-фотосессия в деловом стиле",
    examplesTitle: "Примеры ИИ фотосессии в деловом стиле",
    faq: childFaq(
      "Как сделать ИИ фотосессию в деловом стиле по фото?",
      {
        q: "Чем эта страница отличается от промтов для делового фото?",
        a: "Здесь серия луков. Каталог деловых промтов — один кадр.",
      },
      "Где сделать деловое фото по промту?"
    ),
  }),
  nyuborn: buildFotosessiiChildCopy({
    h1: "Ньюборн ИИ фотосессия",
    creating: "ньюборн ИИ фотосессии",
    howToMake: "ньюборн ии фотосессию",
    createCta: "ньюборн ИИ фотосессию",
    pricingOf: "ньюборн ИИ-фотосессии",
    resultNoun: "ньюборн ИИ-фотосессия",
    examplesTitle: "Примеры ньюборн ИИ фотосессии",
    faq: childFaq(
      "Как сделать ньюборн ИИ фотосессию по фото?",
      {
        q: "Чем эта страница отличается от детской ИИ-фотосессии?",
        a: "Здесь серия новорождённого. Детская страница — дети старше младенца.",
      },
      "Где сделать ньюборн-фото по промту?"
    ),
  }),
  "s-mashinoy": buildFotosessiiChildCopy({
    h1: "ИИ фотосессия с машиной",
    creating: "ИИ фотосессии с машиной",
    howToMake: "ии фотосессию с машиной",
    createCta: "ИИ фотосессию с машиной",
    pricingOf: "ИИ-фотосессии с машиной",
    resultNoun: "ИИ-фотосессия с машиной",
    examplesTitle: "Примеры ИИ фотосессии с машиной",
    faq: childFaq(
      "Как сделать ИИ фотосессию с машиной по фото?",
      {
        q: "Чем эта страница отличается от промтов для фото с машиной?",
        a: "Здесь серия луков у авто. Каталог промтов с машиной — один кадр.",
      },
      "Где сделать фото с машиной по промту?"
    ),
  }),
  "cherno-belye": buildFotosessiiChildCopy({
    h1: "Чёрно-белая ИИ фотосессия",
    creating: "чёрно-белой ИИ фотосессии",
    howToMake: "чёрно-белую ии фотосессию",
    createCta: "чёрно-белую ИИ фотосессию",
    pricingOf: "чёрно-белой ИИ-фотосессии",
    resultNoun: "чёрно-белая ИИ-фотосессия",
    examplesTitle: "Примеры чёрно-белой ИИ фотосессии",
    faq: childFaq(
      "Как сделать чёрно-белую ИИ фотосессию по фото?",
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
