import assert from "node:assert/strict";
import test from "node:test";
import {
  beginClientCardOverlay,
  canNavigateFromSecondaryCardViewer,
  endClientCardOverlay,
  isCardPathname,
  isClientCardOverlayActive,
  isClientCardOverlayBlocking,
  peekClientCardOverlaySlug,
  resetClientCardOverlayForTests,
  settleClientCardOverlayClose,
  shouldRenderInterceptedCardModal,
  shouldRenderSecondaryCardViewer,
} from "./client-card-overlay";

test.afterEach(() => {
  resetClientCardOverlayForTests();
});

test("client overlay is set before App Router can rematch /p/slug", () => {
  assert.equal(isClientCardOverlayActive(), false);
  assert.equal(isClientCardOverlayBlocking(), false);
  assert.equal(shouldRenderInterceptedCardModal(), true);
  assert.equal(
    beginClientCardOverlay("visual-hook-yarkiy-igrivyy"),
    "visual-hook-yarkiy-igrivyy"
  );
  assert.equal(peekClientCardOverlaySlug(), "visual-hook-yarkiy-igrivyy");
  assert.equal(shouldRenderInterceptedCardModal(), false);
  assert.equal(
    shouldRenderSecondaryCardViewer({
      hasListingNeighborHandler: false,
      clientOverlayActive: true,
    }),
    false
  );
  assert.equal(
    shouldRenderSecondaryCardViewer({
      hasListingNeighborHandler: true,
      clientOverlayActive: true,
    }),
    true
  );
  assert.equal(canNavigateFromSecondaryCardViewer(true), false);
  endClientCardOverlay(1000);
  assert.equal(isClientCardOverlayActive(), false);
  assert.equal(isClientCardOverlayBlocking(1200), true);
  assert.equal(shouldRenderInterceptedCardModal(isClientCardOverlayBlocking(1200)), false);
  settleClientCardOverlayClose();
  assert.equal(isClientCardOverlayBlocking(1200), false);
  assert.equal(shouldRenderInterceptedCardModal(), true);
});

test("intercepted modal never renders once pathname is back on a listing route", () => {
  assert.equal(isCardPathname("/p/foo"), true);
  assert.equal(isCardPathname("/search"), false);
  assert.equal(shouldRenderInterceptedCardModal(false, "/p/foo"), true);
  assert.equal(shouldRenderInterceptedCardModal(false, "/search"), false);
  assert.equal(shouldRenderInterceptedCardModal(false, "/promty-dlya-foto-devushki"), false);
});

test("unsafe overlay slug is ignored", () => {
  assert.equal(beginClientCardOverlay("../p/x"), null);
  assert.equal(isClientCardOverlayActive(), false);
});
