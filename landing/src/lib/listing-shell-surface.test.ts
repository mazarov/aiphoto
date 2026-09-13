import assert from "node:assert/strict";
import test from "node:test";
import {
  LISTING_MOBILE_GUTTER_PX,
  listingMobileColumnWidthPx,
} from "./listing-shell-surface";

test("header card and listing column share the px-2 gutter", () => {
  assert.equal(LISTING_MOBILE_GUTTER_PX, 8);
  assert.equal(listingMobileColumnWidthPx(390), 374);
  assert.equal(listingMobileColumnWidthPx(390.4), 374);
  assert.equal(listingMobileColumnWidthPx(0), 0);
  assert.equal(listingMobileColumnWidthPx(-20), 0);
});
