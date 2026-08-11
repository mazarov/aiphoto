"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { GenerateSurface } from "@/components/generate/GenerateSurface";
import { useGenerateMobileModal } from "@/context/GenerateMobileModalContext";
import {
  scheduleListingScrollRestore,
  unlockListingScrollStyles,
} from "@/lib/scroll-preservation";

/**
 * Mobile portal host for the generate module outside hard /generate page:
 * - blank → dock over history
 * - card → fullscreen modal (desktop card uses aside via GenerateSurface in CardPageClient)
 */
export function GenerateMobileModal() {
  const { isOpen, entry, close } = useGenerateMobileModal();
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

  const isCardModal = entry.source === "card";

  return createPortal(
    <div
      className="fixed inset-0 z-[122] flex h-screen min-h-0 flex-col overflow-hidden bg-white text-zinc-900 lg:hidden supports-[height:100dvh]:h-[100dvh]"
      role="dialog"
      aria-modal="true"
      aria-label={isCardModal ? "Новая генерация" : "История"}
    >
      {isCardModal ? (
        <GenerateSurface
          presentation="modal"
          layout="mobile"
          onBack={close}
          entry={entry}
        />
      ) : (
        <GenerateSurface presentation="dock" layout="mobile" onBack={close} />
      )}
    </div>,
    document.body,
  );
}
