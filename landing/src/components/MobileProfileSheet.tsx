"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  holdListingChromeAutoHide,
  releaseListingChromeAutoHide,
} from "@/hooks/useListingChromeAutoHide";
import { SidebarAccountPanel } from "./AccountControls";

const BACKDROP_ARM_MS = 400;

type Props = {
  open: boolean;
  onClose: () => void;
};

export function MobileProfileSheet({ open, onClose }: Props) {
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
    holdListingChromeAutoHide("profile");
    return () => releaseListingChromeAutoHide("profile");
  }, [open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[270] flex flex-col justify-end lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Профиль"
    >
      <button
        type="button"
        className={`absolute inset-0 bg-zinc-900/40 backdrop-blur-[2px] ${
          backdropLive ? "" : "pointer-events-none"
        }`}
        aria-label="Закрыть"
        onClick={onClose}
      />

      <div
        className="relative z-10 max-h-[min(88dvh,40rem)] overflow-y-auto overscroll-contain rounded-t-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-zinc-200" />
        </div>
        <SidebarAccountPanel onNavigate={onClose} showBalance />
        <div className="h-[max(1rem,env(safe-area-inset-bottom,1rem))]" />
      </div>
    </div>,
    document.body,
  );
}
