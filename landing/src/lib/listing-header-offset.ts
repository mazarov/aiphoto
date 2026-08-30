import { PS_UNPAID_BANNER_HEIGHT_VAR } from "@/lib/unpaid-checkout-banner";

/** CSS variable synced from `HeaderClient` — height of sticky site header (px). */
export const PS_HEADER_HEIGHT_VAR = "--ps-header-height";

export const PS_HEADER_HEIGHT_FALLBACK_PX = 57;

export function syncHeaderHeightCssVar(headerEl: HTMLElement): void {
  document.documentElement.style.setProperty(
    PS_HEADER_HEIGHT_VAR,
    `${Math.round(headerEl.offsetHeight)}px`
  );
}

export function syncUnpaidBannerHeightCssVar(heightPx: number): void {
  document.documentElement.style.setProperty(
    PS_UNPAID_BANNER_HEIGHT_VAR,
    `${Math.max(0, Math.round(heightPx))}px`
  );
}
