/** RU copy for /foto-v-promt/ — SEO cluster «фото в промт». Source: docs/requirements/02-06-foto-v-promt-seo-copy.md */

export const FOTO_V_PROMT_HERO = {
  title: "Фото в промт",
  subtitle:
    "Создайте промт из фото или картинки за секунды: загрузите изображение в форму ниже — сервис сделает промт по картинке онлайн, без регистрации. Готовый текст можно вставить в Nano Banana, Midjourney или другую нейросеть. Нужен разбор прямо на сайтах? Установите расширение AI Image Describer для Chrome.",
} as const;

export const FOTO_V_PROMT_WIDGET = {
  title: "Промт по картинке онлайн — попробуйте сейчас",
  ariaLabel: "Live-разбор: фото в промт",
} as const;

export const FOTO_V_PROMT_HOW = {
  title: "Как получить промт из фото",
  subtitle:
    "Три способа перевести картинку в промт: на этой странице, в браузере через расширение или с любого сайта по правому клику.",
  steps: [
    "Загрузите фото или картинку в форму на PromptShot — получите промт по картинке онлайн без установки.",
    "Закрепите расширение AI Image Describer в Chrome для разбора изображений на любом сайте.",
    "Щёлкните правой кнопкой по картинке и запустите анализ из контекстного меню.",
    "Скопируйте готовый промпт для Nano Banana, Midjourney, DALL·E или Stable Diffusion.",
    "Дорабатывайте текст или используйте готовые промты из каталога PromptShot.",
  ] as const,
  promptSnippet:
    "Нужно создать промт из фото без подбора слов? Загрузите картинку — инструмент вернёт готовый текст для Nano Banana, Midjourney, DALL·E, Stable Diffusion и других моделей генерации по изображению.",
} as const;

export const FOTO_V_PROMT_FAQ = {
  title: "Частые вопросы",
  subtitle:
    "Ответы про фото в промт, промт из фото и промт по картинке онлайн.",
  items: [
    {
      q: "Что значит «фото в промт» и как это работает на PromptShot?",
      a: "Это перевод изображения в текстовый промт для нейросетей. На PromptShot загрузите фото в форму выше — сервис вернёт описание сцены для Nano Banana, Midjourney, DALL·E, Stable Diffusion и других моделей. Для разбора картинок на других сайтах установите расширение AI Image Describer для Chrome.",
    },
    {
      q: "Можно ли сделать промт по картинке бесплатно онлайн?",
      a: "Да. На этой странице доступен бесплатный разбор с дневным лимитом — загрузите JPG, PNG или WebP и получите промт без регистрации. Текст подойдёт для Nano Banana и других генераторов изображений. Расширение для Chrome даёт тот же инструмент прямо в браузере.",
    },
    {
      q: "Чем отличается «промт из фото» от «картинка в промт»?",
      a: "Это разные формулировки одного запроса: пользователь хочет получить текстовое описание изображения. И фото, и картинка обрабатываются одинаково — загрузка или вставка → готовый промт.",
    },
    {
      q: "Как создать промт из фото для Nano Banana, Midjourney или DALL·E?",
      a: "Загрузите снимок, выберите стиль промпта (фотореализм, Midjourney, Stable Diffusion или Flux), дождитесь результата и нажмите «Копировать промпт». Вставьте текст в Nano Banana, Midjourney, DALL·E, Stable Diffusion или другую модель.",
    },
    {
      q: "Нужно ли устанавливать программу или достаточно сайта?",
      a: "Для промт из фото онлайн достаточно этой страницы — работает в браузере без установки. Расширение Chrome нужно, если хотите получать промт по картинке прямо на Pinterest, в лентах и на любых сайтах.",
    },
    {
      q: "Сохраняется ли история промтов?",
      a: "Да. На странице и в расширении история хранится локально в браузере — можно вернуться к любому результату и снова скопировать промт. Данные не уходят в облако PromptShot.",
    },
    {
      q: "Что такое AI Image Describer и зачем расширение Chrome?",
      a: "AI Image Describer — расширение для Chrome, которое описывает любую картинку и возвращает промт. Установите его из Chrome Web Store, если нужен разбор изображений на сайтах, а не только на PromptShot. Готовые промты для вдохновения — в каталоге на главной.",
    },
  ] as const,
} as const;

export const FOTO_V_PROMT_CTA = {
  floatingLabel: "Промт из любой картинки",
} as const;

export const FOTO_V_PROMT_META = {
  title: "Фото в промт онлайн — промт из фото и картинки | PromptShot",
  description:
    "Превратите фото или картинку в готовый промт онлайн: загрузите изображение на PromptShot и получите текст для Nano Banana, Midjourney, DALL·E и Stable Diffusion. Бесплатный разбор на странице и расширение для Chrome.",
  jsonLdName: "Фото в промт — PromptShot",
} as const;

export type WidgetCopyKey =
  | "emptyTitle"
  | "emptyHint"
  | "chooseFile"
  | "analyzing"
  | "resultTitle"
  | "copy"
  | "tryAgain"
  | "errorConnection"
  | "errorGeneric"
  | "errorRateLimited"
  | "limitTitle"
  | "limitDescription"
  | "limitResetLine"
  | "limitGotIt"
  | "invalidType"
  | "tooLarge"
  | "readFailed"
  | "noticeFetchFailed"
  | "noticePickerRejected"
  | "resultScrollHint"
  | "errorInvalidUrl"
  | "tabAnalyze"
  | "tabHistory"
  | "historyIntro"
  | "historyRecognizeAgain"
  | "historyCopyPrompt"
  | "historyEmptyTitle"
  | "historyEmptyDescription"
  | "historyEmptyCta"
  | "authRequiredHint";

const WIDGET_COPY: Record<WidgetCopyKey, string> = {
  emptyTitle: "Загрузите фото или картинку — получите промт",
  emptyHint: "JPG или PNG, до 10 МБ",
  chooseFile: "Выбрать файл",
  analyzing: "Делаем промт из фото…",
  resultTitle: "Ваш промт",
  copy: "Копировать промпт",
  tryAgain: "Другой снимок",
  errorConnection: "Не удалось подключиться. Проверьте интернет и попробуйте снова.",
  errorGeneric: "Что-то пошло не так. Попробуйте другой файл.",
  errorRateLimited: "Дневной лимит использован. Попробуйте через 24 часа.",
  limitTitle: "Дневной лимит использован",
  limitDescription:
    "Вы использовали бесплатные разборы на сегодня. Лимит сбрасывается каждые 24 часа, чтобы инструмент оставался быстрым для всех.",
  limitResetLine: "Вы сможете разбирать снова примерно через 24 часа.",
  limitGotIt: "Понятно",
  invalidType: "Нужен файл JPG, PNG или WebP.",
  tooLarge: "Файл больше 10 МБ — выберите меньший.",
  readFailed: "Не удалось прочитать файл. Попробуйте другой.",
  noticeFetchFailed: "Не удалось автоматически загрузить картинку. Загрузите файл вручную.",
  noticePickerRejected: "Браузер не принял файл. Попробуйте перетащить его в зону загрузки.",
  resultScrollHint: "Прокрутите, чтобы прочитать весь промпт",
  errorInvalidUrl: "Введите корректную http(s)-ссылку на изображение.",
  tabAnalyze: "Разбор",
  tabHistory: "История",
  historyIntro:
    "Записи сохраняются в этом браузере на этой странице. Можно снова разобрать то же изображение в один клик.",
  historyRecognizeAgain: "Распознать снова",
  historyCopyPrompt: "Копировать промпт",
  historyEmptyTitle: "История пока пуста",
  historyEmptyDescription:
    "Разберите первое изображение — здесь появится история промптов. Всё хранится локально в браузере.",
  historyEmptyCta: "Разобрать изображение",
  authRequiredHint:
    "Для единого лимита с расширением войдите через Google на imageprompt.tools",
};

export function widgetCopy(key: WidgetCopyKey): string {
  return WIDGET_COPY[key];
}

export const PROMPT_REMIX_COPY = {
  title: "Настройте этот промт под себя",
  subtitle:
    "Мы взяли промт из карточки. Опишите, что изменить — стиль, объект, фон, настроение или формат. Фото загружать не нужно.",
  loadingCard: "Загружаем промт из карточки…",
  cardLoadError:
    "Не удалось загрузить промт из карточки. Откройте карточку заново.",
  originalLabel: "Исходный промт",
  changeLabel: "Что изменить?",
  changePlaceholder:
    "Например: сделай стиль более реалистичным, замени фон на вечерний город, добавь кинематографичный свет",
  submit: "Переделать промт",
  submitting: "Переделываем промт…",
  resultLabel: "Изменённый промт",
  copy: "Копировать промпт",
  tryAgain: "Изменить ещё раз",
  emptyChangeError: "Опишите, что нужно изменить в промте.",
  errorGeneric: "Что-то пошло не так. Попробуйте ещё раз.",
  errorRateLimited: "Слишком много запросов. Попробуйте чуть позже.",
  installHint:
    "Хотите делать так с любой картинкой в браузере? Установите расширение AI Image Describer.",
} as const;

export const PROMPT_REMIX_CARD_CTA = {
  title: "Изменить промт под себя",
  subtitle: "Перепишем этот промт под вашу идею",
  cta: "Изменить",
} as const;
