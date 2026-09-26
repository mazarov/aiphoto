import assert from "node:assert/strict";
import { test } from "node:test";
import {
  disagreementKey,
  exclusiveSlugsIn,
  shouldStopBatch,
} from "./backfill-card-subject-audience.mjs";

test("exclusive slugs keep relation tags out of the disagreement key", () => {
  assert.deepEqual(exclusiveSlugsIn(["devushka", "muzhchina", "s_mamoy", "para"]), [
    "devushka",
    "muzhchina",
    "para",
  ]);
  assert.equal(disagreementKey(["muzhchina", "s_kotom"], "devushka"), "muzhchina->devushka");
  assert.equal(disagreementKey(["devushka", "muzhchina", "para"], "para"), "devushka+muzhchina+para->para");
  assert.equal(disagreementKey([], "none"), "none->none");
});

test("stop-loss trips only after a large failing batch", () => {
  assert.equal(shouldStopBatch(3, 20), false);
  assert.equal(shouldStopBatch(5, 50), false);
  assert.equal(shouldStopBatch(6, 50), true);
});
