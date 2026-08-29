"use client";

import { useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  scheduleListingScrollRestore,
  unlockListingScrollStyles,
} from "@/lib/scroll-preservation";

type Props = {
  children: React.ReactNode;
  onClose?: () => void;
  /** When true (and on mobile), the modal becomes full-viewport immersive (no side padding, full height content area).
   * Used to match the visual/behavior of direct /p/[slug] with photos on mobile. */
  immersiveMobile?: boolean;
};

export function CardModal({ children, onClose, immersiveMobile = false }: Props) {
  const router = useRouter();
  const overlayRef = useRef<HTMLDivElement>(null);
  const isNavigatingBack = useRef(false);
  const deferredCleanupRef = useRef<number | null>(null);
  const deferScrollRestore = useCallback(() => {
    deferredCleanupRef.current = window.setTimeout(() => {
      scheduleListingScrollRestore();
      deferredCleanupRef.current = null;
    }, 0);
  }, []);

  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
    } else {
      isNavigatingBack.current = true;
      if (typeof window !== "undefined") {
        window.history.scrollRestoration = "manual";
      }
      router.back();
    }
  }, [onClose, router]);

  // Close on Escape key
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        handleClose();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [handleClose]);

  // Lock scroll while open; restore listing position only after unlock (critical on desktop).
  useEffect(() => {
    // React StrictMode (dev) intentionally does mount->cleanup->mount once.
    // Cancel deferred cleanup from the synthetic unmount so restore runs only on real close.
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
      // Restore layout-affecting body styles immediately to avoid visible width "jump"
      // on close; only scroll restore stays deferred for StrictMode synthetic cleanup.
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
      deferScrollRestore();
    };
  }, [deferScrollRestore]);

  // Close when the click lands outside a real card surface. The transparent
  // desktop shell spans the full modal width, so checking only overlayRef would
  // incorrectly treat gaps between the photo and details panel as content.
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target;
      const clickedCardSurface =
        target instanceof Element &&
        target.closest("[data-card-modal-surface]");

      if (!clickedCardSurface) {
        handleClose();
      }
    },
    [handleClose]
  );

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className={
        immersiveMobile
          ? "fixed inset-0 z-[245] flex items-stretch justify-center overflow-hidden bg-zinc-950 max-md:p-0 md:z-50 md:items-center md:overflow-y-auto md:bg-black/60 md:backdrop-blur-sm md:p-6 lg:p-8"
          : "fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm p-4 md:items-center md:p-6 lg:p-8"
      }
      aria-modal="true"
      role="dialog"
    >
      <div
        className={
          immersiveMobile
            ? "relative h-full min-h-0 w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200 md:h-auto md:max-w-7xl md:overflow-visible"
            : "relative w-full max-w-7xl animate-in fade-in zoom-in-95 duration-200"
        }
      >
        {/* Close button — dark circle (reference); sits above the split, not on a white card */}
        <button
          type="button"
          onClick={handleClose}
          data-card-modal-surface
          className={`absolute -top-3 -right-3 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900/90 text-white shadow-lg ring-1 ring-white/15 backdrop-blur-md transition-colors hover:bg-zinc-800 md:-top-2 md:-right-2 max-md:bg-white max-md:text-zinc-700 max-md:ring-0 max-md:hover:bg-zinc-100${
            immersiveMobile ? " max-md:hidden" : ""
          }`}
          aria-label="Закрыть"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="max-md:text-zinc-700">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>

        {/* Photo cards (immersiveMobile): desktop shell is transparent so photo + dark panel float on the backdrop.
            Text-only cards keep the white rounded card on all breakpoints. */}
        <div
          data-card-modal-surface={immersiveMobile ? undefined : ""}
          className={
            immersiveMobile
              ? "h-full min-h-0 overflow-hidden bg-zinc-950 md:h-auto md:overflow-visible md:rounded-none md:bg-transparent md:shadow-none"
              : "overflow-hidden rounded-2xl bg-white shadow-2xl"
          }
        >
          {children}
        </div>
      </div>
    </div>
  );
}
