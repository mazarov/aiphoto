import assert from "node:assert/strict";
import test from "node:test";
import {
  canMutateAuthReturnCardSlug,
  peekAuthReturnCardPin,
  pinAuthReturnCard,
  releaseAuthReturnCardPin,
  resetAuthReturnCardPinForTests,
  resolveAuthReturnCardOpenSlug,
  shouldRenderMobileCardSnapNeighbors,
} from "./auth-return-card-pin";

test.afterEach(() => {
  resetAuthReturnCardPinForTests();
});

test("OAuth pin freezes the return slug until release", () => {
  assert.equal(pinAuthReturnCard("visual-hook-yarkiy-igrivyy"), "visual-hook-yarkiy-igrivyy");
  assert.equal(peekAuthReturnCardPin(), "visual-hook-yarkiy-igrivyy");
  assert.equal(canMutateAuthReturnCardSlug("visual-hook-elegantnyy-siluet"), false);
  assert.equal(canMutateAuthReturnCardSlug("visual-hook-yarkiy-igrivyy"), true);
  assert.equal(
    resolveAuthReturnCardOpenSlug("visual-hook-elegantnyy-siluet"),
    "visual-hook-yarkiy-igrivyy"
  );
  assert.equal(shouldRenderMobileCardSnapNeighbors(true), false);
  releaseAuthReturnCardPin();
  assert.equal(canMutateAuthReturnCardSlug("visual-hook-elegantnyy-siluet"), true);
  assert.equal(shouldRenderMobileCardSnapNeighbors(false), true);
});

test("pin rejects unsafe slugs", () => {
  assert.equal(pinAuthReturnCard("../p/x"), null);
  assert.equal(canMutateAuthReturnCardSlug("anything"), true);
});
