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
export const AUTH_RETURN_SCROLL_MAX = 1_000_000;

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
/** Target Y while we grow the listing after a full reload (OAuth). Not a settle lock. */
let fillTargetY: number | null = null;
let fillObserver: ResizeObserver | null = null;
const fillListeners = new Set<() => void>();

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

export function sanitizeListingScrollY(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const value = typeof raw === "number" ? raw : Number.parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.min(Math.round(value), AUTH_RETURN_SCROLL_MAX);
}

/**
 * While a card overlay is open the window is often at 0. The listing Y is
 * the value `lockListingScrollForModal` already wrote to `SCROLL_KEY`.
 */
export function resolveListingScrollYForAuthReturn(input: {
  overlayOpen: boolean;
  savedY: number | null;
  currentY: number;
}): number {
  const current = sanitizeListingScrollY(input.currentY) ?? 0;
  const saved = sanitizeListingScrollY(input.savedY);
  if (input.overlayOpen && saved !== null) return saved;
  return current;
}

export function shouldKeepSavedListingScrollOnModalLock(input: {
  isAuthReturn: boolean;
  fillInProgress?: boolean;
  savedY: number | null;
}): boolean {
  return (
    (input.isAuthReturn || Boolean(input.fillInProgress)) &&
    sanitizeListingScrollY(input.savedY) !== null
  );
}

export const LISTING_SCROLL_SETTLE_SLACK_PX = 8;
export const LISTING_SCROLL_PIN_HOLD_MS = 2200;
const PIN_REAPPLY_MS = [0, 50, 150, 320, 500, 800, 1200, 1600, 2200] as const;

let pinY: number | null = null;
let pinGeneration = 0;
const pinTimeouts = new Set<number>();
let pinUnlockInstant: (() => void) | null = null;
let pinScrollBound = false;

export function shouldApplyListingScrollY(input: {
  targetY: number;
  maxScrollY: number;
  slackPx?: number;
}): boolean {
  const target = sanitizeListingScrollY(input.targetY) ?? 0;
  if (target <= 0) return true;
  const slack = input.slackPx ?? LISTING_SCROLL_SETTLE_SLACK_PX;
  return input.maxScrollY + slack >= target;
}

export function resolveListingScrollFillAction(input: {
  targetY: number;
  maxScrollY: number;
  hasMore: boolean;
}): "load" | "apply" | "apply-max" {
  if (
    shouldApplyListingScrollY({
      targetY: input.targetY,
      maxScrollY: input.maxScrollY,
    })
  ) {
    return "apply";
  }
  if (!input.hasMore) return "apply-max";
  return "load";
}

export function resolveListingScrollRestoreOnClose(input: {
  fillInProgress: boolean;
  savedY: number | null;
  currentY: number;
  maxScrollY: number;
}): "unlock" | "fill" | "settle" {
  if (input.fillInProgress) return "unlock";
  const saved = sanitizeListingScrollY(input.savedY);
  if (saved === null || saved <= 0) return "unlock";
  if (
    shouldApplyListingScrollY({
      targetY: saved,
      maxScrollY: input.maxScrollY,
    })
  ) {
    if (Math.abs(input.currentY - saved) <= LISTING_SCROLL_SETTLE_SLACK_PX) {
      return "unlock";
    }
    return "settle";
  }
  return "fill";
}

export function peekListingScrollFillTargetY(): number | null {
  return fillTargetY;
}

export function isListingScrollFillInProgress(): boolean {
  return fillTargetY !== null;
}

export function subscribeListingScrollFill(listener: () => void): () => void {
  fillListeners.add(listener);
  return () => {
    fillListeners.delete(listener);
  };
}

function notifyListingScrollFillListeners(): void {
  for (const listener of fillListeners) listener();
}

function detachListingScrollFillWatch(): void {
  fillObserver?.disconnect();
  fillObserver = null;
}

export function cancelListingScrollFill(): void {
  fillTargetY = null;
  detachListingScrollFillWatch();
}

function listingMaxScrollY(root: ScrollRoot): number {
  if (isInnerListingScrollRoot(root)) {
    return Math.max(0, root.scrollHeight - root.clientHeight);
  }
  if (typeof document === "undefined") return 0;
  return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
}

export function readListingMaxScrollY(): number {
  if (typeof window === "undefined") return 0;
  return listingMaxScrollY(getListingScrollRoot());
}

export function notifyListingScrollFillContentChanged(options?: {
  hasMore?: boolean;
}): void {
  if (fillTargetY === null || typeof window === "undefined") return;
  const hasMore = options?.hasMore !== false;
  const maxScrollY = listingMaxScrollY(getListingScrollRoot());
  const action = resolveListingScrollFillAction({
    targetY: fillTargetY,
    maxScrollY,
    hasMore,
  });
  if (action === "load") return;
  const appliedY = action === "apply" ? fillTargetY : maxScrollY;
  writeAllListingScrollTops(appliedY);
  writeSavedListingScrollY(appliedY);
  fillTargetY = null;
  detachListingScrollFillWatch();
  pinListingScrollAgainstTop(appliedY);
}

/** Grow the listing until it can hold Y, then apply once. Do not clamp to the footer. */
export function startListingScrollFill(y: number): void {
  const target = sanitizeListingScrollY(y);
  if (target === null || target <= 0 || typeof window === "undefined") return;
  cancelListingScrollRestore();
  fillTargetY = target;
  writeSavedListingScrollY(target);
  detachListingScrollFillWatch();
  if (typeof ResizeObserver !== "undefined") {
    const root = getListingScrollRoot();
    const el = isInnerListingScrollRoot(root) ? root : document.documentElement;
    fillObserver = new ResizeObserver(() => {
      notifyListingScrollFillContentChanged({ hasMore: true });
    });
    fillObserver.observe(el);
  }
  notifyListingScrollFillListeners();
  notifyListingScrollFillContentChanged({ hasMore: true });
}

export function shouldReapplyPinnedListingScroll(input: {
  pinnedY: number;
  currentY: number;
}): boolean {
  const pinned = sanitizeListingScrollY(input.pinnedY) ?? 0;
  const current = sanitizeListingScrollY(input.currentY) ?? 0;
  if (pinned <= LISTING_SCROLL_SETTLE_SLACK_PX) return false;
  return current <= LISTING_SCROLL_SETTLE_SLACK_PX;
}

function onPinnedListingScroll(): void {
  if (pinY === null) return;
  if (
    shouldReapplyPinnedListingScroll({
      pinnedY: pinY,
      currentY: readListingScrollY(),
    })
  ) {
    writeAllListingScrollTops(pinY);
  }
}

function bindPinScrollListener(): void {
  if (pinScrollBound || typeof window === "undefined") return;
  pinScrollBound = true;
  window.addEventListener("scroll", onPinnedListingScroll, { passive: true });
  document
    .getElementById(LISTING_SCROLL_ROOT_ID)
    ?.addEventListener("scroll", onPinnedListingScroll, { passive: true });
}

function unbindPinScrollListener(): void {
  if (!pinScrollBound || typeof window === "undefined") return;
  pinScrollBound = false;
  window.removeEventListener("scroll", onPinnedListingScroll);
  document
    .getElementById(LISTING_SCROLL_ROOT_ID)
    ?.removeEventListener("scroll", onPinnedListingScroll);
}

export function cancelListingScrollPin(): void {
  pinGeneration += 1;
  pinY = null;
  if (typeof window !== "undefined") {
    for (const id of pinTimeouts) window.clearTimeout(id);
  }
  pinTimeouts.clear();
  unbindPinScrollListener();
  pinUnlockInstant?.();
  pinUnlockInstant = null;
}

/**
 * After overlay close, Next popstate / `html { scroll-behavior: smooth }` can
 * animate the listing to 0 over 1–2s. Keep restoration manual, pin instant
 * scroll, and only fight a snap back to the top.
 */
export function pinListingScrollAgainstTop(
  y: number,
  holdMs = LISTING_SCROLL_PIN_HOLD_MS
): void {
  const target = sanitizeListingScrollY(y);
  if (target === null || target <= 0 || typeof window === "undefined") return;
  cancelListingScrollPin();
  pinY = target;
  writeSavedListingScrollY(target);
  window.history.scrollRestoration = "manual";
  pinUnlockInstant = pinInstantDocumentScroll(document.documentElement.style);
  writeAllListingScrollTops(target);
  bindPinScrollListener();
  const generation = pinGeneration;
  const reapply = () => {
    if (generation !== pinGeneration || pinY === null) return;
    if (
      shouldReapplyPinnedListingScroll({
        pinnedY: pinY,
        currentY: readListingScrollY(),
      })
    ) {
      writeAllListingScrollTops(pinY);
    }
  };
  for (const ms of PIN_REAPPLY_MS) {
    if (ms > holdMs) continue;
    const id = window.setTimeout(() => {
      pinTimeouts.delete(id);
      reapply();
    }, ms);
    pinTimeouts.add(id);
  }
  const endId = window.setTimeout(() => {
    pinTimeouts.delete(endId);
    if (generation !== pinGeneration) return;
    cancelListingScrollPin();
  }, holdMs);
  pinTimeouts.add(endId);
}

export function peekSavedListingScrollY(): number | null {
  if (typeof window === "undefined") return null;
  try {
    return sanitizeListingScrollY(sessionStorage.getItem(SCROLL_KEY));
  } catch {
    return null;
  }
}

export function writeSavedListingScrollY(y: number): void {
  const safe = sanitizeListingScrollY(y);
  if (safe === null || typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SCROLL_KEY, String(safe));
  } catch {
    // квота / приватный режим / SSR
  }
}

export function readListingScrollY(): number {
  if (typeof window === "undefined") return 0;
  return readScrollTop(getListingScrollRoot());
}

export function applyListingScrollY(y: number): void {
  const safe = sanitizeListingScrollY(y);
  if (safe === null || typeof window === "undefined") return;
  writeSavedListingScrollY(safe);
  writeAllListingScrollTops(safe);
}

export function saveListingScroll(): void {
  if (typeof window === "undefined") return;
  writeSavedListingScrollY(readListingScrollY());
}

let listingScrollRootHydrated = false;
let pendingListingScrollLock = false;

/** Inline lock styles on `#listing-scroll-root` before PageLayout hydrates → mismatch. */
export function shouldDeferListingScrollLockStyles(hydrated: boolean): boolean {
  return !hydrated;
}

function applyListingScrollLockStyles(): void {
  const root = getListingScrollRoot();
  if (isInnerListingScrollRoot(root)) {
    root.style.overflow = "hidden";
    root.style.touchAction = "none";
  }
}

export function markListingScrollRootHydrated(): void {
  listingScrollRootHydrated = true;
  if (pendingListingScrollLock) {
    pendingListingScrollLock = false;
    applyListingScrollLockStyles();
  }
}

export function markListingScrollRootUnhydrated(): void {
  listingScrollRootHydrated = false;
}

/** Mobile catalog shell: freeze inner scroll root while modal is open. */
export function lockListingScrollForModal(): void {
  if (typeof window === "undefined") return;
  if (
    !shouldKeepSavedListingScrollOnModalLock({
      isAuthReturn: isAuthReturnRestorePending(),
      fillInProgress: isListingScrollFillInProgress(),
      savedY: peekSavedListingScrollY(),
    })
  ) {
    saveListingScroll();
  }
  if (shouldDeferListingScrollLockStyles(listingScrollRootHydrated)) {
    pendingListingScrollLock = true;
    return;
  }
  applyListingScrollLockStyles();
}

export function unlockListingScrollStyles(): void {
  if (typeof window === "undefined") return;
  pendingListingScrollLock = false;
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
  cancelListingScrollFill();
  cancelListingScrollPin();
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
 * Settle (already-tall listing) blocks auto-loadMore for ~500ms so a reflow
 * does not subscroll. Fill (OAuth / short listing) must not go through this
 * path: writing Y before maxScroll >= Y clamps to the footer.
 */
export function scheduleListingScrollRestore(opts?: { clear?: boolean }): void {
  if (typeof window === "undefined") return;
  const clear = opts?.clear !== false;
  const saved = peekSavedListingScrollY();
  const decision = resolveListingScrollRestoreOnClose({
    fillInProgress: fillTargetY !== null,
    savedY: saved,
    currentY: readListingScrollY(),
    maxScrollY: listingMaxScrollY(getListingScrollRoot()),
  });

  if (decision === "unlock") {
    unlockListingScrollStyles();
    if (fillTargetY !== null) return;
    if (saved !== null && saved > 0) {
      pinListingScrollAgainstTop(saved);
    }
    bumpListingShellViewportHeight();
    return;
  }

  if (decision === "fill") {
    if (saved !== null) startListingScrollFill(saved);
    unlockListingScrollStyles();
    return;
  }

  cancelListingScrollRestore();
  unlockListingScrollStyles();
  window.history.scrollRestoration = "manual";

  if (saved === null) {
    bumpListingShellViewportHeight();
    return;
  }

  const y = saved;

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
    pinListingScrollAgainstTop(y);
    bumpListingShellViewportHeight();
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
  cancelListingScrollFill();
  cancelListingScrollPin();
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
  if (input.previousPath && isListingOverlayPath(input.previousPath)) {
    return false;
  }
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
