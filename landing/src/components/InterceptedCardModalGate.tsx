"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import {
  isClientCardOverlayActive,
  shouldRenderInterceptedCardModal,
  subscribeClientCardOverlay,
} from "@/lib/client-card-overlay";

/**
 * Next 15 rematches `@modal/(.)p/[slug]` after `ClientCardModal` `pushState('/p/slug')`.
 * That second viewer has no listing-neighbor handler and must not render.
 */
export function InterceptedCardModalGate({ children }: { children: ReactNode }) {
  const clientOverlayActive = useSyncExternalStore(
    subscribeClientCardOverlay,
    isClientCardOverlayActive,
    () => false
  );
  if (!shouldRenderInterceptedCardModal(clientOverlayActive)) return null;
  return children;
}
