"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useFotoVPromtMobileModal } from "@/context/FotoVPromtMobileModalContext";
import {
  scheduleListingScrollRestore,
  unlockListingScrollStyles,
} from "@/lib/scroll-preservation";
import { PromptSceneLiteWidget } from "./PromptSceneLiteWidget";

export function FotoVPromtMobileModal() {
  const { isOpen, close } = useFotoVPromtMobileModal();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, close]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      unlockListingScrollStyles();
      scheduleListingScrollRestore();
    };
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-[#09090b] text-zinc-50 lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Фото в промт"
    >
      <header className="relative z-20 flex shrink-0 items-center gap-2 border-b border-white/10 px-3 pb-2.5 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={close}
          aria-label="Закрыть"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <p className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-tight text-zinc-50">
          Фото в промт
        </p>
      </header>

      <div className="relative z-10 min-h-0 flex-1 overflow-hidden">
        <PromptSceneLiteWidget variant="immersive" />
      </div>
    </div>,
    document.body,
  );
}
