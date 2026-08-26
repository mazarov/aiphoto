import assert from "node:assert/strict";
import test from "node:test";
import {
  LISTING_SHELL_LINK_SCROLL,
  normalizeNavPath,
  pinInstantDocumentScroll,
  resolveListingScrollFillAction,
  resolveListingScrollRestoreOnClose,
  resolveListingScrollYForAuthReturn,
  sanitizeListingScrollY,
  shouldApplyListingScrollY,
  shouldReapplyPinnedListingScroll,
  shouldDeferListingScrollLockStyles,
  shouldKeepSavedListingScrollOnModalLock,
  shouldResetListingScrollOnRouteEnter,
  shouldScrollTopOnNav,
} from "./scroll-preservation";

test("listing scroll lock styles wait until the shell hydrates", () => {
  assert.equal(shouldDeferListingScrollLockStyles(false), true);
  assert.equal(shouldDeferListingScrollLockStyles(true), false);
});

test("listing shell links disable Next default scroll", () => {
  assert.equal(LISTING_SHELL_LINK_SCROLL, false);
});

test("pinInstantDocumentScroll forces inline auto and restores empty inline", () => {
  const props = new Map<string, string>();
  const style = {
    get scrollBehavior() {
      return props.get("scroll-behavior") ?? "";
    },
    set scrollBehavior(value: string) {
      props.set("scroll-behavior", value);
    },
    setProperty(name: string, value: string) {
      props.set(name, value);
    },
    removeProperty(name: string) {
      props.delete(name);
    },
  };

  const restore = pinInstantDocumentScroll(style);
  assert.equal(props.get("scroll-behavior"), "auto");
  restore();
  assert.equal(props.has("scroll-behavior"), false);
});

test("pinInstantDocumentScroll restores a previous inline value", () => {
  const props = new Map<string, string>([["scroll-behavior", "smooth"]]);
  const style = {
    get scrollBehavior() {
      return props.get("scroll-behavior") ?? "";
    },
    set scrollBehavior(value: string) {
      props.set("scroll-behavior", value);
    },
    setProperty(name: string, value: string) {
      props.set(name, value);
    },
    removeProperty(name: string) {
      props.delete(name);
    },
  };

  const restore = pinInstantDocumentScroll(style);
  assert.equal(props.get("scroll-behavior"), "auto");
  restore();
  assert.equal(props.get("scroll-behavior"), "smooth");
});

test("normalizeNavPath strips a trailing slash except on root", () => {
  assert.equal(normalizeNavPath("/"), "/");
  assert.equal(normalizeNavPath("/generaciya-foto/malysh/"), "/generaciya-foto/malysh");
  assert.equal(normalizeNavPath("/generaciya-foto/malysh"), "/generaciya-foto/malysh");
});

test("shouldScrollTopOnNav only forces home and foto-v-promt on first enter", () => {
  assert.equal(shouldScrollTopOnNav("/"), true);
  assert.equal(shouldScrollTopOnNav("/foto-v-promt/"), true);
  assert.equal(shouldScrollTopOnNav("/generaciya-foto/malysh"), false);
});

test("auth return prefers the saved listing Y while a card is open", () => {
  assert.equal(sanitizeListingScrollY("1840"), 1840);
  assert.equal(sanitizeListingScrollY("-1"), null);
  assert.equal(
    resolveListingScrollYForAuthReturn({
      overlayOpen: true,
      savedY: 1840,
      currentY: 0,
    }),
    1840
  );
  assert.equal(
    resolveListingScrollYForAuthReturn({
      overlayOpen: false,
      savedY: 1840,
      currentY: 240,
    }),
    240
  );
  assert.equal(
    shouldKeepSavedListingScrollOnModalLock({
      isAuthReturn: true,
      savedY: 1840,
    }),
    true
  );
  assert.equal(
    shouldKeepSavedListingScrollOnModalLock({
      isAuthReturn: false,
      savedY: 1840,
    }),
    false
  );
});

test("does not apply a listing Y the document cannot hold", () => {
  assert.equal(
    shouldApplyListingScrollY({ targetY: 4342, maxScrollY: 800 }),
    false
  );
  assert.equal(
    shouldApplyListingScrollY({ targetY: 4342, maxScrollY: 4342 }),
    true
  );
  assert.equal(
    resolveListingScrollFillAction({
      targetY: 4342,
      maxScrollY: 800,
      hasMore: true,
    }),
    "load"
  );
  assert.equal(
    resolveListingScrollFillAction({
      targetY: 4342,
      maxScrollY: 4342,
      hasMore: true,
    }),
    "apply"
  );
  assert.equal(
    resolveListingScrollFillAction({
      targetY: 4342,
      maxScrollY: 900,
      hasMore: false,
    }),
    "apply-max"
  );
});

test("card close does not clamp-restore while fill is still growing the listing", () => {
  assert.equal(
    resolveListingScrollRestoreOnClose({
      fillInProgress: true,
      savedY: 4342,
      currentY: 0,
      maxScrollY: 800,
    }),
    "unlock"
  );
  assert.equal(
    resolveListingScrollRestoreOnClose({
      fillInProgress: false,
      savedY: 4342,
      currentY: 4342,
      maxScrollY: 5000,
    }),
    "unlock"
  );
  assert.equal(
    resolveListingScrollRestoreOnClose({
      fillInProgress: false,
      savedY: 4342,
      currentY: 0,
      maxScrollY: 800,
    }),
    "fill"
  );
  assert.equal(
    resolveListingScrollRestoreOnClose({
      fillInProgress: false,
      savedY: 4342,
      currentY: 120,
      maxScrollY: 5000,
    }),
    "settle"
  );
});

test("auth return does not force listing scroll to top", () => {
  assert.equal(
    shouldResetListingScrollOnRouteEnter({
      normalizedPath: "/",
      previousPath: null,
      isAuthReturn: true,
    }),
    false
  );
  assert.equal(
    shouldResetListingScrollOnRouteEnter({
      normalizedPath: "/",
      previousPath: null,
      isAuthReturn: false,
    }),
    true
  );
  assert.equal(
    shouldResetListingScrollOnRouteEnter({
      normalizedPath: "/p/visual-hook-neon",
      previousPath: "/catalog",
      isAuthReturn: false,
    }),
    false
  );
  assert.equal(
    shouldResetListingScrollOnRouteEnter({
      normalizedPath: "/promty-dlya-foto-muzhchiny",
      previousPath: "/p/visual-hook-neon",
      isAuthReturn: false,
    }),
    false
  );
});

test("pin fights only a snap back to the listing top", () => {
  assert.equal(
    shouldReapplyPinnedListingScroll({ pinnedY: 4342, currentY: 0 }),
    true
  );
  assert.equal(
    shouldReapplyPinnedListingScroll({ pinnedY: 4342, currentY: 4342 }),
    false
  );
  assert.equal(
    shouldReapplyPinnedListingScroll({ pinnedY: 4342, currentY: 4100 }),
    false
  );
  assert.equal(
    shouldReapplyPinnedListingScroll({ pinnedY: 0, currentY: 0 }),
    false
  );
});
