import assert from "node:assert/strict";
import test from "node:test";
import {
  canCommitMobileCardSnap,
  isMobileCardSnapCentered,
  isMobileCardSnapViewportUsable,
  mobileCardScrollBehavior,
  rebaseMobileCardScrollTop,
  resolveMobileCardSnapDirection,
  resolveMobileCardSnapSlideIndex,
  resolveMobileCardSnapTargetSlug,
  shouldIgnoreLayoutInducedMobileCardSnapScroll,
  shouldRecenterMobileCardSnapOnResize,
  shouldTreatMobileCardResizeAsInteraction,
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

test("hidden or zero-height snap viewport is not usable", () => {
  assert.equal(
    isMobileCardSnapViewportUsable({ clientHeight: 800, displayNone: true }),
    false
  );
  assert.equal(
    isMobileCardSnapViewportUsable({ clientHeight: 0, displayNone: false }),
    false
  );
  assert.equal(
    isMobileCardSnapViewportUsable({ clientHeight: 800, displayNone: false }),
    true
  );
  assert.equal(
    isMobileCardSnapViewportUsable({
      clientHeight: 800,
      displayNone: false,
      stageDisplayNone: true,
    }),
    false
  );
});

test("desktop→mobile visibility change recenters on the current card", () => {
  assert.equal(
    shouldRecenterMobileCardSnapOnResize({
      previousUsable: false,
      nextUsable: true,
    }),
    true
  );
  assert.equal(
    shouldRecenterMobileCardSnapOnResize({
      previousUsable: true,
      nextUsable: true,
    }),
    false
  );
  assert.equal(
    shouldRecenterMobileCardSnapOnResize({
      previousUsable: false,
      nextUsable: false,
    }),
    false
  );
});

test("snap index stays 0 until neighbors are attached", () => {
  assert.equal(
    resolveMobileCardSnapSlideIndex({ neighborsAttached: false, prevCount: 8 }),
    0
  );
  assert.equal(
    resolveMobileCardSnapSlideIndex({ neighborsAttached: true, prevCount: 8 }),
    8
  );
  assert.equal(
    isMobileCardSnapCentered({
      scrollTop: 0,
      slideHeight: 800,
      currentSlideIndex: resolveMobileCardSnapSlideIndex({
        neighborsAttached: false,
        prevCount: 8,
      }),
    }),
    true
  );
});

test("width-only desktop→mobile recenters even if inner scroller looked usable", () => {
  assert.equal(
    shouldRecenterMobileCardSnapOnResize({
      previousUsable: true,
      nextUsable: true,
      crossedToMobileViewport: true,
    }),
    true
  );
  assert.equal(
    isMobileCardSnapCentered({
      scrollTop: 0,
      slideHeight: 800,
      currentSlideIndex: 8,
    }),
    false
  );
  assert.equal(
    isMobileCardSnapCentered({
      scrollTop: 6400,
      slideHeight: 800,
      currentSlideIndex: 8,
    }),
    true
  );
});

test("resize after hidden→visible is not a swipe even if phase looks busy", () => {
  assert.equal(
    shouldTreatMobileCardResizeAsInteraction({
      pointerActive: false,
      phaseIdle: false,
      previousUsable: false,
      nextUsable: true,
    }),
    false
  );
  assert.equal(
    rebaseMobileCardScrollTop({
      scrollTop: 0,
      previousHeight: 900,
      nextHeight: 800,
      currentSlideIndex: 8,
      interacting: shouldTreatMobileCardResizeAsInteraction({
        pointerActive: false,
        phaseIdle: false,
        previousUsable: false,
        nextUsable: true,
      }),
    }),
    6400
  );
});

test("resize during a real swipe still preserves progress", () => {
  assert.equal(
    shouldTreatMobileCardResizeAsInteraction({
      pointerActive: true,
      phaseIdle: false,
      previousUsable: true,
      nextUsable: true,
    }),
    true
  );
});

test("layout-induced scroll is ignored only inside the settle window", () => {
  assert.equal(
    shouldIgnoreLayoutInducedMobileCardSnapScroll({
      nowMs: 100,
      ignoreUntilMs: 280,
    }),
    true
  );
  assert.equal(
    shouldIgnoreLayoutInducedMobileCardSnapScroll({
      nowMs: 280,
      ignoreUntilMs: 280,
    }),
    false
  );
});

test("multi-slide settle commits the actual stopped card directly", () => {
  assert.equal(
    resolveMobileCardSnapTargetSlug({
      settledSlideIndex: 8,
      currentSlideIndex: 0,
      prevSlugs: [],
      nextSlugs: ["n1", "n2", "n3", "n4", "n5", "n6", "n7", "n8"],
    }),
    "n8"
  );
  assert.equal(
    resolveMobileCardSnapTargetSlug({
      settledSlideIndex: 1,
      currentSlideIndex: 8,
      prevSlugs: ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"],
      nextSlugs: [],
    }),
    "p7"
  );
});
