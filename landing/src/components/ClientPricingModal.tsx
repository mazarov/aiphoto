"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePricingModal } from "@/context/PricingModalContext";
import { PricingScreen } from "@/components/pricing/PricingScreen";
import { usePricingPaywallVariant } from "@/lib/pricing-paywall-experiment";
import {
  scheduleListingScrollRestore,
  unlockListingScrollStyles,
} from "@/lib/scroll-preservation";

export function ClientPricingModal() {
  const { isOpen, close } = usePricingModal();
  const paywallVariant = usePricingPaywallVariant();
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
      className="fixed inset-0 z-[260] flex items-center justify-center overflow-hidden bg-zinc-950/45 p-3 backdrop-blur-sm sm:p-5"
      aria-modal="true"
      role="dialog"
      aria-labelledby="pricing-heading"
    >
      <div
        data-pricing-modal-surface
        className="relative flex min-h-0 w-full max-w-[36rem] flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[min(94dvh,60rem)]"
      >
        <button
          type="button"
          onClick={close}
          className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3 z-20 flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white/90 text-zinc-700 shadow-md ring-1 ring-black/10 backdrop-blur transition-colors hover:bg-white hover:text-zinc-950"
          aria-label="Закрыть"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        <div className="min-h-0 max-h-[calc(100dvh-1.5rem)] flex-1 overflow-y-auto overscroll-contain rounded-[28px] bg-white shadow-2xl sm:max-h-[min(94dvh,60rem)]">
          <PricingScreen
            variant="modal"
            paywallVariant={paywallVariant}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
