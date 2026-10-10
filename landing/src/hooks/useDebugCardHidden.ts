"use client";

import { useEffect, useRef } from "react";
import {
  DEBUG_CARD_VISIBILITY_EVENT,
  type DebugCardVisibilityDetail,
} from "@/lib/debug-tools-session";

/** Drops a card from the mounted public listing after admin hide. */
export function useDebugCardHidden(
  onHidden: (detail: DebugCardVisibilityDetail) => void,
): void {
  const onHiddenRef = useRef(onHidden);
  onHiddenRef.current = onHidden;

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<DebugCardVisibilityDetail>).detail;
      if (!detail?.cardId || detail.published !== false) return;
      onHiddenRef.current(detail);
    };
    window.addEventListener(DEBUG_CARD_VISIBILITY_EVENT, handler);
    return () => window.removeEventListener(DEBUG_CARD_VISIBILITY_EVENT, handler);
  }, []);
}
