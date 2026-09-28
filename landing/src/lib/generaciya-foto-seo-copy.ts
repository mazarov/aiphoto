import {
  GENERACIYA_FOTO_PO_OPISANIYU_PATH,
  GENERACIYA_FOTO_SCENARIO_ROUTES,
  GENERACIYA_KARTINKA_PO_OPISANIYU_PATH,
  GENERACIYA_PO_FOTO_PATH,
  getGeneraciyaFotoScenarioPath,
} from "./generaciya-foto-routes";

/**
 * `/generaciya/foto-po-opisaniyu` — text-only generator. Owns the «фото по
 * описанию / по тексту / по промту» cluster (Wordstat head 57 865; Webmaster
 * 13–26.09: «сделать фото по описанию» 545/д, pos 11.4). Slots: H1 = main key,
 * Title ≠ H1 (main + live counter), one extra key per H2. «Картинка /
 * изображение» never in Title/H1/H2 here — that is `kartinka-po-opisaniyu`.
 */
export const GENERACIYA_FOTO_SEO = {
  metaTitle: "Сделать фото по описанию 📸 — ИИ онлайн, без студии и фотографа",
  metaDescription:
    "Опишите кадр словами — нейросеть сгенерирует реалистичное фото по описанию онлайн. Промт на русском, выбор модели и формата, файл сразу на скачивание.",
  h1: "Сделать фото по описанию",
  socialProofPrefix: "Более",
  socialProofSuffix: "человек уже сгенерировали ИИ фото",
  secondaryCta: "Выбрать и повторить",
  intro:
    "Генерация фото по описанию: напишите, кто в кадре, где и в каком свете, — нейросеть соберёт реалистичный кадр без студии и фотографа.",
  breadcrumb: "Фото по описанию",
  sectionBreadcrumb: "Генерация",
  chipHubLabel: "Сделать фото по описанию",
  chipHubAria: "Все шаблоны: сделать фото по описанию",
  starterByTextTitle: "Генерация по тексту",
  starterByTextLead: "Напишите сцену своими словами",
  starterByPhotoTitle: "С вашим фото",
  starterByPhotoLead: "Загрузите селфи — в генераторе выберите образ из каталога",
  generatorTitle: "Создать фото по промту или по тексту",
  generatorLead:
    "Напишите промт своими словами или возьмите готовый из идей ниже. Модель, формат и качество выбираются перед запуском.",
  generatorNote:
    "Для запуска нужен вход в PromptShot. Стоимость в кредитах показывается рядом с выбранной моделью до генерации.",
  examplesTitle: "ИИ фото по описанию: примеры и готовые промты",
  examplesIntro:
    "Каждый кадр создан по тексту. Откройте карточку — промт можно скопировать или сразу запустить.",
  examplesCta: "Больше идей для фото",
  examplesMoreHref: `${GENERACIYA_FOTO_PO_OPISANIYU_PATH}#primery`,
  howToTitle: "Как сделать фото ИИ за три шага",
  howToLead: "Описание → модель → файл",
  howToCta: "Создать фото",
  faqTitle: "Часто задаваемые вопросы",
} as const;

/**
 * Title with the live counter (homepage formula: key · emoji · number fact).
 * Below 1 000 completed jobs the number is not a fact worth a Title — fall back.
 */
export function buildGeneraciyaFotoMetaTitle(completedCount: number): string {
  if (!Number.isFinite(completedCount) || completedCount < 1000) {
    return GENERACIYA_FOTO_SEO.metaTitle;
  }
  const thousands = Math.floor(completedCount / 1000);
  const formatted = (thousands * 1000).toLocaleString("ru-RU");
  return `Сделать фото по описанию 📸 — ИИ онлайн, ${formatted}+ кадров уже создано`;
}

/** Live completed image jobs — never a Facee-scale marketing number. */
export function formatGeneraciyaFotoSocialProof(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) return null;
  const formatted = Math.trunc(count).toLocaleString("ru-RU");
  return `${GENERACIYA_FOTO_SEO.socialProofPrefix} ${formatted} ${GENERACIYA_FOTO_SEO.socialProofSuffix}`;
}

export const GENERACIYA_FOTO_HOW_TO_STEPS = [
  {
    n: "01",
    title: "Опишите кадр",
    text: "Кто или что в кадре, где происходит, какой свет и стиль — обычными словами, на русском",
  },
  {
    n: "02",
    title: "Выберите промт",
    text: "Оставьте свой текст или возьмите готовый из примеров и поправьте под задачу",
  },
  {
    n: "03",
    title: "Настройте и создайте",
    text: "Выберите модель, формат и качество, проверьте стоимость и запустите генерацию",
  },
] as const;

/** H2 «как работает» — extra key «фото из текста» (Wordstat 32 525). */
export const GENERACIYA_FOTO_HOW_IT_WORKS = {
  title: "Как нейросеть генерирует фото из текста",
  paragraphs: [
    "Модель читает описание целиком и строит кадр по смыслу, а не по отдельным словам: важны объект, место, свет, стиль и настроение. Чем конкретнее описание, тем ближе результат к задумке.",
    "В PromptShot несколько моделей: быстрая — для набросков и простых сцен, старшие — для сложных композиций, текста в кадре и высокого качества. Модель и стоимость выбираются перед запуском.",
  ],
  tipsTitle: "Как написать описание для фото",
  tips: [
    "Начните с главного: «девушка читает книгу», «мужчина в костюме у окна».",
    "Добавьте место и время: «в кофейне, утро», «на набережной, закат».",
    "Свет и стиль: «мягкий дневной свет, фотореализм» или «студийная вспышка, чёрно-белое».",
    "Формат кадра задаётся кнопкой — в тексте его писать не нужно.",
    "Слова «шедевр», «8k», «лучшее качество» не помогают. Конкретика помогает.",
  ],
} as const;

/**
 * `/generaciya/po-foto` — hub of the 22 «со своего снимка» scenarios.
 * Photo mode lives only here and on the children.
 */
export const GENERACIYA_PO_FOTO_SEO = {
  metaTitle: "Сделать фото ИИ по своему фото 🤳 — 22 сценария, без фотографа",
  metaDescription:
    "Загрузите свой снимок и выберите образ — нейросеть сделает фото ИИ с вашим лицом: пары, семья, день рождения, портрет. Промт готов, результат без студии.",
  h1: "Сделать фото ИИ по своему фото",
  intro:
    "Загрузите одно селфи и выберите сценарий — ИИ повторит кадр с вами: поза, свет и стиль из примера, лицо с вашего снимка.",
  breadcrumb: "По своему фото",
  chipHubLabel: "По своему фото",
  chipHubAria: "Все сценарии генерации по своему фото",
  starterByPhotoTitle: "С вашим фото",
  starterByPhotoLead: "Загрузите селфи — в генераторе выберите образ из каталога",
  generatorTitle: "Создать фото по промту и своему снимку",
  generatorLead:
    "Загрузите снимок — генератор откроет каталог образов. Промт уже готов, его можно поправить перед запуском.",
  examplesTitle: "Фото ИИ по референсу: примеры",
  examplesIntro:
    "Каждый кадр повторён с чужого примера по фото пользователя. Откройте карточку и нажмите «Повторить» со своим снимком.",
  howToTitle: "Как сделать ИИ фото со своим лицом",
  howToLead: "Снимок → образ → файл",
  howToCta: "Загрузить фото",
  faqTitle: "Часто задаваемые вопросы",
} as const;

export const GENERACIYA_PO_FOTO_HOW_TO_STEPS = [
  {
    n: "01",
    title: "Загрузите снимок",
    text: "Одно фото в анфас, с ровным светом, без фильтров — так лицо переносится точнее",
  },
  {
    n: "02",
    title: "Выберите образ",
    text: "Готовый сценарий из каталога или свой промт: одежда, фон, настроение",
  },
  {
    n: "03",
    title: "Запустите генерацию",
    text: "Выберите модель и формат, проверьте стоимость — кадр придёт за минуту",
  },
] as const;

/** Cross-links between the section's modes; shown on every hub as chips. */
export const GENERACIYA_MODE_LINKS = [
  {
    key: "foto",
    label: "Фото по описанию",
    text: "Реалистичный кадр только по тексту, без своего снимка.",
    href: GENERACIYA_FOTO_PO_OPISANIYU_PATH,
  },
  {
    key: "kartinka",
    label: "Картинка по описанию",
    text: "Иллюстрация, арт или стилизованное изображение по тексту.",
    href: GENERACIYA_KARTINKA_PO_OPISANIYU_PATH,
  },
  {
    key: "po-foto",
    label: "По своему фото",
    text: "Загрузите селфи — ИИ повторит образ с вашим лицом.",
    href: GENERACIYA_PO_FOTO_PATH,
  },
  {
    key: "fotosessiya",
    label: "ИИ фотосессия",
    text: "Серия кадров в одном стиле по вашим фото.",
    href: "/ii-fotosessiya",
  },
] as const;

export function generaciyaModeLinksExcept(
  key: (typeof GENERACIYA_MODE_LINKS)[number]["key"]
) {
  return GENERACIYA_MODE_LINKS.filter((item) => item.key !== key);
}

export const GENERACIYA_FOTO_THEME_ITEMS = GENERACIYA_FOTO_SCENARIO_ROUTES.map(
  (route) => ({
    title: route.label,
    href: getGeneraciyaFotoScenarioPath(route.slug),
    dimension: route.dimension,
    tagValue: route.tagValue,
  })
);

/** Photo hub: themes carry the «ИИ фото по теме» key; children are «со своего снимка». */
export const GENERACIYA_FOTO_THEMES = {
  title: "Сделать ИИ фото по теме",
  lead: "Пара, семья, день рождения, портрет — откройте сценарий и создайте кадр со своего снимка.",
  allHref: "#primery",
  allLabel: "Смотреть все готовые шаблоны",
  items: GENERACIYA_FOTO_THEME_ITEMS,
} as const;

/** Text hub: the same 22 links, but as navigation without a key — photo mode is not promised here. */
export const GENERACIYA_FOTO_SCENARIOS_NAV = {
  title: "Сценарии: пары, семья, день рождения",
  lead: "Нужен кадр со своим лицом? Откройте сценарий — там генерация по вашему фото.",
} as const;

/** Variant B / treatment offer, same paywall UI, checkout via YooKassa. */
export const GENERACIYA_FOTO_PRICING = {
  variant: "treatment",
  returnPath: GENERACIYA_FOTO_PO_OPISANIYU_PATH,
} as const;

/** Photo hub only: every tool edits the user's uploaded photo. Lead holds «изменить фото по описанию» (Webmaster 165/д, pos 16.5). */
export const GENERACIYA_FOTO_TOOLS = {
  title: "Редактирование фото с ИИ",
  lead: "Изменить фото по описанию: фон, причёска, лишние объекты, качество — по вашему снимку",
  tryLabel: "Попробовать",
  items: [
    {
      title: "ИИ-редактор фото",
      text: "Редактируйте фото онлайн нейросетью: меняйте фон, цвета и детали по тексту",
      prompt:
        "Отредактируй загруженное фото. Сохрани того же человека, лицо, внешность, тело и кадр. Измени только то, что указано: [что изменить: фон, цвет одежды, освещение или деталь]. Фотореалистичный результат, естественный свет, без лишних людей, без текста и водяного знака.",
    },
    {
      title: "Изменить причёску",
      text: "Примерьте новую причёску на своё фото",
      prompt:
        "Измени только причёску человека на загруженном фото. Сохрани то же лицо, внешность, кожу, одежду, позу и фон. Новая причёска: [опишите стрижку, длину, цвет и укладку]. Фотореалистичные волосы, естественное срастание с головой, без лишних людей и текста.",
    },
    {
      title: "Удалить объект",
      text: "Уберите лишние предметы, людей и текст с фотографии",
      prompt:
        "Убери лишний элемент с загруженного фото и естественно восстанови фон. Сохрани главного человека, внешность, позу, свет и остальную сцену. Убрать: [что убрать: предмет, человек на фоне или текст]. Фотореалистичная чистка, без размытого пятна, без лишних объектов и водяного знака.",
    },
    {
      title: "Улучшить качество",
      text: "Повысьте чёткость и качество вашего фото с помощью нейросети",
      prompt:
        "Улучши загруженное фото. Повысь резкость, ясность и естественную детализацию. Сохрани того же человека, внешность, композицию, цвета и стиль. Не меняй стиль, одежду и фон, не добавляй объекты и текст. Фотореалистично, чисто, без водяного знака.",
    },
  ],
} as const;

/** Quick filters on `/generaciya-foto`, ordered by user popularity (desc). */
export const GENERACIYA_FOTO_SCENARIOS = [
  {
    label: "Пары",
    href: "/promty-dlya-foto-par",
    dimension: "audience_tag",
    value: "para",
  },
  {
    label: "День рождения",
    href: "/sobytiya/den-rozhdeniya",
    dimension: "occasion_tag",
    value: "den_rozhdeniya",
  },
  {
    label: "Семья",
    href: "/promty-dlya-semejnogo-foto",
    dimension: "audience_tag",
    value: "semya",
  },
  {
    label: "Девушки",
    href: "/promty-dlya-foto-devushki",
    dimension: "audience_tag",
    value: "devushka",
  },
  {
    label: "С машиной",
    href: "/promty-dlya-foto/s-mashinoy",
    dimension: "object_tag",
    value: "s_mashinoy",
  },
  {
    label: "Мужчины",
    href: "/promty-dlya-foto-muzhchiny",
    dimension: "audience_tag",
    value: "muzhchina",
  },
  {
    label: "Малыш",
    href: "/promty-dlya-foto-malysh",
    dimension: "audience_tag",
    value: "malysh",
  },
  {
    label: "В форме",
    href: "/v-forme",
    dimension: "object_tag",
    value: "v_forme",
  },
  {
    label: "Дети",
    href: "/promty-dlya-detskih-foto",
    dimension: "audience_tag",
    value: "detskie",
  },
  {
    label: "С дочкой",
    href: "/promty-dlya-foto-s-dochkoy",
    dimension: "audience_tag",
    value: "s_dochkoy",
  },
  {
    label: "На море",
    href: "/promty-dlya-foto/na-more",
    dimension: "object_tag",
    value: "na_more",
  },
  {
    label: "С мамой",
    href: "/promty-dlya-foto-s-mamoy",
    dimension: "audience_tag",
    value: "s_mamoy",
  },
  {
    label: "Чёрно-белое",
    href: "/stil/cherno-beloe",
    dimension: "style_tag",
    value: "cherno_beloe",
  },
  {
    label: "С подругой",
    href: "/promty-dlya-foto-s-podrugoy",
    dimension: "audience_tag",
    value: "s_podrugoy",
  },
  {
    label: "С шампанским",
    href: "/promty-dlya-foto/s-shampanskim",
    dimension: "object_tag",
    value: "s_shampanskim",
  },
  {
    label: "Селфи",
    href: "/stil/selfi",
    dimension: "style_tag",
    value: "selfi",
  },
  {
    label: "Беременная",
    href: "/promty-dlya-foto-beremennaya",
    dimension: "audience_tag",
    value: "beremennaya",
  },
  {
    label: "Студийное",
    href: "/stil/studiynoe",
    dimension: "style_tag",
    value: "studiynoe",
  },
  {
    label: "В зеркале",
    href: "/promty-dlya-foto/v-zerkale",
    dimension: "object_tag",
    value: "v_zerkale",
  },
  {
    label: "Коллаж",
    href: "/stil/kollazh",
    dimension: "style_tag",
    value: "kollazh",
  },
] as const;

/** «Другие режимы» block — same cards on every hub of the section minus the current one. */
export const GENERACIYA_FOTO_CAPABILITIES = generaciyaModeLinksExcept("foto").map(
  (item) => ({ title: item.label, text: item.text, href: item.href })
);

export const GENERACIYA_FOTO_MORE_TITLE = "Другие режимы генерации";
export const GENERACIYA_FOTO_MORE_LEAD =
  "Картинка по тексту, кадр со своим лицом или серия фото — выберите, что нужно.";

export type GeneraciyaFotoFaqLink = {
  href: string;
  label: string;
};

export type GeneraciyaFotoFaqPart = string | GeneraciyaFotoFaqLink;

/** Structural FAQ entry — shared by all `/generaciya/*` hubs. */
export type GeneraciyaFaqEntry = {
  q: string;
  a: readonly GeneraciyaFotoFaqPart[];
};

export function flattenGeneraciyaFotoFaqAnswer(
  parts: readonly GeneraciyaFotoFaqPart[]
): string {
  return parts
    .map((part) => (typeof part === "string" ? part : part.label))
    .join("");
}

export function isGeneraciyaFotoFaqLink(
  part: GeneraciyaFotoFaqPart
): part is GeneraciyaFotoFaqLink {
  return typeof part !== "string";
}

const GENERACIYA_FOTO_FAQ_SOURCE = [
  {
    q: "Где скачать PromptShot на телефон?",
    a: [
      "Отдельного приложения пока нет. PromptShot работает через сайт, но его можно добавить на главный экран смартфона и открывать как обычное приложение – с иконки на телефоне.",
    ],
  },
  {
    q: "Как сделать фото по описанию?",
    a: [
      "Опишите кадр в ",
      { href: "#generator", label: "генераторе" },
      ": кто в кадре, где, какой свет. Или откройте пример в «",
      { href: "#primery", label: "ИИ фото по описанию" },
      "» и поправьте готовый промт — затем запустите генерацию и скачайте файл.",
    ],
  },
  {
    q: "Как сделать фото ИИ по своему фото?",
    a: [
      "Загрузите одно селфи в ",
      { href: "#generator", label: "генераторе" },
      " — откроется каталог образов. Выберите сценарий, при желании поправьте промт и запустите генерацию: лицо возьмётся с вашего снимка, остальное — из образа.",
    ],
  },
  {
    q: "Нужна ли регистрация, чтобы сделать фото по описанию?",
    a: [
      "Смотреть примеры и копировать промты можно без входа. Чтобы запустить генерацию и скачать файл, нужен вход — так результат сохраняется в вашем аккаунте.",
    ],
  },
  {
    q: "Чем фото по описанию отличается от картинки по описанию?",
    a: [
      "Здесь генератор настроен на реалистичный снимок: люди, свет, фактура как у фотографии. Если нужна иллюстрация, арт или стилизованное изображение — откройте ",
      { href: GENERACIYA_KARTINKA_PO_OPISANIYU_PATH, label: "картинку по описанию" },
      ".",
    ],
  },
  {
    q: "Можно ли сделать фото по описанию со своим лицом?",
    a: [
      "Да, но на другой странице: ",
      { href: GENERACIYA_PO_FOTO_PATH, label: "генерация по своему фото" },
      " берёт ваш снимок как референс, а описание — как сцену.",
    ],
  },
  {
    q: "Какой формат и размер фото получится?",
    a: [
      "Форматы 1:1, 4:3, 3:4, 16:9, 9:16 и другие; качество до 4K выбирается перед запуском. Файл — PNG без потери качества.",
    ],
  },
  {
    q: "Можно ли изменить своё фото по описанию?",
    a: [
      "Да. Загрузите снимок на странице ",
      { href: GENERACIYA_PO_FOTO_PATH, label: "генерации по своему фото" },
      " и опишите, что изменить: фон, причёску, лишние объекты или качество.",
    ],
  },
  {
    q: "Какой ИИ лучше сделает фото?",
    a: [
      "Модель выбирается перед запуском в генераторе. Для быстрого результата подойдёт Flash, для сложных сцен — Pro или Grok. Стоимость показывается рядом с выбранной моделью до запуска.",
    ],
  },
  {
    q: "Можно ли сделать фото ИИ онлайн без студии?",
    a: [
      "Да. PromptShot создаёт ИИ фото по вашему снимку или текстовому описанию — фотограф, студия и визажист не нужны. Достаточно загрузить фото и выбрать образ.",
    ],
  },
  {
    q: "Где взять готовый промт для генерации фото?",
    a: [
      "В блоке «",
      { href: "#primery", label: "Примеры" },
      "» откройте карточку и запустите генерацию. Свой текст можно написать в ",
      { href: "#generator", label: "генераторе" },
      ".",
    ],
  },
  {
    q: "Как создать фото с собой в PromptShot?",
    a: [
      "Откройте блок «",
      { href: "#primery", label: "Примеры" },
      "» и выберите готовый образ. Ещё один вариант – загрузить снимок в ",
      { href: "#generator", label: "генераторе" },
      " и написать промт: образ, фон, одежду, настроение, ракурс и важные детали. Чем точнее описание, тем ближе результат к задумке.",
    ],
  },
  {
    q: "Можно ли сгенерировать фото по описанию?",
    a: [
      "Да. В ",
      { href: "#generator", label: "генераторе" },
      " опишите образ, одежду, фон, настроение и детали кадра. Затем загрузите своё фото и запустите генерацию.",
    ],
  },
  {
    q: "Как писать промт, чтобы сгенерировать фото?",
    a: [
      "Опишите кадр своими словами: кто в кадре, одежда, фон, свет. Или возьмите готовый промт в «",
      { href: "#primery", label: "Примерах" },
      "» и поправьте текст. Запускайте генерацию здесь.",
    ],
  },
  {
    q: "Нужен подробный промт, чтобы создать фото?",
    a: [
      "Короткого описания часто хватает. Если кадр сложный — добавьте одежду, фон, ракурс и настроение.",
    ],
  },
  {
    q: "Есть шаблоны промтов, чтобы сразу сделать фото?",
    a: [
      "Да. В ",
      { href: "#temy", label: "подборках по темам" },
      " и в ленте идей уже есть шаблоны. Выберите и создайте фото со своего снимка.",
    ],
  },
  {
    q: "Можно ли сделать фото по описанию бесплатно?",
    a: [
      "Вход, просмотр примеров и копирование любого промта — бесплатно. Генерация файла списывает кредиты: стоимость показывается рядом с моделью до запуска, пакеты — в ",
      { href: "#tarify", label: "тарифах" },
      ".",
    ],
  },
  {
    q: "Что такое ИИ фото?",
    a: [
      "ИИ фото – это изображение, созданное нейросетью на основе ваших снимков и текстового описания. Оно может выглядеть как обычная фотография, но для его создания не нужны фотограф, студия, визажист и аренда локации.",
    ],
  },
  {
    q: "Для чего можно использовать ИИ фото?",
    a: [
      "ИИ фото подходит для аватаров, соцсетей, рабочих профилей, творческих образов, поздравлений, анкет и личного контента. Такой формат удобен, когда нужны новые снимки, но нет времени на полноценную фотосессию.",
    ],
  },
  {
    q: "Можно ли сделать ИИ фото без навыков дизайна?",
    a: [
      "Да. Чтобы сделать ИИ фото, не нужно разбираться в редакторах, слоях, масках и ретуши. Вы загружаете подходящие снимки и описываете нужный образ обычными словами, а PromptShot создаёт изображение на его основе.",
    ],
  },
  {
    q: "Как собрать серию кадров в одном стиле?",
    a: [
      "Для нескольких кадров в одном образе откройте ",
      {
        href: "/ii-fotosessiya",
        label: "ИИ фотосессию",
      },
      ". Для одного кадра используйте генератор на этой странице или ",
      {
        href: getGeneraciyaFotoScenarioPath("pary"),
        label: "создание фото для пары",
      },
      ".",
    ],
  },
  {
    q: "Можно ли сделать совместное фото, если нет общего снимка?",
    a: [
      "Да. Откройте ",
      {
        href: getGeneraciyaFotoScenarioPath("pary"),
        label: "генерацию для пар",
      },
      ", загрузите два отдельных изображения и опишите будущий кадр. Например: «пара обнимается на вечерней улице» или «двое друзей стоят в студии и смотрят в камеру».",
    ],
  },
  {
    q: "Как создать «Портрет поколения» для семьи?",
    a: [
      "Загрузите фото в ",
      {
        href: getGeneraciyaFotoScenarioPath("semya"),
        label: "генерацию для семьи",
      },
      ", где есть два и более человека. Если общего снимка нет, заранее соберите простой коллаж в любом редакторе и добавьте его в сервис.",
    ],
  },
  {
    q: "Можно ли использовать фото как пример?",
    a: [
      "Да. Загрузите референс в ",
      { href: "#generator", label: "генератор" },
      ", чтобы показать сервису желаемую позу, фон, стиль одежды, свет или настроение. Если нужен текст промта по картинке — откройте ",
      { href: "/foto-v-promt", label: "Фото в промт" },
      ".",
    ],
  },
  {
    q: "Можно ли сделать бесплатную фотосессию через ИИ?",
    a: [
      "После регистрации доступны тестовые генерации. Это помогает оценить качество сервиса и понять, подходит ли вам результат. Чтобы сделать бесплатную фотосессию через ИИ, начните с пробных вариантов, а для изображений без водяных знаков и в улучшенном качестве выберите ",
      { href: "/pricing", label: "платный тариф" },
      ".",
    ],
  },
  {
    q: "Что делать, если изображение не похоже на меня?",
    a: [
      "Попробуйте уточнить промт: попросите сохранить черты лица, форму носа, глаз, губ, цвет волос и тон кожи. Если результат всё равно далёк от вас, загрузите другой исходный снимок: в анфас, с ровным освещением, без сильной эмоции, фильтров и искажений.",
    ],
  },
  {
    q: "Что делать, если токены не появились после оплаты?",
    a: [
      "Проверьте, что вы вошли в аккаунт с тем же email, который использовали при оплате. Если токены всё равно не начислились, ",
      {
        href: "mailto:support_ru@promptshot.ru",
        label: "напишите в поддержку",
      },
      " и укажите email регистрации и оплаты. Так мы быстрее найдём операцию и проверим пакет.",
    ],
  },
  {
    q: "Как оплатить тариф?",
    a: [
      "После регистрации на сайте откройте ",
      { href: "/pricing", label: "тарифы" },
      ". Ещё один способ – нажать на значок токена и выбрать подходящий пакет.",
    ],
  },
  {
    q: "Можно ли оплатить российской картой?",
    a: ["Да, оплата доступна с российских банковских карт."],
  },
  {
    q: "Безопасна ли оплата?",
    a: [
      "Да. Платёж проходит на стороне платёжного провайдера. PromptShot не хранит данные вашей карты и не получает к ним доступ.",
    ],
  },
  {
    q: "Можно ли написать промт на русском?",
    a: [
      "Да. Пишите как фотографу: кто в кадре, одежда, фон, настроение. Русского текста хватает, чтобы сделать фото.",
    ],
  },
  {
    q: "Как получить промт по картинке?",
    a: [
      "Загрузите изображение в «",
      { href: "/foto-v-promt", label: "Фото в промт" },
      "» — сервис вернёт текст. Потом его можно сразу запустить в ",
      { href: "#generator", label: "генераторе" },
      " на этой странице.",
    ],
  },
  {
    q: "Какие изображения можно создавать?",
    a: [
      "Вы можете делать портреты, деловые фото, романтичные кадры, праздничные образы, снимки для соцсетей, стилизованные фотографии и креативные визуалы. Главное, чтобы контент соответствовал ",
      { href: "/terms", label: "правилам сервиса" },
      ".",
    ],
  },
  {
    q: "Можно ли сгенерировать картинку, не только фото?",
    a: [
      "Да, по тексту можно получить и картинку. Основной сценарий страницы — фото с тобой. Для логотипа и сложной графики этот генератор слабее.",
    ],
  },
  {
    q: "Для чего подходит ИИ для фото?",
    a: [
      "ИИ для фото удобен, когда нужно быстро получить новые изображения без съёмки. С его помощью можно подготовить портрет, аватар, фото для сайта, визуал для анкеты, обложку или серию снимков в одном стиле.",
    ],
  },
  {
    q: "Можно ли сгенерировать фото без водяного знака?",
    a: [
      "Да, на платном пакете: он открывает улучшенное качество и изображения без водяных знаков. Пакеты — в ",
      { href: "#tarify", label: "тарифах" },
      ".",
    ],
  },
] as const;

export type GeneraciyaFotoFaqItem = GeneraciyaFaqEntry;

function pickFaq(questions: readonly string[]): GeneraciyaFaqEntry[] {
  const byQ = new Map<string, GeneraciyaFaqEntry>(
    GENERACIYA_FOTO_FAQ_SOURCE.map((item) => [item.q, item])
  );
  return questions
    .map((q) => byQ.get(q))
    .filter((item): item is GeneraciyaFaqEntry => Boolean(item));
}

/** `/generaciya/foto-po-opisaniyu` — text-only questions; «своё фото» only as a cross-link. */
export const GENERACIYA_FOTO_FAQ = pickFaq([
  "Как сделать фото по описанию?",
  "Можно ли сделать фото по описанию бесплатно?",
  "Нужна ли регистрация, чтобы сделать фото по описанию?",
  "Можно ли написать промт на русском?",
  "Какой ИИ лучше сделает фото?",
  "Как писать промт, чтобы сгенерировать фото?",
  "Нужен подробный промт, чтобы создать фото?",
  "Чем фото по описанию отличается от картинки по описанию?",
  "Можно ли сделать фото по описанию со своим лицом?",
  "Можно ли изменить своё фото по описанию?",
  "Какой формат и размер фото получится?",
  "Можно ли сгенерировать фото без водяного знака?",
  "Можно ли оплатить российской картой?",
]);

/** `/generaciya/po-foto` — photo-mode questions. */
export const GENERACIYA_PO_FOTO_FAQ = pickFaq([
  "Как сделать фото ИИ по своему фото?",
  "Как создать фото с собой в PromptShot?",
  "Что делать, если изображение не похоже на меня?",
  "Можно ли использовать фото как пример?",
  "Можно ли сделать совместное фото, если нет общего снимка?",
  "Как создать «Портрет поколения» для семьи?",
  "Как собрать серию кадров в одном стиле?",
  "Где взять готовый промт для генерации фото?",
  "Какой ИИ лучше сделает фото?",
  "Можно ли сгенерировать фото без водяного знака?",
  "Можно ли оплатить российской картой?",
]);
