/** Счётчик совпадает с init в `landing/src/app/layout.tsx`. При смене ID синхронизируйте оба места. */
export const YANDEX_METRIKA_COUNTER_ID = 107703100;

/** Идентификатор цели JS в кабинете Метрики (тип «JavaScript-событие») должен совпадать. */
export const YM_GOAL_PROMPT_CARD_OPEN = "prompt_card_open";
export const YM_GOAL_LEXYGPT_GENERATE = "lexygpt_generate_click";
export const YM_GOAL_FOTO_V_PROMT_BANNER_CLICK = "foto_v_promt_banner_click";
export const YM_GOAL_FOTO_V_PROMT_BANNER_IMPRESSION = "foto_v_promt_banner_impression";

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
