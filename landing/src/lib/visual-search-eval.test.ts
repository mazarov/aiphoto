import assert from "node:assert/strict";
import test from "node:test";
import {
  VISUAL_SEARCH_EVAL_QUERIES,
  exactTitlePreserved,
  recallAtK,
  zeroResultRate,
} from "./visual-search-eval";

test("eval helpers score recall and exact-title regressions", () => {
  assert.ok(VISUAL_SEARCH_EVAL_QUERIES.length >= 20);
  assert.equal(recallAtK(["a", "b", "c"], ["b", "d"], 20), 0.5);
  assert.equal(zeroResultRate([[], ["a"], []]), 2 / 3);
  assert.equal(
    exactTitlePreserved({
      query: "x",
      baselineFirstId: "card-1",
      hybridFirstId: "card-1",
    }),
    true,
  );
  assert.equal(
    exactTitlePreserved({
      query: "x",
      baselineFirstId: "card-1",
      hybridFirstId: "visual-9",
    }),
    false,
  );
});
