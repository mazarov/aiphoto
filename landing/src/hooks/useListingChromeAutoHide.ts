"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";
import { usePathname } from "next/navigation";
import { getListingScrollRoot } from "@/lib/scroll-preservation";
import { isListingShellKeyboardFrozen } from "@/lib/listing-shell-viewport";
import { LISTING_MOBILE_MQ } from "@/hooks/useListingIsMobile";

/** Accumulated down-scroll before chrome hides (Ozon-like). */
const HIDE_DELTA_PX = 24;
/** Accumulated up-scroll before chrome shows — much smaller than hide. */
const SHOW_DELTA_PX = 4;
const SHOW_TOP_PX = 16;
/** Ignore sub-pixel / finger wobble as a direction change. */
const DIRECTION_PX = 1;
const HIDDEN_CLASS = "listing-chrome-hidden";

type Controller = {
  shell: HTMLElement;
  lastY: number;
  acc: number;
  hidden: boolean;
  raf: number;
  mq: MediaQueryList;
  root: EventTarget;
  onScroll: () => void;
  onMqChange: () => void;
};

let controller: Controller | null = null;
let blocked = false;
const holds = new Set<string>();

function readScrollTop(root: EventTarget): number {
  if (root === window) return window.scrollY || document.documentElement.scrollTop || 0;
  if (root instanceof Element) return root.scrollTop;
  return 0;
}

function isLocked() {
  return blocked || holds.size > 0;
}

function applyHiddenClass() {
  const c = controller;
  if (!c) return;
  const shouldHide = c.hidden && c.mq.matches && !isLocked();
  c.shell.classList.toggle(HIDDEN_CLASS, shouldHide);
}

function setHidden(next: boolean) {
  const c = controller;
  if (!c) return;
  c.hidden = next;
  applyHiddenClass();
}

function bindScrollRoot(c: Controller) {
  const next = getListingScrollRoot();
  if (c.root === next) return;
  c.root.removeEventListener("scroll", c.onScroll);
  c.root = next;
  c.lastY = readScrollTop(next);
  c.acc = 0;
  next.addEventListener("scroll", c.onScroll, { passive: true });
}

function tickScroll() {
  const c = controller;
  if (!c) return;
  bindScrollRoot(c);
  if (!c.mq.matches) {
    setHidden(false);
    return;
  }
  if (isLocked() || isListingShellKeyboardFrozen()) {
    setHidden(false);
    c.lastY = readScrollTop(c.root);
    c.acc = 0;
    return;
  }
  const y = readScrollTop(c.root);
  const delta = y - c.lastY;
  c.lastY = y;
  if (y < SHOW_TOP_PX) {
    c.acc = 0;
    setHidden(false);
    return;
  }
  if (Math.abs(delta) >= DIRECTION_PX) {
    if ((delta > 0 && c.acc < 0) || (delta < 0 && c.acc > 0)) {
      c.acc = 0;
    }
  }
  c.acc += delta;
  if (c.acc >= HIDE_DELTA_PX) {
    c.acc = 0;
    setHidden(true);
  } else if (c.acc <= -SHOW_DELTA_PX) {
    c.acc = 0;
    setHidden(false);
  }
}

function scheduleScrollTick() {
  const c = controller;
  if (!c || c.raf) return;
  c.raf = window.requestAnimationFrame(() => {
    c.raf = 0;
    tickScroll();
  });
}

function cancelPendingTick() {
  const c = controller;
  if (!c?.raf) return;
  cancelAnimationFrame(c.raf);
  c.raf = 0;
}

export function holdListingChromeAutoHide(id: string) {
  holds.add(id);
  cancelPendingTick();
  setHidden(false);
}

export function releaseListingChromeAutoHide(id: string) {
  holds.delete(id);
  applyHiddenClass();
}

/** Generate dock / other overlays: force chrome visible without a React commit. */
export function setListingChromeAutoHideBlocked(next: boolean) {
  blocked = next;
  if (next) {
    cancelPendingTick();
    setHidden(false);
  } else {
    applyHiddenClass();
  }
}

function detachListingChromeAutoHide() {
  const c = controller;
  if (!c) return;
  if (c.raf) cancelAnimationFrame(c.raf);
  c.root.removeEventListener("scroll", c.onScroll);
  c.mq.removeEventListener("change", c.onMqChange);
  c.shell.classList.remove(HIDDEN_CLASS);
  controller = null;
}

function attachListingChromeAutoHide(shell: HTMLElement): () => void {
  detachListingChromeAutoHide();
  const mq = window.matchMedia(LISTING_MOBILE_MQ);
  const root = getListingScrollRoot();
  const c: Controller = {
    shell,
    lastY: readScrollTop(root),
    acc: 0,
    hidden: false,
    raf: 0,
    mq,
    root,
    onScroll: scheduleScrollTick,
    onMqChange: () => {
      bindScrollRoot(c);
      if (!mq.matches) setHidden(false);
    },
  };
  controller = c;
  applyHiddenClass();
  root.addEventListener("scroll", c.onScroll, { passive: true });
  mq.addEventListener("change", c.onMqChange);
  return detachListingChromeAutoHide;
}

function resetListingChromeAutoHide() {
  if (!controller) return;
  controller.lastY = 0;
  controller.acc = 0;
  setHidden(false);
}

/**
 * Hide listing header + tab bar on scroll down; show on reverse / near top.
 * Accumulated displacement (not per-frame): hide after ~24px down, show after ~4px up.
 * Toggles `.listing-chrome-hidden` on the shell node (no React state / grid commit).
 * Blocked by search/profile sheets, generate dock, and keyboard freeze.
 */
export function useListingChromeAutoHide(): RefObject<HTMLDivElement | null> {
  const pathname = usePathname();
  const shellRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    return attachListingChromeAutoHide(el);
  }, []);

  useLayoutEffect(() => {
    resetListingChromeAutoHide();
  }, [pathname]);

  return shellRef;
}
