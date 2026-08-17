import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSearchApiParams,
  searchRequestKey,
  type SearchUrlFilters,
} from "./search-request";

const emptyFilters: SearchUrlFilters = {
  audience: null,
  style: null,
  occasion: null,
  object: null,
};

test("search API params include active filters before pagination", () => {
  const params = buildSearchApiParams({
    query: "день рождения",
    limit: 48,
    offset: 96,
    filters: {
      ...emptyFilters,
      audience: "muzhchina",
      occasion: "den-rozhdeniya",
    },
  });

  assert.equal(params.get("q"), "день рождения");
  assert.equal(params.get("limit"), "48");
  assert.equal(params.get("offset"), "96");
  assert.equal(params.get("audience"), "muzhchina");
  assert.equal(params.get("occasion"), "den-rozhdeniya");
  assert.equal(params.has("style"), false);
  assert.equal(params.has("object"), false);
});

test("search request key changes when only a filter changes", () => {
  const base = searchRequestKey("день рождения", emptyFilters);
  const filtered = searchRequestKey("день рождения", {
    ...emptyFilters,
    audience: "muzhchina",
  });

  assert.notEqual(filtered, base);
});
