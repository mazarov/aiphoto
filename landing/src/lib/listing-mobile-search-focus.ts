/** Sticky header search — the only mobile (max-lg) listing search input. */

export const LISTING_MOBILE_HEADER_SEARCH_ID = "listing-mobile-header-search";

/** Matches `HeaderClient` `lg:hidden`. */
export const LISTING_MOBILE_HEADER_MQ = "(max-width: 1023px)";

/** In-page explorer field: tap/focus moves to the header input. */
export const LISTING_SEARCH_HEADER_PROXY_ATTR = "data-listing-search-header-proxy";

export function listingHeaderSearchInput(
  root: ParentNode | null | undefined = typeof document === "undefined" ? null : document,
): HTMLInputElement | null {
  if (!root) return null;
  return root.querySelector<HTMLInputElement>(`#${LISTING_MOBILE_HEADER_SEARCH_ID}`);
}

export function subscribeListingMobileHeaderMq(onStoreChange: () => void) {
  const mq = window.matchMedia(LISTING_MOBILE_HEADER_MQ);
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

export function listingMobileHeaderMqMatches() {
  return window.matchMedia(LISTING_MOBILE_HEADER_MQ).matches;
}

export function shouldProxyPageSearchToHeaderSearch({
  mobileViewport,
  headerInput,
}: {
  mobileViewport: boolean;
  headerInput: HTMLInputElement | null | undefined;
}): boolean {
  return Boolean(mobileViewport && headerInput);
}

export function listingSearchHeaderProxyMatch(
  match: { closest(selector: string): unknown } | null,
): boolean {
  if (!match) return false;
  return Boolean(match.closest(`[${LISTING_SEARCH_HEADER_PROXY_ATTR}]`));
}

export function isListingSearchHeaderProxyTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return listingSearchHeaderProxyMatch(target);
}

export function focusMobileSearchInput(input: HTMLInputElement | null | undefined) {
  if (!input) return;
  input.focus({ preventScroll: true });
  try {
    const len = input.value.length;
    input.setSelectionRange(len, len);
  } catch {
    // detached or unsupported input type
  }
}

/** Click on an in-page field focuses that input after pointerdown. Re-apply. */
export function scheduleFocusListingHeaderSearch(
  root: ParentNode | null | undefined = typeof document === "undefined" ? null : document,
) {
  const run = () => focusMobileSearchInput(listingHeaderSearchInput(root));
  run();
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(run);
  }
}
