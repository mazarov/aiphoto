"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  holdListingChromeAutoHide,
  releaseListingChromeAutoHide,
} from "@/hooks/useListingChromeAutoHide";

const BACKDROP_ARM_MS = 400;

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

export function MobileCatalogMenuDrawer({ open, onClose, children }: Props) {
  const [mounted, setMounted] = useState(false);
  const [backdropLive, setBackdropLive] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setBackdropLive(false);
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const arm = window.setTimeout(() => setBackdropLive(true), BACKDROP_ARM_MS);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(arm);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    holdListingChromeAutoHide("menu");
    return () => releaseListingChromeAutoHide("menu");
  }, [open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[260] flex lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Категории"
    >
      <div
        className="relative z-10 flex h-full w-72 max-w-[85vw] flex-col bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 px-3 pb-1 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <p className="text-sm font-semibold text-zinc-900">Категории</p>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-900"
            aria-label="Закрыть"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
      <button
        type="button"
        className={`min-w-0 flex-1 bg-zinc-900/40 backdrop-blur-[2px] ${
          backdropLive ? "" : "pointer-events-none"
        }`}
        aria-label="Закрыть"
        onClick={onClose}
      />
    </div>,
    document.body,
  );
}
