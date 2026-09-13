import assert from "node:assert/strict";
import test from "node:test";
import {
  LISTING_MOBILE_HEADER_HEIGHT_MAX_PX,
  LISTING_MOBILE_LOGO_SHOW_TOP_PX,
  PS_HEADER_HEIGHT_FALLBACK_PX,
  PS_HEADER_LOGO_ROW_FALLBACK_PX,
  PS_HEADER_SEARCH_ROW_FALLBACK_PX,
  clampListingHeaderHeightPx,
  listingChromeLogoRowHidden,
  listingHeaderOverlayHeightPx,
  listingMobileHeaderHeightPx,
  listingMobileLogoVisible,
  listingMobileSearchHref,
  nextListingHeaderSpacerPx,
} from "./listing-header-offset";

test("header search href requires two characters", () => {
  assert.equal(listingMobileSearchHref(" "), null);
  assert.equal(listingMobileSearchHref("а"), null);
  assert.equal(
    listingMobileSearchHref("  мама с дочкой  "),
    "/search?q=%D0%BC%D0%B0%D0%BC%D0%B0%20%D1%81%20%D0%B4%D0%BE%D1%87%D0%BA%D0%BE%D0%B9",
  );
});

test("logo shows only at the very top of the listing", () => {
  assert.equal(listingMobileLogoVisible(0), true);
  assert.equal(listingMobileLogoVisible(LISTING_MOBILE_LOGO_SHOW_TOP_PX - 1), true);
  assert.equal(listingMobileLogoVisible(LISTING_MOBILE_LOGO_SHOW_TOP_PX), false);
  assert.equal(listingMobileLogoVisible(240), false);
});

test("collapsed logo stays hidden regardless of chrome holds", () => {
  assert.equal(
    listingChromeLogoRowHidden({ isMobile: true, scrollTop: 240 }),
    true,
  );
  assert.equal(
    listingChromeLogoRowHidden({ isMobile: true, scrollTop: 0 }),
    false,
  );
  assert.equal(
    listingChromeLogoRowHidden({ isMobile: false, scrollTop: 240 }),
    false,
  );
});

test("expanded mobile header is search row plus logo row", () => {
  assert.equal(
    listingMobileHeaderHeightPx({ searchRowPx: 56, logoVisible: true }),
    96,
  );
  assert.equal(
    PS_HEADER_HEIGHT_FALLBACK_PX,
    PS_HEADER_SEARCH_ROW_FALLBACK_PX + PS_HEADER_LOGO_ROW_FALLBACK_PX,
  );
});

test("collapsed mobile header keeps only the search row", () => {
  assert.equal(
    listingMobileHeaderHeightPx({ searchRowPx: 56, logoVisible: false }),
    56,
  );
  assert.equal(
    listingMobileHeaderHeightPx({
      searchRowPx: 64,
      logoVisible: false,
      logoRowPx: 40,
    }),
    64,
  );
});

test("overlay height prefers the card box and caps a 100vh abspos reading", () => {
  assert.equal(
    listingHeaderOverlayHeightPx({
      cardHeightPx: 96,
      paddingTopPx: 8,
      fallbackPx: 844,
    }),
    104,
  );
  assert.equal(clampListingHeaderHeightPx(844), LISTING_MOBILE_HEADER_HEIGHT_MAX_PX);
  assert.equal(clampListingHeaderHeightPx(Number.NaN), 0);
});

test("spacer keeps the expanded reservation while the logo is collapsed", () => {
  assert.equal(
    nextListingHeaderSpacerPx({
      measuredPx: 72,
      currentSpacerPx: 104,
      logoVisible: false,
    }),
    104,
  );
  assert.equal(
    nextListingHeaderSpacerPx({
      measuredPx: 104,
      currentSpacerPx: 104,
      logoVisible: true,
    }),
    104,
  );
  assert.equal(
    nextListingHeaderSpacerPx({
      measuredPx: 844,
      currentSpacerPx: 104,
      logoVisible: false,
    }),
    104,
  );
});

test("header height rounds and clamps negative rows", () => {
  assert.equal(
    listingMobileHeaderHeightPx({ searchRowPx: 55.6, logoVisible: true, logoRowPx: 39.4 }),
    95,
  );
  assert.equal(
    listingMobileHeaderHeightPx({ searchRowPx: -8, logoVisible: true, logoRowPx: -4 }),
    0,
  );
});
