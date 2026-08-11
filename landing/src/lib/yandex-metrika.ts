/** Счётчик совпадает с init в `landing/src/app/layout.tsx`. При смене ID синхронизируйте оба места. */
export const YANDEX_METRIKA_COUNTER_ID = 107703100;

/** Идентификатор цели JS в кабинете Метрики (тип «JavaScript-событие») должен совпадать. */
export const YM_GOAL_PROMPT_CARD_OPEN = "prompt_card_open";
/** @deprecated Используйте placement-specific цели ниже. */
export const YM_GOAL_LEXYGPT_GENERATE = "lexygpt_generate_click";
export const YM_GOAL_LEXYGPT_GENERATE_PROMPTCARD = "lexygpt_generate_promptcard";
export const YM_GOAL_LEXYGPT_GENERATE_PHOTOVPROMPT = "lexygpt_generate_photovprompt";
export const YM_GOAL_PROMPT_CARD_GENERATION_EXPOSURE =
  "prompt_card_generation_exposure";
export const YM_GOAL_PROMPT_CARD_GENERATION_AUTH =
  "prompt_card_generation_auth";
export const YM_GOAL_PROMPT_CARD_GENERATION_ACCEPTED =
  "prompt_card_generation_accepted";
export const YM_GOAL_PROMPT_CARD_GENERATION_NO_CREDITS =
  "prompt_card_generation_no_credits";
export const YM_GOAL_PROMPT_CARD_GENERATION_PRICING =
  "prompt_card_generation_pricing";
/** Soft/route/desktop open of unified generate shell (`/generate`). */
export const YM_GOAL_GENERATE_SHELL_OPEN = "generate_shell_open";
export const YM_GOAL_YOOKASSA_CHECKOUT_STARTED = "yookassa_checkout_started";
export const YM_GOAL_YOOKASSA_CHECKOUT_REDIRECT = "yookassa_checkout_redirect";
export const YM_GOAL_YOOKASSA_PAYMENT_SUCCEEDED = "yookassa_payment_succeeded";
/** @deprecated Таббар больше не открывает LexyGPT — цель не вызывается. */
export const YM_GOAL_LEXYGPT_GENERATE_TABBAR = "lexygpt_generate_tabbar";
export const YM_GOAL_FOTO_V_PROMT_BANNER_CLICK = "foto_v_promt_banner_click";
export const YM_GOAL_FOTO_V_PROMT_BANNER_CLICK_CARD = "foto_v_promt_banner_click_card";
export const YM_GOAL_FOTO_V_PROMT_ADD_TO_CHROME_CLICK = "foto_v_promt_add_to_chrome_click";
/** @deprecated CTA перенесён в сайдбар — используйте `YM_GOAL_DESKTOP_SIDEBAR_ADD_TO_CHROME_CLICK`. */
export const YM_GOAL_DESKTOP_HEADER_ADD_TO_CHROME_CLICK = "desktop_header_add_to_chrome_click";
export const YM_GOAL_DESKTOP_SIDEBAR_ADD_TO_CHROME_CLICK = "desktop_sidebar_add_to_chrome_click";

export type PromptCardOpenEntry = "modal" | "page";

declare global {
  interface Window {
    ym?: (counterId: number, method: string, ...rest: unknown[]) => void;
  }
}

/** `reachGoal` без падения SSR / до загрузки tag.js — если `ym` ещё нет, просто игнорируем. */
export function reachYandexMetrikaGoal(
  goal: string,
  params?: Record<string, string | number | boolean>
): void {
  if (typeof window === "undefined") return;
  try {
    const ym = window.ym;
    if (typeof ym !== "function") return;
    if (params != null && Object.keys(params).length > 0) {
      ym(YANDEX_METRIKA_COUNTER_ID, "reachGoal", goal, params);
    } else {
      ym(YANDEX_METRIKA_COUNTER_ID, "reachGoal", goal);
    }
  } catch {
    /* intentionally empty — аналитика не должна ломать UI */
  }
}

/** Открытие карточки промта: модалка с листинга или прямой заход на `/p/[slug]`. */
export function trackPromptCardOpen(
  slug: string,
  options?: { entry?: PromptCardOpenEntry; referer?: string }
): void {
  const params: Record<string, string> = { slug };
  if (options?.entry) params.entry = options.entry;
  if (options?.referer) params.referer = options.referer;
  reachYandexMetrikaGoal(YM_GOAL_PROMPT_CARD_OPEN, params);
}

/** CTA установки расширения → Chrome Web Store. */
export function trackFotoVPromtAddToChromeClick(placement?: string): void {
  reachYandexMetrikaGoal(
    YM_GOAL_FOTO_V_PROMT_ADD_TO_CHROME_CLICK,
    placement ? { placement } : undefined,
  );
}

/** @deprecated CTA перенесён в сайдбар — используйте `trackDesktopSidebarAddToChromeClick`. */
export function trackDesktopHeaderAddToChromeClick(): void {
  reachYandexMetrikaGoal(YM_GOAL_DESKTOP_HEADER_ADD_TO_CHROME_CLICK);
}

/** CTA расширения в блоке «Инструменты» сайдбара → Chrome Web Store. */
export function trackDesktopSidebarAddToChromeClick(): void {
  reachYandexMetrikaGoal(YM_GOAL_DESKTOP_SIDEBAR_ADD_TO_CHROME_CLICK);
}

/**
 * Отправка виртуального pageview (ym('hit')) для клиентских навигаций,
 * в первую очередь — открытий карточек через модалку Solution B (history.pushState + fetch /api/card).
 *
 * Это позволяет Яндекс.Метрике и Вебмастеру видеть переходы
 * листинг/поиск → /p/[slug] как полноценные внутренние просмотры страниц.
 *
 * Используйте referer, чтобы цепочка переходов была корректной.
 */
export function trackVirtualPageView(
  url: string,
  options?: { referer?: string; title?: string }
): void {
  if (typeof window === "undefined") return;
  try {
    const ym = window.ym;
    if (typeof ym !== "function") return;

    const params: Record<string, unknown> = {};
    if (options?.referer) params.referer = options.referer;
    if (options?.title) params.title = options.title;

    if (Object.keys(params).length > 0) {
      ym(YANDEX_METRIKA_COUNTER_ID, "hit", url, params);
    } else {
      ym(YANDEX_METRIKA_COUNTER_ID, "hit", url);
    }
  } catch {
    /* intentionally empty — аналитика не должна ломать UI */
  }
}
