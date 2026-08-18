import assert from "node:assert/strict";
import test from "node:test";
import { searchRequestKey } from "./search-request";
import {
  clearSearchListingSnapshot,
  readSearchListingSnapshot,
  resetSearchListingSnapshotForTests,
  resolveSearchUrlSync,
  writeSearchListingSnapshot,
  type SearchListingSnapshot,
} from "./search-listing-session";

const EMPTY_FILTERS = {
  audience: null,
  style: null,
  occasion: null,
  object: null,
};

function key(query: string): string {
  return searchRequestKey(query, EMPTY_FILTERS);
}

function snapshot(query: string): SearchListingSnapshot {
  return {
    requestKey: key(query),
    query,
    cardPages: [[{ id: "c1" } as SearchListingSnapshot["cardPages"][number][number]]],
    offset: 48,
    hasMore: true,
    matchType: "fts",
    searched: true,
  };
}

test("overlay card/pricing paths do not restart search", () => {
  assert.equal(
    resolveSearchUrlSync({
      pathname: "/p/some-card",
      urlRequestKey: key(""),
      lastSearched: key("аниме"),
    }),
    "ignore"
  );
  assert.equal(
    resolveSearchUrlSync({
      pathname: "/p/some-card/",
      urlRequestKey: key(""),
      lastSearched: key("аниме"),
    }),
    "ignore"
  );
  assert.equal(
    resolveSearchUrlSync({
      pathname: "/pricing",
      urlRequestKey: key(""),
      lastSearched: key("аниме"),
    }),
    "ignore"
  );
});

test("same /search query keeps the loaded listing", () => {
  assert.equal(
    resolveSearchUrlSync({
      pathname: "/search",
      urlRequestKey: key("аниме"),
      lastSearched: key("аниме"),
    }),
    "keep"
  );
  assert.equal(
    resolveSearchUrlSync({
      pathname: "/search/",
      urlRequestKey: key(""),
      lastSearched: null,
    }),
    "keep"
  );
});

test("a new /search query starts a fresh search", () => {
  assert.equal(
    resolveSearchUrlSync({
      pathname: "/search",
      urlRequestKey: key("портрет"),
      lastSearched: key("аниме"),
    }),
    "search"
  );
  assert.equal(
    resolveSearchUrlSync({
      pathname: "/search",
      urlRequestKey: key(""),
      lastSearched: key("аниме"),
    }),
    "search"
  );
});

test("non-search routes do not drive the search controller", () => {
  assert.equal(
    resolveSearchUrlSync({
      pathname: "/stil/anime",
      urlRequestKey: key(""),
      lastSearched: key("аниме"),
    }),
    "ignore"
  );
});

test("snapshot restores only the matching request key", () => {
  resetSearchListingSnapshotForTests();
  writeSearchListingSnapshot(snapshot("аниме"));
  assert.equal(readSearchListingSnapshot(key("аниме"))?.offset, 48);
  assert.equal(readSearchListingSnapshot(key("портрет")), null);
  clearSearchListingSnapshot();
  assert.equal(readSearchListingSnapshot(key("аниме")), null);
});
