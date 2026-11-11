import assert from "node:assert/strict";
import test from "node:test";
import {
  VISUAL_SEARCH_EVAL_QUERIES,
  exactTitlePreserved,
  filterByVisualDistanceThreshold,
  recallAtK,
  summarizeVisualDistances,
  zeroResultRate,
} from "./visual-search-eval";

test("eval helpers score recall, exact-title regressions, and distance cutoffs", () => {
  assert.ok(VISUAL_SEARCH_EVAL_QUERIES.length >= 22);
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

  const distStats = summarizeVisualDistances([0.2, 0.35, 0.5, 0.72, 0.85]);
  assert.equal(distStats.count, 5);
  assert.equal(distStats.min, 0.2);
  assert.equal(distStats.p50, 0.5);
  assert.equal(distStats.max, 0.85);

  const filtered = filterByVisualDistanceThreshold(
    [
      { id: "near", visual_distance: 0.42 },
      { id: "edge", visual_distance: 0.7 },
      { id: "far", visual_distance: 0.71 },
    ],
    0.7,
  );
  assert.deepEqual(
    filtered.map((item) => item.id),
    ["near", "edge"],
  );
});
