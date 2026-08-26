"use client";

import { useLayoutEffect, useRef } from "react";
import { useFotoVPromtMobileModal } from "@/context/FotoVPromtMobileModalContext";
import { usePricingModal } from "@/context/PricingModalContext";
import { usePromptCardModal } from "@/context/PromptCardModalContext";
import { isAuthReturnRestorePending } from "@/lib/auth-return-path";
import {
  consumeAuthReturnOverlay,
  resolveAuthReturnOverlay,
} from "@/lib/auth-return-screen";
import {
  SCROLL_KEY,
  scheduleListingScrollRestore,
} from "@/lib/scroll-preservation";

function peekSavedListingScroll(): string | null {
  try {
    return sessionStorage.getItem(SCROLL_KEY);
  } catch {
    return null;
  }
}

function writeSavedListingScroll(value: string | null): void {
  if (!value) return;
  try {
    sessionStorage.setItem(SCROLL_KEY, value);
  } catch {
    // private mode / quota
  }
}

/**
 * After OAuth, reopen the prompt card (or pricing / foto-v-promt) on the
 * listing. Overlay is taken from `?ps_ov=` first, then the cookie — so a
 * lost sessionStorage cannot close the card the user started from.
 */
export function AuthReturnScreenRestorer() {
  const { open: openCard } = usePromptCardModal();
  const { open: openPricing } = usePricingModal();
  const { open: openFoto } = useFotoVPromtMobileModal();
  const ranRef = useRef(false);

  useLayoutEffect(() => {
    if (ranRef.current) return;
    if (!isAuthReturnRestorePending()) return;
    ranRef.current = true;

    const overlay = resolveAuthReturnOverlay();
    consumeAuthReturnOverlay();
    const saved = peekSavedListingScroll();

    if (overlay?.type === "card") {
      openCard(overlay.slug);
      writeSavedListingScroll(saved);
      return;
    }
    if (overlay?.type === "pricing") {
      openPricing();
      writeSavedListingScroll(saved);
      return;
    }
    if (overlay?.type === "foto-v-promt") {
      openFoto();
      writeSavedListingScroll(saved);
      return;
    }

    scheduleListingScrollRestore();
  }, [openCard, openFoto, openPricing]);

  return null;
}
