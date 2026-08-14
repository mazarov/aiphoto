"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePricingModal } from "@/context/PricingModalContext";
import { PricingScreen } from "@/components/pricing/PricingScreen";
import {
  scheduleListingScrollRestore,
  unlockListingScrollStyles,
} from "@/lib/scroll-preservation";

export function ClientPricingModal() {
  const { isOpen, close } = usePricingModal();
  const [mounted, setMounted] = useState(false);
  const deferredCleanupRef = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const deferScrollRestore = useCallback(() => {
    deferredCleanupRef.current = window.setTimeout(() => {
      scheduleListingScrollRestore();
      deferredCleanupRef.current = null;
    }, 0);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    if (deferredCleanupRef.current !== null) {
      window.clearTimeout(deferredCleanupRef.current);
      deferredCleanupRef.current = null;
    }

    const isMobileListingShell = window.matchMedia("(max-width: 1023px)").matches;
    if (isMobileListingShell) {
      return () => {
        unlockListingScrollStyles();
        deferScrollRestore();
      };
    }

    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
      deferScrollRestore();
    };
  }, [isOpen, deferScrollRestore]);

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, close]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target;
      const onSurface =
        target instanceof Element && target.closest("[data-pricing-modal-surface]");
      if (!onSurface) close();
    },
    [close],
  );

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[260] flex items-stretch justify-center overflow-hidden bg-white lg:items-start lg:overflow-y-auto lg:bg-black/60 lg:p-6 lg:backdrop-blur-sm xl:p-8"
      aria-modal="true"
      role="dialog"
      aria-labelledby="pricing-heading"
    >
      <div
        data-pricing-modal-surface
        className="relative flex min-h-0 w-full flex-col lg:my-auto lg:max-w-7xl"
      >
        <button
          type="button"
          onClick={close}
          className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 transition-colors hover:bg-zinc-200 lg:-top-3 lg:-right-3 lg:bg-zinc-900/90 lg:text-white lg:shadow-lg lg:ring-1 lg:ring-white/15 lg:hover:bg-zinc-800"
          aria-label="Закрыть"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain max-lg:h-[100dvh] max-lg:pt-12 lg:max-h-[min(90dvh,56rem)] lg:rounded-2xl lg:bg-white lg:shadow-2xl">
          <PricingScreen variant="modal" />
        </div>
      </div>
    </div>,
    document.body,
  );
}
