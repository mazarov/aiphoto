/** RU copy for /foto-v-promt/ — no i18n. Source: imageprompt ru.json Marketing + PromptSceneLite. */

export const FOTO_V_PROMT_HERO = {
  title: "Фото в промпт",
  subtitle:
    "Что даёт AI Image Describer: экономьте время — опишите картинку текстом в один клик и скопируйте готовый промпт, чтобы собрать похожее изображение.",
} as const;

export const FOTO_V_PROMT_HOW = {
  title: "Как это работает",
  subtitle:
    "AI Image Describer — расширение для Chrome: за секунды превращает любую картинку в понятное текстовое описание и готовый промпт для творчества. Это быстрый image describer прямо в браузере: опишите изображение в привычном рабочем процессе без лишних вкладок, без регистрации и без вставки ссылок в кучу разных сервисов.",
  steps: [
    "Закрепите AI Image Describer на панели инструментов Chrome.",
    "Нажмите на значок расширения и загрузите или вставьте картинку, чтобы получить описание этого фото.",
    "Или щёлкните правой кнопкой по любому изображению на сайте и запустите анализ прямо из контекстного меню.",
    "Скопируйте текст промпта.",
    "Дорабатывайте, смешивайте и переиспользуйте.",
  ] as const,
  promptSnippet:
    "Если вы смотрели на изображение и не могли подобрать слова — ai image describer сделает это за вас. Загрузите картинку, и инструмент вернёт чёткий промпт для этой сцены, который можно сразу вставить в Nano Banana, Midjourney, DALL·E, Stable Diffusion или любую модель генерации по изображению.",
} as const;

export const FOTO_V_PROMT_FAQ = {
  title: "Частые вопросы",
  subtitle:
    "AI Image Describer в браузере — коротко про описание картинок в промпт и расширение Chrome.",
  items: [
    {
      q: "Что на самом деле делает AI Image Describer, когда вы просите описать это изображение?",
      a: "Он читает содержание картинки и возвращает аккуратное описание-в-подсказку, которое можно скопировать и использовать снова.",
    },
    {
      q: "Что делать, если нужно именно «сделай описание этой картинки под AI-сгенерированную часть»?",
      a: "Вставьте или загрузите изображение. Сервис прочитает кадр и выдаст сжатый объективный визуальный текст для промпта к модели: объекты, композицию, свет и стиль.",
    },
    {
      q: "Можно ли использовать это для picture-to-prompt в Midjourney или DALL·E?",
      a: "Да. Это работает как AI-описатель фото под популярные модели, а режим «описать это изображение» обрабатывает картинки по одной.",
    },
    {
      q: "Сохраняются ли мои промпты?",
      a: "Да. Расширение ведёт локальную историю результатов описания — можно вернуться к любому промпту. История хранится в браузере, а не в чужом облаке.",
    },
    {
      q: "Подойдёт ли любая картинка?",
      a: "Поддерживаются обычные форматы: PNG, JPG и WebP.",
    },
    {
      q: "Можно ли для референсов?",
      a: "Да. Многие используют AI Image Describer с сохранёнными референсами, досками вдохновения, макетами, визуальным ресёрчем и материалами с веба.",
    },
    {
      q: "Нужен ли аккаунт?",
      a: "Нет. Установите расширение, нажмите на иконку и начинайте — без почты, без карты и без ожидания до первого результата.",
    },
  ] as const,
} as const;

export const FOTO_V_PROMT_CTA = {
  floatingLabel: "Добавить в Chrome",
} as const;

export const FOTO_V_PROMT_META = {
  title: "Фото в промпт — AI Image Describer, расширение Chrome | PromptShot",
  description:
    "Превратите любое фото в готовый промпт для Midjourney, DALL·E, Stable Diffusion и других моделей. Live-разбор на PromptShot, расширение AI Image Describer для Chrome.",
} as const;

export type WidgetCopyKey =
  | "styleLabel"
  | "stylePhotoreal"
  | "styleMidjourney"
  | "styleSd"
  | "styleFlux"
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
  | "pasteHint"
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
  styleLabel: "Стиль промпта",
  stylePhotoreal: "Фотореализм",
  styleMidjourney: "Midjourney",
  styleSd: "Stable Diffusion",
  styleFlux: "Flux",
  emptyTitle: "Перетащите изображение или вставьте из буфера",
  emptyHint: "JPG или PNG, до 10 МБ",
  chooseFile: "Выбрать файл",
  analyzing: "Разбираем изображение…",
  resultTitle: "Промпт",
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
  pasteHint:
    "Подсказка: можно вставить прямую ссылку на картинку (https://…) или скопировать картинку и нажать Ctrl+V (⌘V на Mac).",
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
