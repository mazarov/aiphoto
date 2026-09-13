import { PS_UNPAID_BANNER_HEIGHT_VAR } from "@/lib/unpaid-checkout-banner";

/** CSS variable synced from `HeaderClient` — current visual header (px). */
export const PS_HEADER_HEIGHT_VAR = "--ps-header-height";

/**
 * In-flow spacer in `#listing-scroll-root`. Expanded header only.
 * Must not shrink when the logo collapses — that resizes the scroller mid-gesture
 * and a bad ResizeObserver reading (containing-block / 100vh) becomes a full-page hole.
 */
export const PS_HEADER_SPACER_VAR = "--ps-header-spacer";

/** Abspos header RO can report the shell (~100dvh). Never let the spacer follow that. */
export const LISTING_MOBILE_HEADER_HEIGHT_MAX_PX = 168;

/** Search row only (burger + field + tariffs or pay chip). */
export const PS_HEADER_SEARCH_ROW_FALLBACK_PX = 56;

/** Centered logo row above the search field. */
export const PS_HEADER_LOGO_ROW_FALLBACK_PX = 40;

/** Logo is visible only while the listing is at the very top. */
export const LISTING_MOBILE_LOGO_SHOW_TOP_PX = 16;

export function listingMobileLogoVisible(scrollTop: number): boolean {
  return scrollTop < LISTING_MOBILE_LOGO_SHOW_TOP_PX;
}

/**
 * `.listing-chrome-logo-hidden` — only scroll + viewport.
 * Holds (search focus, burger, sheets, generate dock) must not expand the logo.
 */
export function listingChromeLogoRowHidden(input: {
  isMobile: boolean;
  scrollTop: number;
}): boolean {
  return input.isMobile && !listingMobileLogoVisible(input.scrollTop);
}

/** Expanded mobile header (search + logo). First paint / CSS fallback. */
export const PS_HEADER_HEIGHT_FALLBACK_PX =
  PS_HEADER_SEARCH_ROW_FALLBACK_PX + PS_HEADER_LOGO_ROW_FALLBACK_PX;

export const LISTING_MOBILE_SEARCH_MIN_QUERY = 2;

export function listingMobileSearchHref(raw: string): string | null {
  const q = raw.trim();
  if (q.length < LISTING_MOBILE_SEARCH_MIN_QUERY) return null;
  return `/search?q=${encodeURIComponent(q)}`;
}

export function listingMobileHeaderHeightPx(options: {
  searchRowPx: number;
  logoVisible: boolean;
  logoRowPx?: number;
}): number {
  const search = Math.max(0, Math.round(options.searchRowPx));
  const logo = Math.max(0, Math.round(options.logoRowPx ?? PS_HEADER_LOGO_ROW_FALLBACK_PX));
  return search + (options.logoVisible ? logo : 0);
}

export function clampListingHeaderHeightPx(heightPx: number): number {
  if (!Number.isFinite(heightPx)) return 0;
  return Math.min(LISTING_MOBILE_HEADER_HEIGHT_MAX_PX, Math.max(0, Math.round(heightPx)));
}

/** Overlay offset: card + header padding. Never the abspos wrapper box. */
export function listingHeaderOverlayHeightPx(input: {
  cardHeightPx: number;
  paddingTopPx: number;
  paddingBottomPx?: number;
  fallbackPx: number;
}): number {
  const fromCard =
    input.cardHeightPx + input.paddingTopPx + (input.paddingBottomPx ?? 0);
  return clampListingHeaderHeightPx(fromCard > 0 ? fromCard : input.fallbackPx);
}

/**
 * Spacer stays at the expanded reservation while the logo is hidden.
 * Shrinking it with the header leaves a hole or stretches the first screen.
 */
export function nextListingHeaderSpacerPx(input: {
  measuredPx: number;
  currentSpacerPx: number;
  logoVisible: boolean;
}): number {
  const measured = clampListingHeaderHeightPx(input.measuredPx);
  const current = clampListingHeaderHeightPx(input.currentSpacerPx);
  if (input.logoVisible) return measured;
  return current > 0 ? current : measured;
}

export function readHeaderSpacerCssPx(
  style: { getPropertyValue(name: string): string } | null | undefined =
    typeof document === "undefined" ? null : document.documentElement.style,
): number {
  if (!style) return 0;
  const n = parseFloat(style.getPropertyValue(PS_HEADER_SPACER_VAR));
  return Number.isFinite(n) ? n : 0;
}

export function syncHeaderHeightCssVar(heightPx: number): void {
  document.documentElement.style.setProperty(
    PS_HEADER_HEIGHT_VAR,
    `${clampListingHeaderHeightPx(heightPx)}px`
  );
}

export function syncHeaderSpacerCssVar(heightPx: number): void {
  document.documentElement.style.setProperty(
    PS_HEADER_SPACER_VAR,
    `${clampListingHeaderHeightPx(heightPx)}px`
  );
}

export function syncUnpaidBannerHeightCssVar(heightPx: number): void {
  document.documentElement.style.setProperty(
    PS_UNPAID_BANNER_HEIGHT_VAR,
    `${Math.max(0, Math.round(heightPx))}px`
  );
}
