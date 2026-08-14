/**
 * Mobile catalog shell vs keyboard.
 *
 * Keyboard overlays chrome (`interactive-widget=overlays-content`). Safari
 * still pans/scrolls a focused field that sits below the screen midpoint
 * (~20–40px “nudge” into the upper half). We snapshot scroll on touchstart
 * (before that nudge), lock the listing scroller, and cancel visualViewport
 * offsetTop pans. We never scroll the field up to stay above the keyboard.
 */

import { useEffect } from "react";

export const LISTING_SHELL_HEIGHT_VAR = "--ps-listing-shell-height";

const MOBILE_MQ = "(max-width: 1023px)";
const LISTING_SCROLL_ROOT_ID = "listing-scroll-root";
const TAP_MOVE_PX = 10;
const HOLD_PIN_MS = 450;

let lastStableHeightPx = 0;
let frozenHeightPx = 0;

let scrollLockRoot: HTMLElement | null = null;
let lockedScrollTop = 0;
let tapScrollTop: number | null = null;
let tapStartY = 0;
let tapMoved = false;
let holdPinUntil = 0;
let holdPinRaf = 0;

function isMobileListing(): boolean {
  return window.matchMedia(MOBILE_MQ).matches;
}

function readLayoutHeightPx(): number {
  return Math.round(window.innerHeight);
}

function listingScrollRoot(): HTMLElement | null {
  return document.getElementById(LISTING_SCROLL_ROOT_ID);
}

function listingShell(): HTMLElement | null {
  return document.querySelector(".listing-shell-root");
}

function isEditableElement(el: Element | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === "TEXTAREA") return true;
  if (tag !== "INPUT") return false;
  const type = (el as HTMLInputElement).type;
  return !/^(button|checkbox|radio|file|submit|reset|hidden|range|color)$/i.test(
    type,
  );
}

function listingEditableFromEvent(e: Event): HTMLElement | null {
  const target = e.target;
  if (!(target instanceof Element)) return null;
  const root = listingScrollRoot();
  if (!root) return null;
  const candidate = isEditableElement(target)
    ? target
    : target.closest("input, textarea, [contenteditable='true']");
  if (!candidate || !isEditableElement(candidate)) return null;
  if (!root.contains(candidate)) return null;
  return candidate;
}

function freezeShellHeight(): void {
  if (frozenHeightPx > 0) return;
  frozenHeightPx = Math.max(lastStableHeightPx, readLayoutHeightPx());
  syncListingShellViewportHeight();
}

function clearPanCancel(): void {
  listingShell()?.style.removeProperty("transform");
}

function applyPanCancel(): void {
  const shell = listingShell();
  const vv = window.visualViewport;
  if (!shell || frozenHeightPx <= 0 || !vv) {
    clearPanCancel();
    return;
  }
  const offsetTop =
    Number.isFinite(vv.offsetTop) && vv.offsetTop > 0
      ? Math.round(vv.offsetTop)
      : 0;
  if (offsetTop > 0) {
    shell.style.transform = `translateY(${offsetTop}px)`;
  } else {
    shell.style.removeProperty("transform");
  }
  if (window.scrollY !== 0) window.scrollTo(0, 0);
}

function restoreLockedScroll(): void {
  if (!scrollLockRoot) return;
  if (scrollLockRoot.scrollTop !== lockedScrollTop) {
    scrollLockRoot.scrollTop = lockedScrollTop;
  }
}

function stopHoldPin(): void {
  holdPinUntil = 0;
  if (holdPinRaf) {
    cancelAnimationFrame(holdPinRaf);
    holdPinRaf = 0;
  }
}

function holdPinTick(): void {
  holdPinRaf = 0;
  restoreLockedScroll();
  applyPanCancel();
  if (frozenHeightPx > 0 && performance.now() < holdPinUntil) {
    holdPinRaf = requestAnimationFrame(holdPinTick);
  }
}

function startHoldPin(): void {
  holdPinUntil = performance.now() + HOLD_PIN_MS;
  if (!holdPinRaf) holdPinRaf = requestAnimationFrame(holdPinTick);
}

function unfreezeShellHeight(): void {
  frozenHeightPx = 0;
  stopHoldPin();
  clearPanCancel();
}

function lockListingScroll(root: HTMLElement, scrollTop: number): void {
  lockedScrollTop = scrollTop;
  scrollLockRoot = root;
  root.style.overflowY = "hidden";
  root.scrollTop = lockedScrollTop;
}

function unlockListingScroll(): void {
  const root = scrollLockRoot;
  scrollLockRoot = null;
  tapScrollTop = null;
  if (!root) return;
  root.style.removeProperty("overflow-y");
  root.scrollTop = lockedScrollTop;
}

function onListingScroll(e: Event): void {
  if (!scrollLockRoot || e.target !== scrollLockRoot) return;
  restoreLockedScroll();
}

function onVisualViewportChange(): void {
  if (frozenHeightPx <= 0) return;
  restoreLockedScroll();
  applyPanCancel();
}

export function isListingShellKeyboardFrozen(): boolean {
  return frozenHeightPx > 0;
}

export function readListingShellViewportHeightPx(): number {
  if (typeof window === "undefined") return 0;
  if (frozenHeightPx > 0) return frozenHeightPx;
  const layoutH = readLayoutHeightPx();
  lastStableHeightPx = layoutH;
  return layoutH;
}

export function syncListingShellViewportHeight(): void {
  if (typeof window === "undefined") return;
  if (!isMobileListing()) {
    lastStableHeightPx = 0;
    unfreezeShellHeight();
    unlockListingScroll();
    document.documentElement.style.removeProperty(LISTING_SHELL_HEIGHT_VAR);
    return;
  }
  document.documentElement.style.setProperty(
    LISTING_SHELL_HEIGHT_VAR,
    `${readListingShellViewportHeightPx()}px`,
  );
}

export function bumpListingShellViewportHeight(): void {
  syncListingShellViewportHeight();
  requestAnimationFrame(() => {
    syncListingShellViewportHeight();
    requestAnimationFrame(syncListingShellViewportHeight);
  });
  window.setTimeout(syncListingShellViewportHeight, 120);
  window.setTimeout(syncListingShellViewportHeight, 320);
  window.setTimeout(syncListingShellViewportHeight, 700);
}

function onTouchStartCapture(e: TouchEvent): void {
  if (!isMobileListing() || !listingEditableFromEvent(e)) return;
  const root = listingScrollRoot();
  if (!root) return;
  tapStartY = e.touches[0]?.clientY ?? 0;
  tapMoved = false;
  tapScrollTop = root.scrollTop;
  freezeShellHeight();
  lockListingScroll(root, tapScrollTop);
}

function onTouchMoveCapture(e: TouchEvent): void {
  if (!isMobileListing() || tapMoved) return;
  const y = e.touches[0]?.clientY ?? tapStartY;
  if (Math.abs(y - tapStartY) <= TAP_MOVE_PX) return;
  tapMoved = true;
  unlockListingScroll();
  unfreezeShellHeight();
}

function onTouchEndCapture(e: TouchEvent): void {
  if (!isMobileListing() || tapMoved || e.touches.length > 0) return;
  const editable = listingEditableFromEvent(e);
  if (!editable || document.activeElement === editable) return;
  const root = listingScrollRoot();
  if (!root) return;
  e.preventDefault();
  freezeShellHeight();
  lockListingScroll(root, tapScrollTop ?? root.scrollTop);
  editable.focus({ preventScroll: true });
  startHoldPin();
}

function onFocusIn(e: FocusEvent): void {
  if (!isMobileListing()) return;
  const target = e.target;
  if (!(target instanceof Element) || !isEditableElement(target)) return;
  const root = listingScrollRoot();
  if (!root?.contains(target)) return;
  freezeShellHeight();
  lockListingScroll(
    root,
    tapScrollTop ?? (scrollLockRoot === root ? lockedScrollTop : root.scrollTop),
  );
  startHoldPin();
}

function onFocusOut(e: FocusEvent): void {
  if (!isMobileListing()) return;
  const next = e.relatedTarget;
  const root = listingScrollRoot();
  if (
    root &&
    next instanceof Element &&
    root.contains(next) &&
    isEditableElement(next)
  ) {
    return;
  }
  unlockListingScroll();
  unfreezeShellHeight();
  bumpListingShellViewportHeight();
}

export function useListingShellViewportSync(): void {
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);

    const onLayoutChange = () => syncListingShellViewportHeight();
    const onOrientationChange = () => {
      lastStableHeightPx = 0;
      unfreezeShellHeight();
      onLayoutChange();
    };
    const onSettledLayoutChange = () => {
      if (mq.matches) bumpListingShellViewportHeight();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") onSettledLayoutChange();
    };

    const onMqChange = () => {
      lastStableHeightPx = 0;
      unfreezeShellHeight();
      unlockListingScroll();
      onLayoutChange();
    };

    mq.addEventListener("change", onMqChange);
    window.addEventListener("resize", onLayoutChange);
    window.addEventListener("orientationchange", onOrientationChange);
    window.addEventListener("pageshow", onLayoutChange);
    window.addEventListener("popstate", onSettledLayoutChange);
    document.addEventListener("visibilitychange", onVisibilityChange);
    document.addEventListener("touchstart", onTouchStartCapture, {
      capture: true,
      passive: true,
    });
    document.addEventListener("touchmove", onTouchMoveCapture, {
      capture: true,
      passive: true,
    });
    document.addEventListener("touchend", onTouchEndCapture, {
      capture: true,
      passive: false,
    });
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("scroll", onListingScroll, {
      capture: true,
      passive: true,
    });
    window.visualViewport?.addEventListener("resize", onVisualViewportChange);
    window.visualViewport?.addEventListener("scroll", onVisualViewportChange);

    onLayoutChange();

    return () => {
      mq.removeEventListener("change", onMqChange);
      window.removeEventListener("resize", onLayoutChange);
      window.removeEventListener("orientationchange", onOrientationChange);
      window.removeEventListener("pageshow", onLayoutChange);
      window.removeEventListener("popstate", onSettledLayoutChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      document.removeEventListener("touchstart", onTouchStartCapture, true);
      document.removeEventListener("touchmove", onTouchMoveCapture, true);
      document.removeEventListener("touchend", onTouchEndCapture, true);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("scroll", onListingScroll, true);
      window.visualViewport?.removeEventListener("resize", onVisualViewportChange);
      window.visualViewport?.removeEventListener("scroll", onVisualViewportChange);
      lastStableHeightPx = 0;
      unfreezeShellHeight();
      unlockListingScroll();
      document.documentElement.style.removeProperty(LISTING_SHELL_HEIGHT_VAR);
    };
  }, []);
}
