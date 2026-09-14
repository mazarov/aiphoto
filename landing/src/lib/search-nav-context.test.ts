import assert from "node:assert/strict";
import test from "node:test";
import {
  clearSearchNavContext,
  matchSearchNavClick,
  readSearchNavContext,
  resetSearchNavContextForTests,
  SEARCH_NAV_MAX_AGE_MS,
  writeSearchNavContext,
} from "./search-nav-context";

const SEARCH_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

test("search nav matches slug position and ignores strangers", () => {
  resetSearchNavContextForTests();
  writeSearchNavContext({
    searchId: SEARCH_ID,
    query: "кошка",
    slugs: ["first-card", "second-card"],
    resultCount: 2,
  });
  assert.deepEqual(matchSearchNavClick("second-card"), {
    searchId: SEARCH_ID,
    position: 1,
  });
  assert.equal(matchSearchNavClick("other-card"), null);
});

test("expired search nav is dropped", () => {
  resetSearchNavContextForTests();
  writeSearchNavContext({
    searchId: SEARCH_ID,
    query: "кошка",
    slugs: ["first-card"],
    resultCount: 1,
    now: 1_000,
  });
  assert.equal(readSearchNavContext(1_000 + SEARCH_NAV_MAX_AGE_MS + 1), null);
  assert.equal(matchSearchNavClick("first-card"), null);
});

test("clearSearchNavContext removes the match", () => {
  resetSearchNavContextForTests();
  writeSearchNavContext({
    searchId: SEARCH_ID,
    query: "кошка",
    slugs: ["first-card"],
    resultCount: 1,
  });
  clearSearchNavContext();
  assert.equal(readSearchNavContext(), null);
});
