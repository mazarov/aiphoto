/**
 * Централизованное сохранение и восстановление позиции скролла листинга
 * при открытии/закрытии карточек промтов (через клиентский модал Solution B).
 *
 * Устраняет дублирование логики в 5+ местах и race conditions.
 * Используется sessionStorage (достаточно в пределах вкладки).
 *
 * Ключ: "card_modal_scroll_pos"
 */

export const SCROLL_KEY = "card_modal_scroll_pos";

export function saveListingScroll(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
  } catch {
    // квота / приватный режим / SSR
  }
}

export interface RestoreOptions {
  /** Удалить ключ из sessionStorage после восстановления (по умолчанию true) */
  clear?: boolean;
  /** Делать scrollTo через requestAnimationFrame (рекомендуется, по умолчанию true) */
  useRAF?: boolean;
  /** Дополнительный "safety" scrollTo через N мс после первого (0 = выкл.) */
  safetyDelayMs?: number;
  /**
   * Временно установить history.scrollRestoration = "manual" на время восстановления
   * и вернуть предыдущее значение через короткий таймаут.
   */
  manageScrollRestoration?: boolean;
}

const DEFAULT_RESTORE_OPTS: Required<RestoreOptions> = {
  clear: true,
  useRAF: true,
  safetyDelayMs: 60,
  manageScrollRestoration: true,
};

export function restoreListingScroll(opts: RestoreOptions = {}): void {
  if (typeof window === "undefined") return;

  const {
    clear,
    useRAF,
    safetyDelayMs,
    manageScrollRestoration,
  } = { ...DEFAULT_RESTORE_OPTS, ...opts };

  const saved = sessionStorage.getItem(SCROLL_KEY);
  if (!saved) return;

  const y = parseInt(saved, 10);
  if (Number.isNaN(y)) {
    if (clear) {
      try { sessionStorage.removeItem(SCROLL_KEY); } catch {}
    }
    return;
  }

  const doScroll = () => {
    window.scrollTo(0, y);
    if (safetyDelayMs > 0) {
      // страховка от layout shift (картинки, шрифты, dvh и т.д.)
      setTimeout(() => window.scrollTo(0, y), safetyDelayMs);
    }
  };

  let original: ScrollRestoration | undefined;
  if (manageScrollRestoration) {
    original = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
  }

  if (useRAF) {
    requestAnimationFrame(doScroll);
  } else {
    doScroll();
  }

  if (clear) {
    try {
      sessionStorage.removeItem(SCROLL_KEY);
    } catch {
      /* ignore */
    }
  }

  if (manageScrollRestoration && original !== undefined) {
    // возвращаем браузеру управление реставрацией после того, как скролл применился
    setTimeout(() => {
      if (window.history.scrollRestoration !== original) {
        window.history.scrollRestoration = original;
      }
    }, Math.max(120, (safetyDelayMs || 0) + 80));
  }
}

/**
 * Хук для компонентов-обёрток листингов (CatalogWithFilters, SearchResults и т.п.).
 * Вызывает восстановление позиции один раз при монтировании (useLayoutEffect — синхронно до paint).
 *
 * Пример:
 *   useListingScrollRestoration();
 */
import { useLayoutEffect } from "react";

export function useListingScrollRestoration(opts: RestoreOptions = {}): void {
  useLayoutEffect(() => {
    restoreListingScroll({ ...opts, clear: true });
  }, []);
  // deps пустой — эффект только на mount/remount компонента листинга
}
