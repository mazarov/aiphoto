import assert from "node:assert/strict";
import test from "node:test";
import { LISTING_DEFAULT_SORT, parseListingSort } from "./listing-sort";

test("a listing without ?sort= is popular", () => {
  assert.equal(LISTING_DEFAULT_SORT, "popular");
  assert.equal(parseListingSort(null), "popular");
  assert.equal(parseListingSort(""), "popular");
  assert.equal(parseListingSort("popular"), "popular");
});

test("only an explicit new stays chronological", () => {
  assert.equal(parseListingSort("new"), "new");
  assert.equal(parseListingSort("latest"), "popular");
});
