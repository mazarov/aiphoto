/** Счётчик совпадает с init в `landing/src/app/layout.tsx`. При смене ID синхронизируйте оба места. */
export const YANDEX_METRIKA_COUNTER_ID = 107703100;

/** Идентификатор цели JS в кабинете Метрики (тип «JavaScript-событие») должен совпадать. */
export const YM_GOAL_LEXYGPT_GENERATE = "lexygpt_generate_click";

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
