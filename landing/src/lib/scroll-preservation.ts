/**
 * Централизованное сохранение и восстановление позиции скролла листинга
 * при открытии/закрытии карточек промтов (через клиентский модал Solution B).
 */

import { useLayoutEffect } from "react";

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
  clear?: boolean;
  useRAF?: boolean;
  safetyDelayMs?: number;
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
    setTimeout(() => {
      if (window.history.scrollRestoration !== original) {
        window.history.scrollRestoration = original;
      }
    }, Math.max(120, (safetyDelayMs || 0) + 80));
  }
}

export function useListingScrollRestoration(opts: RestoreOptions = {}): void {
  useLayoutEffect(() => {
    restoreListingScroll({ ...opts, clear: true });
  }, []);
}
