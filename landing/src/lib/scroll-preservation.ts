/**
 * Централизованное сохранение и восстановление позиции скролла листинга
 * при открытии/закрытии карточек промтов (через клиентский модал Solution B).
 */

import { useLayoutEffect } from "react";

export const SCROLL_KEY = "card_modal_scroll_pos";
export const LISTING_SCROLL_ROOT_ID = "listing-scroll-root";

type ScrollRoot = HTMLElement | Window;

export function getListingScrollRoot(): ScrollRoot {
  if (typeof window === "undefined") return window;
  const useInnerScroll = window.matchMedia("(max-width: 1023px)").matches;
  if (!useInnerScroll) return window;
  return document.getElementById(LISTING_SCROLL_ROOT_ID) ?? window;
}

function readScrollTop(root: ScrollRoot): number {
  if (root === window) return window.scrollY;
  return (root as HTMLElement).scrollTop;
}

export function writeScrollTop(root: ScrollRoot, y: number): void {
  if (root === window) {
    window.scrollTo(0, y);
    return;
  }
  root.scrollTo({ top: y, behavior: "auto" });
}

export function saveListingScroll(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SCROLL_KEY, String(readScrollTop(getListingScrollRoot())));
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

  const root = getListingScrollRoot();

  const doScroll = () => {
    writeScrollTop(root, y);
    if (safetyDelayMs > 0) {
      setTimeout(() => writeScrollTop(root, y), safetyDelayMs);
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
