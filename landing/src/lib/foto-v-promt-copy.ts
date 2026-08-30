/** RU copy for /foto-v-promt/ — ключ «фото в промт». Source: docs/21-08-foto-v-promt-seo.md */

export const FOTO_V_PROMT_HERO = {
  title: "Фото в промт",
  subtitle: "Загрузите снимок в форму ниже — сервис напишет промт.",
  generateLead: "Уже есть текст?",
  generateLinkLabel: "Создайте фото по промту",
  generateHref: "/generaciya-foto",
} as const;

export const FOTO_V_PROMT_WIDGET = {
  title: "Промт по фото",
  subtitle:
    "10 разборов в сутки бесплатно — без регистрации. Скопируйте промт или сразу сгенерируйте кадр.",
  ariaLabel: "Промт по фото: загрузка снимка",
} as const;

export const FOTO_V_PROMT_HOW = {
  title: "Как получить промт из фото",
  subtitle:
    "Загрузите файл в форму на этой странице — программу ставить не нужно. Расширение понадобится, если разбираете картинку на Pinterest, Instagram или другом сайте.",
  steps: [
    "Загрузите фото в форму — сервис сделает из фото промт за несколько секунд.",
    "Скопируйте готовый текст или нажмите «Сгенерировать», чтобы получить кадр.",
    "Чтобы разобрать картинку на другом сайте, установите расширение AI Image Describer.",
  ] as const,
  promptSnippet:
    "Сервис пишет промт по картинке и промт по изображению: что в кадре, свет, детали. Загрузили файл — получили текст; так же работает картинка в промт и фото в промпт.",
} as const;

export const FOTO_V_PROMT_FAQ = {
  title: "Частые вопросы",
  subtitle: "Перед тем как загрузить снимок",
  items: [
    {
      q: "Что значит «фото в промт»?",
      a: "Сервис смотрит на снимок и пишет текст — что на фото, свет, композиция. Его можно сразу использовать как промт.",
    },
    {
      q: "Как сделать промт по фото?",
      a: "Загрузите снимок в форму выше. Готовый текст появится через несколько секунд.",
    },
    {
      q: "Сколько стоит разбор?",
      a: "10 разборов в сутки бесплатно, без регистрации. Дальше — 1 токен за разбор.",
    },
    {
      q: "Нужно ли ставить программу?",
      a: "Нет, всё работает в браузере на этой странице. Расширение — если разбираете картинки на Pinterest, Instagram или других сайтах.",
    },
    {
      q: "Чем это отличается от генерации фото?",
      a: "Здесь фото превращается в текст. Чтобы сделать кадр по готовому промту — откройте «Сгенерировать фото».",
    },
    {
      q: "Как сделать описание фото для нейросети?",
      a: "Загрузите снимок в форму — сервис опишет сцену. Это готовый промт, не распознавание надписей на фото.",
    },
    {
      q: "Где сделать промт по фото?",
      a: "Здесь, в форме на этой странице. Ничего устанавливать не нужно.",
    },
    {
      q: "Сервис читает текст с фото?",
      a: "Нет. Мы не снимаем надписи с вывесок и скриншотов — как OCR. Сервис описывает картинку: что в кадре, свет, детали — из этого получается промт.",
    },
  ] as const,
} as const;

export const FOTO_V_PROMT_META = {
  title: "Фото в промт онлайн — бесплатно, 10 разборов | PromptShot",
  description:
    "Загрузите снимок — сервис сделает промт по фото для нейросети. 10 разборов в сутки без регистрации. Скопируйте промт и сделайте фото.",
  jsonLdName: "Фото в промт — PromptShot",
} as const;

export type WidgetCopyKey =
  | "emptyTitle"
  | "emptyLead"
  | "emptyDo"
  | "emptyDont"
  | "emptyHint"
  | "chooseFile"
  | "analyzing"
  | "resultTitle"
  | "copy"
  | "copied"
  | "copyFailed"
  | "generate"
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
  | "authRequiredHint"
  | "quotaFreeLine"
  | "quotaChipToday"
  | "quotaChipPaid"
  | "quotaChipSignIn"
  | "quotaChipTopUp"
  | "paidWarning"
  | "paidSuccess"
  | "retryAnalyze"
  | "signInContinue"
  | "noCreditsTitle"
  | "noCreditsDescription"
  | "topUpTokens"
  | "quotaUnavailable";

const WIDGET_COPY: Record<WidgetCopyKey, string> = {
  emptyTitle: "Какая картинка вам нравится?",
  emptyLead:
    "Загрузите референс из Pinterest, Instagram или любого сайта. Получите готовый промт для любой модели генерации изображений",
  emptyDo: "Pinterest или сайт",
  emptyDont: "Своё селфи",
  emptyHint: "JPG, PNG или WebP · до 10 МБ",
  chooseFile: "Выбрать картинку",
  analyzing: "Делаем промт из референса…",
  resultTitle: "Ваш промт",
  copy: "Копировать промпт",
  copied: "Скопировано",
  copyFailed: "Не удалось скопировать",
  generate: "Сгенерировать",
  tryAgain: "Другой референс",
  errorConnection: "Не удалось подключиться. Проверьте интернет и попробуйте снова.",
  errorGeneric: "Что-то пошло не так. Попробуйте другой файл.",
  errorRateLimited:
    "Бесплатные разборы на сегодня закончились. Войдите, чтобы продолжить — дальше 1 токен за анализ.",
  limitTitle: "Бесплатные разборы на сегодня закончились",
  limitDescription: "Войдите в PromptShot — дальше каждый разбор стоит 1 токен.",
  limitResetLine: "После входа следующий разбор спишет 1 токен с баланса.",
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
    "Дальше анализ доступен только после входа в PromptShot. Каждый следующий разбор — 1 токен.",
  quotaFreeLine: "бесплатных сегодня",
  quotaChipToday: "сегодня",
  quotaChipPaid: "1 токен",
  quotaChipSignIn: "Войти",
  quotaChipTopUp: "Пополнить",
  paidWarning: "Анализ спишет 1 токен",
  paidSuccess: "Списан 1 токен",
  retryAnalyze: "Повторить анализ",
  signInContinue: "Войти и продолжить",
  noCreditsTitle: "Недостаточно токенов",
  noCreditsDescription: "Пополните баланс — разбор стоит 1 токен.",
  topUpTokens: "Пополнить токены",
  quotaUnavailable: "Сервис лимитов временно недоступен. Попробуйте ещё раз.",
};

export function widgetCopy(key: WidgetCopyKey): string {
  return WIDGET_COPY[key];
}

export const ANALYZE_QUOTA_AUTH_SUBTITLE =
  "Лимит на сегодня исчерпан. Войдите — дальше 1 токен за разбор.";

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
  copied: "Скопировано",
  copyFailed: "Не удалось скопировать",
  tryAgain: "Изменить ещё раз",
  emptyChangeError: "Опишите, что нужно изменить в промте.",
  errorGeneric: "Что-то пошло не так. Попробуйте ещё раз.",
  errorUnchanged:
    "Промпт не изменился. Сформулируйте правку иначе и попробуйте ещё раз.",
  errorRateLimited: "Слишком много запросов. Попробуйте чуть позже.",
  installHint:
    "Хотите делать так с любой картинкой в браузере? Установите расширение AI Image Describer.",
} as const;

export const PROMPT_REMIX_CARD_CTA = {
  title: "Изменить промт под себя",
  subtitle: "Перепишем этот промт под вашу идею",
  cta: "Изменить",
} as const;
