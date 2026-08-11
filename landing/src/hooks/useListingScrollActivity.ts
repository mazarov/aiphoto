"use client";

import { useEffect, useState } from "react";
import { getListingScrollRoot } from "@/lib/scroll-preservation";

const SCROLL_IDLE_MS = 280;

type Options = {
  /** When false, always reports not scrolling. */
  enabled?: boolean;
  /**
   * Minimum absolute scroll distance (px) before reporting active.
   * Filters trackpad / touch jitter so compose plate doesn’t collapse on tiny moves.
   */
  minDeltaPx?: number;
};

function readScrollY(root: EventTarget): number {
  if (root === window) {
    return window.scrollY || document.documentElement.scrollTop || 0;
  }
  if (root instanceof Element) return root.scrollTop;
  return 0;
}

/**
 * True while the listing scroll container (or window on desktop) is moving
 * past `minDeltaPx`; flips back to false shortly after scroll stops.
 */
export function useListingScrollActivity(options: Options = {}): boolean {
  const { enabled = true, minDeltaPx = 0 } = options;
  const [scrolling, setScrolling] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setScrolling(false);
      return;
    }

    let idleTimer = 0;
    let accumulated = 0;
    let armed = false;
    const roots = new Set<EventTarget>();
    roots.add(window);
    const listingRoot = getListingScrollRoot();
    if (listingRoot !== window) roots.add(listingRoot);

    const lastY = new Map<EventTarget, number>();
    for (const root of roots) {
      lastY.set(root, readScrollY(root));
    }

    const onScroll = (event: Event) => {
      const root = event.currentTarget as EventTarget;
      const y = readScrollY(root);
      const prev = lastY.get(root) ?? y;
      lastY.set(root, y);
      accumulated += Math.abs(y - prev);

      if (!armed && accumulated >= Math.max(0, minDeltaPx)) {
        armed = true;
        setScrolling(true);
      } else if (armed) {
        setScrolling(true);
      }

      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        setScrolling(false);
        accumulated = 0;
        armed = false;
      }, SCROLL_IDLE_MS);
    };

    for (const root of roots) {
      root.addEventListener("scroll", onScroll, { passive: true });
    }

    return () => {
      window.clearTimeout(idleTimer);
      for (const root of roots) {
        root.removeEventListener("scroll", onScroll);
      }
    };
  }, [enabled, minDeltaPx]);

  return scrolling;
}
