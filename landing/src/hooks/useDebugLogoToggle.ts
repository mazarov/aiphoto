"use client";

import { useRef, useCallback } from "react";
import { scrollCatalogToTop } from "@/lib/scroll-preservation";

const CLICKS_REQUIRED = 5;
const RESET_MS = 1500;

/**
 * 5 быстрых кликов по логотипу на главной → toggle debug.
 * Одиночный клик (без жеста) → scrollCatalogToTop.
 */
export function useDebugLogoToggle(onToggle: () => void, enabled: boolean) {
  const clickCount = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLogoClick = useCallback(
    (e: React.MouseEvent) => {
      if (!enabled) return false;

      e.preventDefault();
      clickCount.current += 1;
      if (timer.current) clearTimeout(timer.current);

      if (clickCount.current >= CLICKS_REQUIRED) {
        clickCount.current = 0;
        onToggle();
        return true;
      }

      const clicksAtTimeout = clickCount.current;
      timer.current = setTimeout(() => {
        clickCount.current = 0;
        if (clicksAtTimeout === 1) {
          scrollCatalogToTop();
        }
      }, RESET_MS);

      return false;
    },
    [enabled, onToggle]
  );

  return handleLogoClick;
}
