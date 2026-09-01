/** Site-wide unpaid YooKassa bar. Clock SSOT = flash grant from yk_abandon_5m. */

import { isYooKassaCheckoutHost } from "./payment-provider-hosts";

export const UNPAID_BANNER_TTL_MS = 24 * 60 * 60 * 1000;
export const UNPAID_BANNER_DISCOUNT_AFTER_MS = 15 * 60 * 1000;
export const YK_ABANDON_FLASH_PERCENT = 25;
/** Same TTL as `landing_upsert_pricing_offer` for `yk_abandon_5m`. */
export const YK_ABANDON_FLASH_TTL_MS = 60 * 60 * 1000;
/** Mail due is created_at + 5 min. Grant expires at created_at + 5 min + 60 min. */
export const YK_ABANDON_FLASH_DUE_MS = 5 * 60 * 1000;

export const UNPAID_BANNER_DISMISS_STORAGE_KEY = "promptshot:unpaid-banner-dismiss";
export const PS_UNPAID_BANNER_HEIGHT_VAR = "--ps-unpaid-banner-height";

export type UnpaidBannerPhase = "unpaid" | "flash";

export type UnpaidBannerView =
  | { visible: false }
  | {
      visible: true;
      phase: UnpaidBannerPhase;
      paymentId: string;
      planId: string;
      credits: number;
      remainingMs: number | null;
    };

export type UnpaidBannerSnapshot = {
  paymentId: string;
  planId: string;
  credits: number;
  createdAt: string;
  creditedAt?: string | null;
  status?: string | null;
  offer?: { percent: number; expiresAt: string } | null;
};

export function isSafeYooKassaConfirmationUrl(value: string | null | undefined): boolean {
  try {
    const url = new URL(value?.trim() || "");
    if (url.protocol !== "https:") return false;
    return isYooKassaCheckoutHost(url.hostname);
  } catch {
    return false;
  }
}

export function unpaidBannerDismissedPaymentId(storage: Pick<Storage, "getItem"> | null): string {
  if (!storage) return "";
  try {
    return storage.getItem(UNPAID_BANNER_DISMISS_STORAGE_KEY)?.trim() || "";
  } catch {
    return "";
  }
}

export function persistUnpaidBannerDismiss(
  storage: Pick<Storage, "setItem"> | null,
  paymentId: string,
): void {
  const id = paymentId.trim();
  if (!storage || !id) return;
  try {
    storage.setItem(UNPAID_BANNER_DISMISS_STORAGE_KEY, id);
  } catch {
    // private mode
  }
}

export function isUnpaidBannerPathHidden(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  return (
    path === "/admin" ||
    path.startsWith("/admin/") ||
    path.startsWith("/embed/") ||
    path.startsWith("/auth/")
  );
}

export function isLiveUnpaidYookassaStatus(status: string | null | undefined): boolean {
  return status === "created" || status === "pending" || status === "canceled";
}

export function formatUnpaidBannerCountdown(remainingMs: number): string {
  const clamped = Math.max(0, Math.floor(remainingMs / 1000));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function unpaidBannerCopy(view: Extract<UnpaidBannerView, { visible: true }>): {
  message: string;
  action: string;
} {
  const tokens = `${view.credits} токенов`;
  if (view.phase === "flash") {
    return {
      message: `Оплати в течение 60 минут и получи скидку 25% · ${tokens}`,
      action: "Продолжить",
    };
  }
  return {
    message: `Незавершенная оплата: ${tokens}`,
    action: "Продолжить",
  };
}

export function resolveUnpaidBanner(input: {
  nowMs: number;
  snapshot: UnpaidBannerSnapshot | null;
  dismissedPaymentId?: string;
  paymentQueryPresent?: boolean;
}): UnpaidBannerView {
  const snap = input.snapshot;
  if (!snap) return { visible: false };
  if (input.paymentQueryPresent) return { visible: false };
  if (input.dismissedPaymentId && input.dismissedPaymentId === snap.paymentId) {
    return { visible: false };
  }
  if (snap.creditedAt) return { visible: false };
  if (snap.status && !isLiveUnpaidYookassaStatus(snap.status)) {
    return { visible: false };
  }

  const createdAtMs = Date.parse(snap.createdAt);
  const credits = Number(snap.credits);
  if (!Number.isFinite(createdAtMs) || createdAtMs <= 0) return { visible: false };
  if (!Number.isFinite(credits) || credits <= 0) return { visible: false };
  if (input.nowMs - createdAtMs >= UNPAID_BANNER_TTL_MS) return { visible: false };

  const offerPercent = snap.offer?.percent ?? null;
  const offerExpiresAtMs = snap.offer?.expiresAt ? Date.parse(snap.offer.expiresAt) : NaN;
  const flashLive =
    offerPercent === YK_ABANDON_FLASH_PERCENT &&
    Number.isFinite(offerExpiresAtMs) &&
    offerExpiresAtMs > input.nowMs;
  const discountUnlocked =
    input.nowMs - createdAtMs >= UNPAID_BANNER_DISCOUNT_AFTER_MS;

  if (flashLive && discountUnlocked) {
    return {
      visible: true,
      phase: "flash",
      paymentId: snap.paymentId,
      planId: snap.planId,
      credits,
      remainingMs: offerExpiresAtMs - input.nowMs,
    };
  }

  return {
    visible: true,
    phase: "unpaid",
    paymentId: snap.paymentId,
    planId: snap.planId,
    credits,
    remainingMs: null,
  };
}
