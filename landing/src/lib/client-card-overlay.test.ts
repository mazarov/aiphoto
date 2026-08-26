import assert from "node:assert/strict";
import test from "node:test";
import {
  beginClientCardOverlay,
  canNavigateFromSecondaryCardViewer,
  endClientCardOverlay,
  isClientCardOverlayActive,
  peekClientCardOverlaySlug,
  resetClientCardOverlayForTests,
  shouldRenderInterceptedCardModal,
  shouldRenderSecondaryCardViewer,
} from "./client-card-overlay";

test.afterEach(() => {
  resetClientCardOverlayForTests();
});

test("client overlay is set before App Router can rematch /p/slug", () => {
  assert.equal(isClientCardOverlayActive(), false);
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
  endClientCardOverlay();
  assert.equal(isClientCardOverlayActive(), false);
  assert.equal(shouldRenderInterceptedCardModal(), true);
});

test("unsafe overlay slug is ignored", () => {
  assert.equal(beginClientCardOverlay("../p/x"), null);
  assert.equal(isClientCardOverlayActive(), false);
});
