"use client";

import { useEffect, useCallback, useRef, useLayoutEffect } from "react";
import { useRouter } from "next/navigation";

const SCROLL_POS_KEY = "card_modal_scroll_pos";

type Props = {
  children: React.ReactNode;
  onClose?: () => void;
};

export function CardModal({ children, onClose }: Props) {
  const router = useRouter();
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isNavigatingBack = useRef(false);

  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
    } else {
      isNavigatingBack.current = true;
      // Disable automatic scroll restoration before navigating back
      if (typeof window !== "undefined") {
        window.history.scrollRestoration = "manual";
      }
      router.back();
    }
  }, [onClose, router]);

  // Restore scroll position synchronously before paint
  useLayoutEffect(() => {
    const originalScrollRestoration = window.history.scrollRestoration;
    const savedScrollY = sessionStorage.getItem(SCROLL_POS_KEY);
    
    return () => {
      // This runs synchronously when component unmounts (before paint)
      if (isNavigatingBack.current && savedScrollY) {
        const scrollY = parseInt(savedScrollY, 10);
        // Synchronous scroll restore - no animation frame to avoid flicker
        window.scrollTo(0, scrollY);
        sessionStorage.removeItem(SCROLL_POS_KEY);
      }
      // Restore default scroll behavior
      window.history.scrollRestoration = originalScrollRestoration;
    };
  }, []);

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

  // Lock body scroll when modal is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

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
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm p-4 md:p-8"
      aria-modal="true"
      role="dialog"
    >
      <div
        ref={contentRef}
        className="relative w-full max-w-5xl animate-in fade-in zoom-in-95 duration-200"
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
