/**
 * Централизованное сохранение и восстановление позиции скролла листинга
 * при открытии/закрытии карточек промтов (через клиентский модал Solution B).
 */

import { useLayoutEffect } from "react";
import { bumpListingShellViewportHeight } from "@/lib/listing-shell-viewport";

export const SCROLL_KEY = "card_modal_scroll_pos";
export const LISTING_SCROLL_ROOT_ID = "listing-scroll-root";

type ScrollRoot = HTMLElement | Window;

export function getListingScrollRoot(): ScrollRoot {
  if (typeof window === "undefined") return window;
  const useInnerScroll = window.matchMedia("(max-width: 1023px)").matches;
  if (!useInnerScroll) return window;
  return document.getElementById(LISTING_SCROLL_ROOT_ID) ?? window;
}

function isInnerListingScrollRoot(root: ScrollRoot): root is HTMLElement {
  return root !== window;
}

function readScrollTop(root: ScrollRoot): number {
  if (root === window) return window.scrollY;
  return root.scrollTop;
}

export function writeScrollTop(root: ScrollRoot, y: number): void {
  // Direct assignment — instant; scrollTo() respects html { scroll-behavior: smooth }.
  if (root === window) {
    document.documentElement.scrollTop = y;
    document.body.scrollTop = y;
    return;
  }
  root.scrollTop = y;
}

export function saveListingScroll(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SCROLL_KEY, String(readScrollTop(getListingScrollRoot())));
  } catch {
    // квота / приватный режим / SSR
  }
}

/** Mobile catalog shell: freeze inner scroll root while modal is open. */
export function lockListingScrollForModal(): void {
  saveListingScroll();
  if (typeof window === "undefined") return;
  const root = getListingScrollRoot();
  if (isInnerListingScrollRoot(root)) {
    root.style.overflow = "hidden";
    root.style.touchAction = "none";
  }
}

export function unlockListingScrollStyles(): void {
  if (typeof window === "undefined") return;
  const root = getListingScrollRoot();
  if (isInnerListingScrollRoot(root)) {
    root.style.removeProperty("overflow");
    root.style.removeProperty("touch-action");
  }
}

/** Scroll listing back to top and drop any saved modal-restore position. */
export function resetListingScroll(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(SCROLL_KEY);
  } catch {
    /* ignore */
  }
  writeScrollTop(getListingScrollRoot(), 0);
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

  unlockListingScrollStyles();
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

/**
 * After modal close via history.back(), Next.js popstate and layout settle asynchronously.
 * Retry restore so #listing-scroll-root regains touch scroll on mobile.
 */
export function scheduleListingScrollRestore(): void {
  if (typeof window === "undefined") return;

  unlockListingScrollStyles();
  window.history.scrollRestoration = "manual";

  const saved = sessionStorage.getItem(SCROLL_KEY);
  if (!saved) {
    bumpListingShellViewportHeight();
    return;
  }

  const y = parseInt(saved, 10);
  if (Number.isNaN(y)) {
    try { sessionStorage.removeItem(SCROLL_KEY); } catch {}
    bumpListingShellViewportHeight();
    return;
  }

  const apply = () => {
    unlockListingScrollStyles();
    writeScrollTop(getListingScrollRoot(), y);
  };

  apply();
  requestAnimationFrame(apply);
  requestAnimationFrame(() => requestAnimationFrame(apply));
  window.setTimeout(apply, 50);
  window.setTimeout(apply, 150);
  window.setTimeout(() => {
    apply();
    try { sessionStorage.removeItem(SCROLL_KEY); } catch {}
    bumpListingShellViewportHeight();
    window.history.scrollRestoration = "auto";
  }, 320);
}

export function useListingScrollRestoration(opts: RestoreOptions = {}): void {
  useLayoutEffect(() => {
    restoreListingScroll({ ...opts, clear: true });
  }, []);
}

/** Routes that must open at scroll top (catalog shell + window). Paths without trailing slash. */
export const SCROLL_TOP_ON_NAV_PATHS = new Set(["/", "/foto-v-promt"]);

/** @deprecated use SCROLL_TOP_ON_NAV_PATHS */
export const STANDALONE_SCROLL_TOP_PATHS = SCROLL_TOP_ON_NAV_PATHS;

export function normalizeNavPath(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

export function shouldScrollTopOnNav(pathname: string): boolean {
  return SCROLL_TOP_ON_NAV_PATHS.has(normalizeNavPath(pathname));
}

/** Scroll catalog listing root and window to top; clears saved modal-restore position. */
export function scrollCatalogToTop(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(SCROLL_KEY);
  } catch {
    /* ignore */
  }
  const root = getListingScrollRoot();
  writeScrollTop(root, 0);
  if (root !== window) {
    writeScrollTop(window, 0);
  }
}

export function isSameNavPath(pathname: string, href: string): boolean {
  return normalizeNavPath(pathname) === normalizeNavPath(href);
}

/**
 * Next.js scroll-to-top only affects `window`. On mobile the catalog shell scrolls
 * inside `#listing-scroll-root`; browser history can also restore a stale position.
 */
export function useStandalonePageScrollTop(pathname: string): void {
  useLayoutEffect(() => {
    if (!shouldScrollTopOnNav(pathname)) return;

    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    scrollCatalogToTop();

    return () => {
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, [pathname]);
}
