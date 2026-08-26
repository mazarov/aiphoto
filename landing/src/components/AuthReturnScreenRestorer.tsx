"use client";

import { useLayoutEffect, useRef } from "react";
import { useFotoVPromtMobileModal } from "@/context/FotoVPromtMobileModalContext";
import { usePricingModal } from "@/context/PricingModalContext";
import { usePromptCardModal } from "@/context/PromptCardModalContext";
import {
  consumeAuthReturnScrollY,
  isAuthReturnRestorePending,
} from "@/lib/auth-return-path";
import { pinAuthReturnCard } from "@/lib/auth-return-card-pin";
import {
  bindAuthReturnOverlay,
  consumeAuthReturnOverlay,
  resolveAuthReturnOverlay,
  resolveAuthReturnScrollY,
} from "@/lib/auth-return-screen";
import { beginClientCardOverlay } from "@/lib/client-card-overlay";
import {
  scheduleListingScrollRestore,
  startListingScrollFill,
  writeSavedListingScrollY,
} from "@/lib/scroll-preservation";

/**
 * After OAuth, restore listing Y first, then reopen the prompt card.
 * Overlay and scroll come from the return URL first, then cookies —
 * sessionStorage alone does not survive the IdP hop.
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
    const scrollY = resolveAuthReturnScrollY();
    consumeAuthReturnScrollY();
    if (scrollY !== null && scrollY > 0) {
      writeSavedListingScrollY(scrollY);
    }

    if (overlay?.type === "card") {
      if (scrollY !== null && scrollY > 0) {
        startListingScrollFill(scrollY);
      }
      pinAuthReturnCard(overlay.slug);
      beginClientCardOverlay(overlay.slug);
      bindAuthReturnOverlay(null);
      openCard(overlay.slug);
      return;
    }
    if (overlay?.type === "pricing") {
      if (scrollY !== null && scrollY > 0) {
        startListingScrollFill(scrollY);
      }
      openPricing();
      return;
    }
    if (overlay?.type === "foto-v-promt") {
      if (scrollY !== null && scrollY > 0) {
        startListingScrollFill(scrollY);
      }
      openFoto();
      return;
    }

    scheduleListingScrollRestore();
  }, [openCard, openFoto, openPricing]);

  return null;
}
