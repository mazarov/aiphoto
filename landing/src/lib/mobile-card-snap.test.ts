import assert from "node:assert/strict";
import test from "node:test";
import {
  buildInitialSessionSlugs,
  canCommitMobileCardSnap,
  freezeMobileCardSnapOnUnmount,
  isMobileCardSnapCentered,
  isMobileCardSnapViewportUsable,
  isVirtualCardScrollNearSnapPoint,
  mergeSessionListingSlugs,
  mobileCardScrollBehavior,
  rebaseMobileCardScrollTop,
  replaceSessionSlugInPlace,
  resolveActiveMobileCardPhotos,
  resolveCardSlideImageUrls,
  resolveMobileCardSnapDirection,
  resolveMobileCardSnapSlideIndex,
  resolveMobileCardSnapTargetSlug,
  resolveVirtualCardSnapWindow,
  resolveVirtualCardVisualIndex,
  shouldIgnoreLayoutInducedMobileCardSnapScroll,
  shouldIgnoreLayoutScrollAfterGestureLock,
  shouldLockMobileCardSnapInteractiveMatch,
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

test("interactive chrome locks snap; photo edges with data-swipe-ok do not", () => {
  assert.equal(shouldLockMobileCardSnapInteractiveMatch(null), false);
  assert.equal(
    shouldLockMobileCardSnapInteractiveMatch({
      hasAttribute: () => false,
    }),
    true
  );
  assert.equal(
    shouldLockMobileCardSnapInteractiveMatch({
      hasAttribute: (name) => name === "data-swipe-ok",
    }),
    false
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

test("unmount freeze kills momentum scroll and clamps to the nearest slide", () => {
  const style = {
    overflowY: "auto",
    scrollSnapType: "y mandatory",
    scrollBehavior: "smooth",
  };
  const targetTop = freezeMobileCardSnapOnUnmount({
    scrollTop: 1580,
    slideHeight: 800,
    style,
  });
  assert.equal(targetTop, 1600);
  assert.equal(style.overflowY, "hidden");
  assert.equal(style.scrollSnapType, "none");
  assert.equal(style.scrollBehavior, "auto");
});

test("swipe commit uses incoming card photos immediately instead of stale local state", () => {
  assert.deepEqual(
    resolveActiveMobileCardPhotos({
      dataId: "card-b",
      syncedDataId: "card-a",
      localPhotos: ["https://cdn.example/old-a.jpg"],
      dataPhotoUrls: ["https://cdn.example/new-b.jpg"],
    }),
    ["https://cdn.example/new-b.jpg"]
  );
  assert.deepEqual(
    resolveActiveMobileCardPhotos({
      dataId: "card-b",
      syncedDataId: "card-b",
      localPhotos: ["https://cdn.example/edited-b.jpg"],
      dataPhotoUrls: ["https://cdn.example/new-b.jpg"],
    }),
    ["https://cdn.example/edited-b.jpg"]
  );
});

test("clean tap on ↑/↓ button does not arm the 400ms scroll-ignore window", () => {
  assert.equal(
    shouldIgnoreLayoutScrollAfterGestureLock({
      currentScrollTop: 800,
      lockedScrollTop: 800,
    }),
    false
  );
  assert.equal(
    shouldIgnoreLayoutScrollAfterGestureLock({
      currentScrollTop: 814,
      lockedScrollTop: 800,
    }),
    true
  );
});

test("V2 session track builds initial slug index and deduplicates listing entries", () => {
  assert.deepEqual(
    buildInitialSessionSlugs({
      currentSlug: "card-2",
      listingSlugs: ["card-1", "card-2", "card-2", "card-3"],
    }),
    {
      slugs: ["card-1", "card-2", "card-3"],
      initialIndex: 1,
    }
  );
  assert.deepEqual(
    buildInitialSessionSlugs({
      currentSlug: "direct-only",
      listingSlugs: ["card-1", "card-2"],
    }),
    {
      slugs: ["direct-only"],
      initialIndex: 0,
    }
  );
});

test("V2 infinite scroll merge is strictly append-only even when localStorage caps head items", () => {
  const existing = ["s1", "s2", "s3", "s4", "s5"];
  // Simulate capListingSlugList dropping s1..s2 while appending s6..s7.
  const incomingAfterCap = ["s3", "s4", "s5", "s6", "s7"];
  const merged = mergeSessionListingSlugs({
    sessionSlugs: existing,
    incomingSlugs: incomingAfterCap,
  });
  assert.deepEqual(merged, ["s1", "s2", "s3", "s4", "s5", "s6", "s7"]);
  // Unrelated listing context must not pollute an open direct-card session.
  assert.deepEqual(
    mergeSessionListingSlugs({
      sessionSlugs: ["direct-card"],
      incomingSlugs: ["other-1", "other-2"],
    }),
    ["direct-card"]
  );
});

test("V2 split-group variant replaces active slot in place without shifting neighbor indices", () => {
  const replaced = replaceSessionSlugInPlace({
    sessionSlugs: ["prev-card", "split-v1", "next-card"],
    activeIndex: 1,
    nextSlug: "split-v2",
  });
  assert.equal(replaced.mode, "replace-in-place");
  assert.equal(replaced.index, 1);
  assert.deepEqual(replaced.slugs, ["prev-card", "split-v2", "next-card"]);

  const jumped = replaceSessionSlugInPlace({
    sessionSlugs: ["prev-card", "split-v2", "next-card"],
    activeIndex: 1,
    nextSlug: "next-card",
  });
  assert.equal(jumped.mode, "jump");
  assert.equal(jumped.index, 2);
});

test("V2 virtual window bounds mount at most 6 slides [center-2 .. center+3]", () => {
  const middle = resolveVirtualCardSnapWindow({
    totalSlides: 20,
    centerIndex: 10,
  });
  assert.deepEqual(middle, {
    startIndex: 8,
    endIndex: 13,
    centerIndex: 10,
    totalSlides: 20,
  });
  assert.equal(middle.endIndex - middle.startIndex + 1, 6);

  const head = resolveVirtualCardSnapWindow({
    totalSlides: 20,
    centerIndex: 0,
  });
  assert.deepEqual(head, {
    startIndex: 0,
    endIndex: 3,
    centerIndex: 0,
    totalSlides: 20,
  });
});

test("V2 visual index switches at the 50% scroll midpoint and clamps to track bounds", () => {
  assert.equal(
    resolveVirtualCardVisualIndex({
      scrollTop: 800 + 399,
      slideHeight: 800,
      totalSlides: 5,
      fallbackIndex: 1,
    }),
    1
  );
  assert.equal(
    resolveVirtualCardVisualIndex({
      scrollTop: 800 + 401,
      slideHeight: 800,
      totalSlides: 5,
      fallbackIndex: 1,
    }),
    2
  );
  assert.equal(
    isVirtualCardScrollNearSnapPoint({
      scrollTop: 1601.8,
      slideHeight: 800,
    }),
    true
  );
});

test("V2 image URL resolver preserves listing base URL and derives 1920w hero upgrade URL", () => {
  const listingUrl =
    "https://supa.example.co/storage/v1/render/image/public/cards/p1.jpg?width=1024&quality=60";
  assert.deepEqual(resolveCardSlideImageUrls(listingUrl), {
    baseUrl: listingUrl,
    heroUrl:
      "https://supa.example.co/storage/v1/render/image/public/cards/p1.jpg?width=1920&quality=100",
  });
  assert.deepEqual(resolveCardSlideImageUrls("https://cdn.example/raw.webp"), {
    baseUrl: "https://cdn.example/raw.webp",
    heroUrl: "https://cdn.example/raw.webp",
  });
});
