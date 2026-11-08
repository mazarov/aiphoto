"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  isClientCardOverlayBlocking,
  shouldRenderInterceptedCardModal,
  subscribeClientCardOverlay,
} from "@/lib/client-card-overlay";

/**
 * Next 15 rematches `@modal/(.)p/[slug]` after `ClientCardModal` `pushState('/p/slug')`.
 * That second viewer has no listing-neighbor handler and must not render.
 */
export function InterceptedCardModalGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const clientOverlayBlocking = useSyncExternalStore(
    subscribeClientCardOverlay,
    isClientCardOverlayBlocking,
    () => false
  );
  if (!shouldRenderInterceptedCardModal(clientOverlayBlocking, pathname)) return null;
  return children;
}
