import assert from "node:assert/strict";
import test from "node:test";
import {
  canCommitMobileCardSnap,
  mobileCardScrollBehavior,
  rebaseMobileCardScrollTop,
  resolveMobileCardSnapDirection,
} from "./mobile-card-snap";

const BASE = {
  slideHeight: 800,
  currentSlideIndex: 1,
  hasPrev: true,
  hasNext: true,
};

test("short swipe resolves back to the current card", () => {
  assert.equal(
    resolveMobileCardSnapDirection({ ...BASE, scrollTop: 800 + 120 }),
    "current"
  );
  assert.equal(
    resolveMobileCardSnapDirection({ ...BASE, scrollTop: 800 - 120 }),
    "current"
  );
});

test("crossing the midpoint resolves the neighboring card", () => {
  assert.equal(
    resolveMobileCardSnapDirection({ ...BASE, scrollTop: 800 + 401 }),
    "next"
  );
  assert.equal(
    resolveMobileCardSnapDirection({ ...BASE, scrollTop: 800 - 401 }),
    "prev"
  );
});

test("missing edge slide rolls back to the current card", () => {
  assert.equal(
    resolveMobileCardSnapDirection({
      ...BASE,
      currentSlideIndex: 0,
      hasPrev: false,
      scrollTop: -100,
    }),
    "current"
  );
  assert.equal(
    resolveMobileCardSnapDirection({
      ...BASE,
      hasNext: false,
      scrollTop: 1600,
    }),
    "current"
  );
});

test("epsilon absorbs sub-pixel drift around the current snap point", () => {
  assert.equal(
    resolveMobileCardSnapDirection({
      ...BASE,
      scrollTop: 801.5,
      epsilonPx: 2,
    }),
    "current"
  );
});

test("resize preserves normalized gesture progress", () => {
  assert.equal(
    rebaseMobileCardScrollTop({
      scrollTop: 1200,
      previousHeight: 800,
      nextHeight: 700,
      currentSlideIndex: 1,
      interacting: true,
    }),
    1050
  );
});

test("resize recenters an idle feed", () => {
  assert.equal(
    rebaseMobileCardScrollTop({
      scrollTop: 1200,
      previousHeight: 800,
      nextHeight: 700,
      currentSlideIndex: 1,
      interacting: false,
    }),
    700
  );
});

test("reduced motion disables programmatic smooth scrolling", () => {
  assert.equal(mobileCardScrollBehavior(true), "auto");
  assert.equal(mobileCardScrollBehavior(false), "smooth");
});

test("commit guard rejects missing prefetch and duplicate settle", () => {
  assert.equal(
    canCommitMobileCardSnap({
      direction: "next",
      targetAvailable: false,
      alreadyCommitting: false,
    }),
    false
  );
  assert.equal(
    canCommitMobileCardSnap({
      direction: "next",
      targetAvailable: true,
      alreadyCommitting: true,
    }),
    false
  );
  assert.equal(
    canCommitMobileCardSnap({
      direction: "next",
      targetAvailable: true,
      alreadyCommitting: false,
    }),
    true
  );
});
