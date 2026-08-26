import assert from "node:assert/strict";
import test from "node:test";
import {
  isPromptCardOverlayOpening,
  markPromptCardOverlayOpened,
  shouldSuppressMobileCardSnapCommit,
} from "./prompt-card-overlay-open";

test("overlay open window suppresses snap commits", () => {
  markPromptCardOverlayOpened(100);
  assert.equal(isPromptCardOverlayOpening(200), true);
  assert.equal(isPromptCardOverlayOpening(599), true);
  assert.equal(isPromptCardOverlayOpening(600), false);
});

test("auth return and overlay open both block neighbor commit", () => {
  assert.equal(
    shouldSuppressMobileCardSnapCommit({
      overlayOpening: true,
      authReturnPending: false,
    }),
    true
  );
  assert.equal(
    shouldSuppressMobileCardSnapCommit({
      overlayOpening: false,
      authReturnPending: true,
    }),
    true
  );
  assert.equal(
    shouldSuppressMobileCardSnapCommit({
      overlayOpening: false,
      authReturnPending: false,
    }),
    false
  );
});
