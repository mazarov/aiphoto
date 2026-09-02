"use client";

import { closeRobokassaOverlay } from "./robokassa-browser";
import {
  clearRobokassaReturnPath,
  createRobokassaReturnMessage,
  isRobokassaEmbeddedFrame,
  isRobokassaPaymentPath,
  isRobokassaReturnMessage,
  readRobokassaReturnPath,
} from "./robokassa-return";

export function returnFromRobokassaCheckout(): void {
  if (typeof window === "undefined") return;

  if (isRobokassaEmbeddedFrame()) {
    try {
      window.parent.postMessage(
        createRobokassaReturnMessage(),
        window.location.origin,
      );
    } catch {
      // Parent listener is the same-origin fallback.
    }
    try {
      const parentWindow = window.parent as Window & {
        Robokassa?: { ClosePaymentForm?: () => void };
      };
      parentWindow.Robokassa?.ClosePaymentForm?.();
      parentWindow.document.getElementById("robokassa_iframe")?.remove();
    } catch {
      // Cross-origin parent — postMessage is enough.
    }
    return;
  }

  const path = readRobokassaReturnPath();
  const current = window.location.pathname + window.location.search;
  clearRobokassaReturnPath();
  if (!isRobokassaPaymentPath(current) && current === path) return;
  window.location.replace(path);
}

export function handleParentRobokassaReturnMessage(event: MessageEvent): void {
  if (event.origin !== window.location.origin) return;
  if (!isRobokassaReturnMessage(event.data)) return;
  closeRobokassaOverlay();
}
