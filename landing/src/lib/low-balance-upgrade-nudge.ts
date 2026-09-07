import type { LivePricingOffer } from "@/lib/mail-checkout-offer";

function normalizePath(path: string): string {
  if (!path || path === "/") return "/";
  return path.endsWith("/") ? path.slice(0, -1) : path;
}

/** Mobile bar stays on listing/compose. Hide only checkout and admin chrome. */
const MOBILE_BAR_BLOCKED_EXACT = new Set([
  "/pricing",
  "/admin",
  "/payment",
  "/embed",
  "/unsubscribe",
]);

const MOBILE_BAR_BLOCKED_PREFIXES = [
  "/pricing/",
  "/admin/",
  "/payment/",
  "/embed/",
  "/unsubscribe/",
] as const;

export function lowBalanceNudgeBlockedByPath(pathname: string): boolean {
  const path = normalizePath(pathname);
  if (MOBILE_BAR_BLOCKED_EXACT.has(path)) return true;
  return MOBILE_BAR_BLOCKED_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export function isLowBalanceUpgradeOffer(
  offer: LivePricingOffer | null,
): offer is LivePricingOffer {
  return (
    offer != null &&
    offer.sourceTemplateId === "low_balance_upgrade" &&
    offer.targetPlanId === "start" &&
    offer.percent === 20
  );
}

export const LOW_BALANCE_NUDGE_DISMISS_MS = 24 * 60 * 60 * 1000;

export function lowBalanceNudgeHideStorageKey(offerId: string): string {
  return `ps:low-balance-nudge-hide:${offerId}`;
}

export function isLowBalanceNudgeHiddenUntil(
  hiddenUntilMs: number | null,
  nowMs = Date.now(),
): boolean {
  return hiddenUntilMs != null && hiddenUntilMs > nowMs;
}

export function readLowBalanceNudgeHiddenUntil(offerId: string): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(lowBalanceNudgeHideStorageKey(offerId));
    const until = Number(raw);
    return Number.isFinite(until) ? until : null;
  } catch {
    return null;
  }
}

export function remainingOfferMs(expiresAt: string, nowMs = Date.now()): number {
  const ends = Date.parse(expiresAt);
  if (!Number.isFinite(ends)) return 0;
  return Math.max(0, ends - nowMs);
}

/** `H:MM:SS` — offer window is 24h, so hours stay in 0–23. */
export function formatOfferCountdown(remainingMs: number): string {
  const clamped = Math.max(0, Math.floor(remainingMs / 1000));
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = clamped % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function rememberLowBalanceNudgeDismissed(
  offerId: string,
  nowMs = Date.now(),
): number {
  const until = nowMs + LOW_BALANCE_NUDGE_DISMISS_MS;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        lowBalanceNudgeHideStorageKey(offerId),
        String(until),
      );
    } catch {
      // private mode — session hide still works via React state
    }
  }
  return until;
}
