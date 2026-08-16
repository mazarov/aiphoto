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
      <div className="relative z-10 min-h-0 flex-1 overflow-hidden">
        <PromptSceneLiteWidget variant="immersive" onClose={close} />
      </div>
    </div>,
    document.body,
  );
}
