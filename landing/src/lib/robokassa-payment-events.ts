"use client";

import { saveRobokassaReturnPath } from "./robokassa-return";

export const ROBOKASSA_PAYMENT_STARTED_EVENT = "promptshot:robokassa-payment-started";
const ACTIVE_PAYMENT_KEY = "promptshot:robokassa-active-payment";

export function announceRobokassaPayment(
  paymentId: string,
  returnPath?: string | null,
): void {
  saveRobokassaReturnPath(
    returnPath ||
      (typeof window === "undefined"
        ? "/"
        : window.location.pathname + window.location.search),
  );
  try {
    sessionStorage.setItem(ACTIVE_PAYMENT_KEY, paymentId);
  } catch {
    // Polling still starts through the in-page event.
  }
  window.dispatchEvent(
    new CustomEvent<string>(ROBOKASSA_PAYMENT_STARTED_EVENT, { detail: paymentId }),
  );
}

export function readActiveRobokassaPayment(): string | null {
  try {
    return sessionStorage.getItem(ACTIVE_PAYMENT_KEY);
  } catch {
    return null;
  }
}

export function clearActiveRobokassaPayment(paymentId: string): void {
  try {
    if (sessionStorage.getItem(ACTIVE_PAYMENT_KEY) === paymentId) {
      sessionStorage.removeItem(ACTIVE_PAYMENT_KEY);
    }
  } catch {
    // ignore
  }
}
