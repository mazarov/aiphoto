import assert from "node:assert/strict";
import test from "node:test";
import {
  canShowPayChrome,
  isPromptshotAuthed,
  listingHeaderTrailingKind,
} from "./promptshot-auth";

test("guest and anonymous sessions are not PromptShot-authed", () => {
  assert.equal(isPromptshotAuthed(null), false);
  assert.equal(isPromptshotAuthed(undefined), false);
  assert.equal(isPromptshotAuthed({ is_anonymous: true }), false);
});

test("signed-in user is PromptShot-authed", () => {
  assert.equal(isPromptshotAuthed({}), true);
  assert.equal(isPromptshotAuthed({ is_anonymous: false }), true);
});

test("pay chrome is only for signed-in users", () => {
  assert.equal(canShowPayChrome(null), false);
  assert.equal(canShowPayChrome({ is_anonymous: true }), false);
  assert.equal(canShowPayChrome({ is_anonymous: false }), true);
});

test("header trailing slot is tariffs for guests and balance when signed in", () => {
  assert.equal(listingHeaderTrailingKind(null), "tariffs");
  assert.equal(listingHeaderTrailingKind({ is_anonymous: true }), "tariffs");
  assert.equal(listingHeaderTrailingKind({ is_anonymous: false }), "balance");
});
