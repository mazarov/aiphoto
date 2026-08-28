import assert from "node:assert/strict";
import test from "node:test";
import {
  mergeGenerationFirstPage,
  takeGenerationPage,
} from "./generations-list";

test("takeGenerationPage uses the extra row as hasMore", () => {
  const rows = [1, 2, 3, 4];
  assert.deepEqual(takeGenerationPage(rows, 3), { page: [1, 2, 3], hasMore: true });
  assert.deepEqual(takeGenerationPage(rows.slice(0, 3), 3), {
    page: [1, 2, 3],
    hasMore: false,
  });
  assert.deepEqual(takeGenerationPage([], 24), { page: [], hasMore: false });
});

test("mergeGenerationFirstPage prepends new rows and keeps older pages", () => {
  const previous = [
    { id: "b", n: 1 },
    { id: "c", n: 2 },
    { id: "d", n: 3 },
  ];
  const fresh = [
    { id: "a", n: 0 },
    { id: "b", n: 11 },
  ];
  assert.deepEqual(mergeGenerationFirstPage(previous, fresh), [
    { id: "a", n: 0 },
    { id: "b", n: 11 },
    { id: "c", n: 2 },
    { id: "d", n: 3 },
  ]);
});
