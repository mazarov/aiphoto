"use client";

import { useLayoutEffect, useRef } from "react";
import { useFotoVPromtMobileModal } from "@/context/FotoVPromtMobileModalContext";
import { useGenerateDock } from "@/context/GenerateDockContext";
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
  const { restoreFromAuthReturn } = useGenerateDock();
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
      void import("@/components/ClientCardModal");
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
      void import("@/components/ClientPricingModal");
      if (scrollY !== null && scrollY > 0) {
        startListingScrollFill(scrollY);
      }
      openPricing();
      return;
    }
    if (overlay?.type === "generate-dock") {
      if (scrollY !== null && scrollY > 0) {
        startListingScrollFill(scrollY);
      }
      restoreFromAuthReturn(overlay.intent);
      return;
    }
    if (overlay?.type === "foto-v-promt") {
      void import("@/components/foto-v-promt/FotoVPromtMobileModal");
      if (scrollY !== null && scrollY > 0) {
        startListingScrollFill(scrollY);
      }
      openFoto();
      return;
    }

    scheduleListingScrollRestore();
  }, [openCard, openFoto, openPricing, restoreFromAuthReturn]);

  return null;
}
