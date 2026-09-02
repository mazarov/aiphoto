/**
 * `/llms.txt` — SSOT for Lighthouse Agentic Browsing + llmstxt.org.
 * Format contract (Lighthouse 13.3+): Markdown H1, at least one `[text](url)`
 * link, body longer than 50 characters. Missing file is N/A; a malformed
 * file fails the audit.
 */
export const LLMS_TXT_H1_RE = /^\s*#\s+.+/m;
export const LLMS_TXT_MARKDOWN_LINK_RE = /\[[^\]]+\]\([^)\s]+\)/;
export const LLMS_TXT_MIN_CHARS = 50;

export function siteOriginFromEnv(
  siteUrl = process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://promptshot.ru")
): string {
  return siteUrl.replace(/\/+$/, "");
}

export function isLlmsTxtFormatValid(body: string): boolean {
  return (
    body.length >= LLMS_TXT_MIN_CHARS &&
    LLMS_TXT_H1_RE.test(body) &&
    LLMS_TXT_MARKDOWN_LINK_RE.test(body)
  );
}

export function buildLlmsTxt(siteUrl?: string): string {
  const origin = siteOriginFromEnv(siteUrl);
  return [
    "# PromptShot",
    "",
    "> PromptShot — генерация фото по тексту или своему снимку, каталог промтов и ИИ-фотосессии. Сервис работает в России: русский интерфейс, оплата в рублях, без VPN.",
    "",
    "## Генерация",
    "",
    `- [Сделать фото ИИ](${origin}/generaciya-foto): один кадр по описанию или загруженному фото.`,
    `- [Nano Banana](${origin}/nano-banana): модели Google Gemini для генерации и редактирования фото.`,
    `- [ИИ фотосессия](${origin}/ii-fotosessiya): серия кадров по одному снимку.`,
    `- [Фото в промт](${origin}/foto-v-promt): разбор изображения в текстовый промт.`,
    "",
    "## Каталог",
    "",
    `- [Главная — промты для фото](${origin}/): готовые промты с примерами.`,
    `- [Тренды](${origin}/trends): новые промты по дате.`,
    "",
    "## Карточки",
    "",
    "Каждая карточка промта открывается по пути /p/<slug> и содержит текст промта плюс пример кадра. Повтор генерации запускается с той же карточки.",
    "",
    "## Для агентов",
    "",
    "Генератор на /generaciya-foto и /nano-banana принимает текст или файл изображения. Не обходить /api/, /admin/, /embed/, /auth/, /search, /favorites, /generations, /analyses, /generate, /pricing — эти пути закрыты в robots.txt.",
    "",
  ].join("\n");
}
