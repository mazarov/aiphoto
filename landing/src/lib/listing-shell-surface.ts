/**
 * Frosted surfaces of the catalog shell — keep in sync with HeaderClient + ListingSearchField.
 * @see HeaderClient — floating indigo card in `globals.css`
 * @see ListingSearchField toolbar — `rounded-2xl` like generate CTA
 */

/** CSS var + listing `px-2`: header card and explorer share one column width. */
export const PS_LISTING_GUTTER_VAR = "--ps-listing-gutter";

/** Mobile listing column inset (`px-2` on catalog / search / trends / slug). */
export const LISTING_MOBILE_GUTTER_PX = 8;

export function listingMobileColumnWidthPx(viewportPx: number): number {
  return Math.max(0, Math.round(viewportPx) - LISTING_MOBILE_GUTTER_PX * 2);
}

/** Desktop / collapsed chrome; mobile expanded header uses `.listing-mobile-header-surface`. */
export const LISTING_NAV_SHELL_SURFACE = "bg-white/80 backdrop-blur-xl";

/** Mobile header rows — keep in sync with HeaderClient grid (`px-3 sm:px-4`, `gap-2`). */
export const LISTING_MOBILE_CHROME_INSET = "px-3 sm:px-4";

/** Same 40×40 tap target as burger (`ListingChromeButton` icon-sm). */
export const LISTING_MOBILE_CHROME_LEADING_CELL =
  "flex h-10 w-10 shrink-0 items-center justify-center";

/** Bottom bar + search input fill. */
export const LISTING_SEARCH_FIELD_SURFACE =
  "bg-white/82 shadow-sm shadow-indigo-500/[0.08] backdrop-blur-xl";

/** Bottom dock plate — same frost as site header (HeaderClient). */
export const LISTING_BOTTOM_BAR_SURFACE = `shadow-[0_-8px_32px_-12px_rgba(99,102,241,0.1)] ${LISTING_NAV_SHELL_SURFACE}`;

