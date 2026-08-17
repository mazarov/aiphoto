/** Счётчик совпадает с init в `landing/src/app/layout.tsx`. При смене ID синхронизируйте оба места. */
export const YANDEX_METRIKA_COUNTER_ID = 107703100;

/** Идентификатор цели JS в кабинете Метрики (тип «JavaScript-событие») должен совпадать. */
export const YM_GOAL_PROMPT_CARD_OPEN = "prompt_card_open";
/** @deprecated Используйте placement-specific цели ниже. */
export const YM_GOAL_LEXYGPT_GENERATE = "lexygpt_generate_click";
export const YM_GOAL_LEXYGPT_GENERATE_PROMPTCARD = "lexygpt_generate_promptcard";
export const YM_GOAL_LEXYGPT_GENERATE_PHOTOVPROMPT = "lexygpt_generate_photovprompt";
/** @deprecated Rollout exposure — no longer fired after GA ungating. */
export const YM_GOAL_PROMPT_CARD_GENERATION_EXPOSURE =
  "prompt_card_generation_exposure";
/** @deprecated Rollout auth — no longer fired after GA ungating. */
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
export const YM_GOAL_PAYMENT_CHECKOUT_STARTED = "payment_checkout_started";
export const YM_GOAL_PAYMENT_IFRAME_OPENED = "payment_iframe_opened";
export const YM_GOAL_PAYMENT_SUCCEEDED = "payment_succeeded";
/** Direct optimization goal — JS on return + Measurement Protocol from webhook. */
export const YM_GOAL_PURCHASE = "purchase";
/** @deprecated Таббар больше не открывает LexyGPT — цель не вызывается. */
export const YM_GOAL_LEXYGPT_GENERATE_TABBAR = "lexygpt_generate_tabbar";
export const YM_GOAL_FOTO_V_PROMT_BANNER_CLICK = "foto_v_promt_banner_click";
export const YM_GOAL_FOTO_V_PROMT_BANNER_CLICK_CARD = "foto_v_promt_banner_click_card";
export const YM_GOAL_FOTO_V_PROMT_ADD_TO_CHROME_CLICK = "foto_v_promt_add_to_chrome_click";
export const YM_GOAL_GENERATION_PHOTO_PROMPT_OPEN =
  "generation_photo_prompt_open";
export const YM_GOAL_GENERATION_PHOTO_PROMPT_UPLOAD =
  "generation_photo_prompt_upload";
export const YM_GOAL_GENERATION_PHOTO_PROMPT_READY =
  "generation_photo_prompt_ready";
export const YM_GOAL_GENERATION_PHOTO_PROMPT_START =
  "generation_photo_prompt_start";
export const YM_GOAL_ANALYZE_AUTH_REQUIRED = "analyze_auth_required";
export const YM_GOAL_ANALYZE_NO_CREDITS = "analyze_no_credits";
export const YM_GOAL_ANALYZE_FREE_SUCCESS = "analyze_free_success";
export const YM_GOAL_ANALYZE_PAID_SUCCESS = "analyze_paid_success";
export const YM_GOAL_ANALYZE_QUOTA_UNAVAILABLE = "analyze_quota_unavailable";
/** @deprecated CTA перенесён в сайдбар — используйте `YM_GOAL_DESKTOP_SIDEBAR_ADD_TO_CHROME_CLICK`. */
export const YM_GOAL_DESKTOP_HEADER_ADD_TO_CHROME_CLICK = "desktop_header_add_to_chrome_click";
export const YM_GOAL_DESKTOP_SIDEBAR_ADD_TO_CHROME_CLICK = "desktop_sidebar_add_to_chrome_click";

export type PromptCardOpenEntry = "modal" | "page";

declare global {
  interface Window {
    ym?: (counterId: number, method: string, ...rest: unknown[]) => void;
    dataLayer?: Array<Record<string, unknown>>;
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

export function trackYandexPurchase(params: {
  orderId: string;
  priceRub: number;
  planId: string;
  credits: number;
}): void {
  reachYandexMetrikaGoal(YM_GOAL_PURCHASE, {
    order_id: params.orderId,
    price: params.priceRub,
    plan_id: params.planId,
    credits: params.credits,
  });
  if (typeof window === "undefined") return;
  try {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      ecommerce: {
        currencyCode: "RUB",
        purchase: {
          actionField: {
            id: params.orderId,
            revenue: params.priceRub,
          },
          products: [
            {
              id: params.planId,
              name: params.planId,
              price: params.priceRub,
              quantity: 1,
            },
          ],
        },
      },
    });
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
