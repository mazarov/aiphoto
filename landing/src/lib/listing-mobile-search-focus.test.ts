import assert from "node:assert/strict";
import test from "node:test";
import {
  LISTING_SEARCH_HEADER_PROXY_ATTR,
  listingHeaderSearchInput,
  listingSearchHeaderProxyMatch,
  scheduleFocusListingHeaderSearch,
  shouldProxyPageSearchToHeaderSearch,
} from "./listing-mobile-search-focus";

test("page search proxies to header only on mobile when the header field exists", () => {
  const header = { id: "listing-mobile-header-search" } as HTMLInputElement;
  assert.equal(
    shouldProxyPageSearchToHeaderSearch({
      mobileViewport: true,
      headerInput: header,
    }),
    true,
  );
  assert.equal(
    shouldProxyPageSearchToHeaderSearch({
      mobileViewport: false,
      headerInput: header,
    }),
    false,
  );
  assert.equal(
    shouldProxyPageSearchToHeaderSearch({
      mobileViewport: true,
      headerInput: null,
    }),
    false,
  );
});

test("header search lookup uses the SSOT id", () => {
  assert.equal(
    listingHeaderSearchInput({
      querySelector: (sel: string) =>
        sel === "#listing-mobile-header-search" ? ({ id: "listing-mobile-header-search" } as HTMLInputElement) : null,
    } as unknown as ParentNode)?.id,
    "listing-mobile-header-search",
  );
});

test("scheduleFocusListingHeaderSearch re-applies after the page field steals click focus", () => {
  const focuses: number[] = [];
  const input = {
    id: "listing-mobile-header-search",
    value: "q",
    focus() {
      focuses.push(1);
    },
    setSelectionRange() {},
  };
  const root = {
    querySelector: (sel: string) =>
      sel === "#listing-mobile-header-search" ? input : null,
  };
  const queued: Array<() => void> = [];
  const originalRaf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    queued.push(() => cb(0));
    return 1;
  }) as typeof requestAnimationFrame;
  try {
    scheduleFocusListingHeaderSearch(root as unknown as ParentNode);
    assert.equal(focuses.length, 1);
    queued[0]!();
    assert.equal(focuses.length, 2);
  } finally {
    globalThis.requestAnimationFrame = originalRaf;
  }
});

test("listing keyboard freeze skips the in-page search proxy", () => {
  assert.equal(listingSearchHeaderProxyMatch(null), false);
  assert.equal(
    listingSearchHeaderProxyMatch({
      closest: (sel) =>
        sel === `[${LISTING_SEARCH_HEADER_PROXY_ATTR}]` ? {} : null,
    }),
    true,
  );
  assert.equal(
    listingSearchHeaderProxyMatch({
      closest: () => null,
    }),
    false,
  );
});
