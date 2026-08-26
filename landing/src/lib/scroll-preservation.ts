/**
 * Централизованное сохранение и восстановление позиции скролла листинга
 * при открытии/закрытии карточек промтов (через клиентский модал Solution B).
 */

import { useLayoutEffect } from "react";
import { isAuthReturnRestorePending } from "@/lib/auth-return-path";
import { bumpListingShellViewportHeight } from "@/lib/listing-shell-viewport";

export const SCROLL_KEY = "card_modal_scroll_pos";
export const LISTING_SCROLL_ROOT_ID = "listing-scroll-root";
export const LAST_LISTING_PATH_KEY = "promptshot:last-listing-path";

/**
 * True пока идёт восстановление позиции листинга после закрытия модалки.
 * Гриды используют это, чтобы не запускать авто-loadMore во время восстановления
 * (иначе догрузка + пересчёт listing-grid-clamp двигают высоту и сбивают позицию).
 */
let restoreInProgress = false;
/** Bumped on cancel / new schedule — stale rAF and setTimeout callbacks no-op. */
let restoreGeneration = 0;
const pendingRestoreTimeouts = new Set<number>();
/** Survives PageLayout remount — useRef alone misses category→category navigations. */
let lastListingNavPath: string | null = null;
/** Bumped when a new route scroll-to-top sequence starts. */
let routeScrollTopGeneration = 0;

export function isListingScrollRestoreInProgress(): boolean {
  return restoreInProgress;
}

/** Abort pending modal-restore timers/rAF and drop the in-progress flag. */
export function cancelListingScrollRestore(): void {
  if (typeof window === "undefined") return;
  restoreGeneration += 1;
  routeScrollTopGeneration += 1;
  restoreInProgress = false;
  for (const id of pendingRestoreTimeouts) {
    window.clearTimeout(id);
  }
  pendingRestoreTimeouts.clear();
  unlockListingScrollStyles();
}

function trackRestoreTimeout(fn: () => void, ms: number): number {
  const generation = restoreGeneration;
  const id = window.setTimeout(() => {
    pendingRestoreTimeouts.delete(id);
    if (generation !== restoreGeneration) return;
    fn();
  }, ms);
  pendingRestoreTimeouts.add(id);
  return id;
}

function trackRouteScrollTimeout(fn: () => void, ms: number): number {
  const generation = routeScrollTopGeneration;
  const id = window.setTimeout(() => {
    pendingRestoreTimeouts.delete(id);
    if (generation !== routeScrollTopGeneration) return;
    fn();
  }, ms);
  pendingRestoreTimeouts.add(id);
  return id;
}

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
  if (!isInnerListingScrollRoot(root)) return window.scrollY;
  return root.scrollTop;
}

/**
 * Next `<Link>` on listing / SEO-shell pages. Default `scroll={true}` lets
 * App Router `handlePotentialScroll` call `scrollIntoView` on
 * `<next-route-announcer>` (in-flow at document end) → jump to the footer.
 * Then `html { scroll-behavior: smooth }` + `writeScrollTop(0)` animates back.
 */
export const LISTING_SHELL_LINK_SCROLL = false;

type InlineScrollBehaviorStyle = {
  scrollBehavior: string;
  setProperty: (name: string, value: string) => void;
  removeProperty: (name: string) => void;
};

/** Force instant document scroll; assignment to `scrollTop` follows CSS `scroll-behavior`. */
export function pinInstantDocumentScroll(
  style: InlineScrollBehaviorStyle
): () => void {
  const previous = style.scrollBehavior;
  style.setProperty("scroll-behavior", "auto");
  return () => {
    if (previous) {
      style.scrollBehavior = previous;
    } else {
      style.removeProperty("scroll-behavior");
    }
  };
}

export function writeScrollTop(root: ScrollRoot, y: number): void {
  if (!isInnerListingScrollRoot(root)) {
    const restore = pinInstantDocumentScroll(document.documentElement.style);
    try {
      document.documentElement.scrollTop = y;
      document.body.scrollTop = y;
    } finally {
      restore();
    }
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
  cancelListingScrollRestore();
  try {
    sessionStorage.removeItem(SCROLL_KEY);
  } catch {
    /* ignore */
  }
  writeAllListingScrollTops(0);
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
 *
 * Also sets restoreInProgress=true for the duration so IntersectionObserver-based
 * auto-loadMore is blocked: fetching new cards during restore causes a reflow that
 * shifts the viewport after the 320ms window expires (the main source of "subscroll").
 */
export function scheduleListingScrollRestore(): void {
  if (typeof window === "undefined") return;

  cancelListingScrollRestore();
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

  const generation = restoreGeneration;

  // Block auto-loadMore in grids for the entire restore window.
  restoreInProgress = true;

  const apply = () => {
    if (generation !== restoreGeneration) return;
    unlockListingScrollStyles();
    writeScrollTop(getListingScrollRoot(), y);
  };

  const finish = () => {
    if (generation !== restoreGeneration) return;
    apply();
    restoreInProgress = false;
    try { sessionStorage.removeItem(SCROLL_KEY); } catch {}
    bumpListingShellViewportHeight();
    window.history.scrollRestoration = "auto";
  };

  // Discrete reapply (NOT a continuous rAF loop — user must be able to scroll
  // immediately after closing). Covers: sync frame, Next popstate, late layout settle.
  apply();
  requestAnimationFrame(() => {
    if (generation !== restoreGeneration) return;
    apply();
  });
  requestAnimationFrame(() => {
    if (generation !== restoreGeneration) return;
    requestAnimationFrame(() => {
      if (generation !== restoreGeneration) return;
      apply();
    });
  });
  trackRestoreTimeout(apply, 50);
  trackRestoreTimeout(apply, 150);
  trackRestoreTimeout(apply, 320);

  // Final: reapply once more, drop the flag, clean up, restore native scroll mode.
  // 500ms > previous 320ms so Next popstate reconciliation finishes before
  // auto-loadMore is unblocked. After the flag drops, any new cards append below
  // the viewport and the visible content does not shift.
  trackRestoreTimeout(finish, 500);
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

/** Prompt card route (modal pushState `/p/slug` or direct page). */
function isCardPath(normalizedPath: string): boolean {
  return normalizedPath === "/p" || normalizedPath.startsWith("/p/");
}

/** Pricing overlay (`pushState /pricing`) or hard `/pricing` page. */
function isPricingPath(normalizedPath: string): boolean {
  return normalizedPath === "/pricing";
}

/**
 * Soft overlay (`pushState /p/slug` or `/pricing`). Next 15 syncs these into
 * `usePathname` / `useSearchParams` without the listing being a new search.
 */
export function isListingOverlayPath(pathname: string): boolean {
  const norm = normalizeNavPath(pathname);
  return isCardPath(norm) || isPricingPath(norm);
}

export function persistLastListingPath(path: string): void {
  if (typeof window === "undefined") return;
  const safe = path.trim();
  if (!safe.startsWith("/") || isListingOverlayPath(safe)) return;
  try {
    sessionStorage.setItem(LAST_LISTING_PATH_KEY, safe);
  } catch {
    // private mode / quota
  }
}

export function peekLastListingPath(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = sessionStorage.getItem(LAST_LISTING_PATH_KEY);
    return stored && stored.startsWith("/") ? stored : null;
  } catch {
    return null;
  }
}

/** Scroll catalog listing root and window to top; clears saved modal-restore position. */
export function scrollCatalogToTop(): void {
  if (typeof window === "undefined") return;
  cancelListingScrollRestore();
  try {
    sessionStorage.removeItem(SCROLL_KEY);
  } catch {
    /* ignore */
  }
  const inner = document.getElementById(LISTING_SCROLL_ROOT_ID);
  if (inner) {
    inner.scrollTop = 0;
  }
  writeScrollTop(getListingScrollRoot(), 0);
  writeScrollTop(window, 0);
}

function writeAllListingScrollTops(y: number): void {
  const inner = document.getElementById(LISTING_SCROLL_ROOT_ID);
  if (inner) {
    inner.scrollTop = y;
  }
  writeScrollTop(getListingScrollRoot(), y);
  writeScrollTop(window, y);
}

/** Reapply scroll-top after Next.js / layout may restore a stale position post-navigation. */
function scheduleRouteScrollToTop(): void {
  if (typeof window === "undefined") return;

  routeScrollTopGeneration += 1;
  const generation = routeScrollTopGeneration;

  const apply = () => {
    if (generation !== routeScrollTopGeneration) return;
    writeAllListingScrollTops(0);
  };

  writeAllListingScrollTops(0);
  requestAnimationFrame(() => {
    if (generation !== routeScrollTopGeneration) return;
    apply();
  });
  requestAnimationFrame(() => {
    if (generation !== routeScrollTopGeneration) return;
    requestAnimationFrame(() => {
      if (generation !== routeScrollTopGeneration) return;
      apply();
    });
  });
  trackRouteScrollTimeout(apply, 50);
  trackRouteScrollTimeout(apply, 150);
}

export function isSameNavPath(pathname: string, href: string): boolean {
  return normalizeNavPath(pathname) === normalizeNavPath(href);
}

/**
 * Reset listing scroll on Next.js route change. On mobile the shell scrolls inside
 * `#listing-scroll-root` (persists across soft navigations); also cancels stale modal-restore timers.
 * Modal close does not change pathname — restore stays on scheduleListingScrollRestore only.
 */
export function shouldResetListingScrollOnRouteEnter(input: {
  normalizedPath: string;
  previousPath: string | null;
  isAuthReturn: boolean;
}): boolean {
  if (input.isAuthReturn) return false;
  if (isListingOverlayPath(input.normalizedPath)) return false;
  const pathChanged =
    input.previousPath !== null && input.previousPath !== input.normalizedPath;
  return (
    pathChanged ||
    (input.previousPath === null && shouldScrollTopOnNav(input.normalizedPath))
  );
}

export function useListingScrollOnRouteChange(pathname: string): void {
  useLayoutEffect(() => {
    const norm = normalizeNavPath(pathname);
    const isAuthReturn = isAuthReturnRestorePending();

    if (
      !shouldResetListingScrollOnRouteEnter({
        normalizedPath: norm,
        previousPath: lastListingNavPath,
        isAuthReturn,
      })
    ) {
      if (!isListingOverlayPath(norm)) {
        lastListingNavPath = norm;
        persistLastListingPath(
          `${window.location.pathname}${window.location.search}`
        );
      }
      return;
    }

    lastListingNavPath = norm;
    persistLastListingPath(
      `${window.location.pathname}${window.location.search}`
    );

    window.history.scrollRestoration = "manual";
    scrollCatalogToTop();
    scheduleRouteScrollToTop();
  }, [pathname]);
}

/**
 * @deprecated use useListingScrollOnRouteChange
 */
export function useStandalonePageScrollTop(pathname: string): void {
  useListingScrollOnRouteChange(pathname);
}
