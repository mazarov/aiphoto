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

  // Handle click outside to close
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) {
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
          ? "fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm md:p-8 max-md:p-0"
          : "fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm p-4 md:p-8"
      }
      aria-modal="true"
      role="dialog"
    >
      <div
        className={
          immersiveMobile
            ? "relative w-full md:max-w-5xl animate-in fade-in zoom-in-95 duration-200"
            : "relative w-full max-w-5xl animate-in fade-in zoom-in-95 duration-200"
        }
      >
        {/* Close button */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute -top-3 -right-3 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg hover:bg-zinc-100 transition-colors md:-top-4 md:-right-4"
          aria-label="Закрыть"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-700">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>

        {/* Modal content container */}
        <div className="overflow-hidden rounded-2xl bg-white shadow-2xl">
          {children}
        </div>
      </div>
    </div>
  );
}
