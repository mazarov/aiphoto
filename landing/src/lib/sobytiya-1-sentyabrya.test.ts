import assert from "node:assert/strict";
import test from "node:test";
import {
  SOBYTIYA_1_SENTYABRYA_PATH,
  SOBYTIYA_1_SENTYABRYA_SEARCH_QUERY,
  isSobytiya1SentyabryaPath,
} from "./sobytiya-1-sentyabrya";

test("isSobytiya1SentyabryaPath matches the dedicated event page", () => {
  assert.equal(isSobytiya1SentyabryaPath(SOBYTIYA_1_SENTYABRYA_PATH), true);
  assert.equal(isSobytiya1SentyabryaPath("/sobytiya/1-sentyabrya/"), true);
  assert.equal(isSobytiya1SentyabryaPath("/sobytiya/den-rozhdeniya"), false);
  assert.equal(isSobytiya1SentyabryaPath("/generaciya-foto/1-sentyabrya"), false);
});

test("1 сентября page search query is a short text search, not a tag slug", () => {
  assert.equal(SOBYTIYA_1_SENTYABRYA_SEARCH_QUERY, "1 сентября");
});
