import assert from "node:assert/strict";
import test from "node:test";
import {
  appendUniqueCardPage,
  appendUniqueCardsById,
  buildListingGridItems,
} from "./listing-cards";

test("appendUniqueCardsById keeps the first occurrence across pages", () => {
  const page1 = [{ id: "a" }, { id: "b" }];
  const page2 = [{ id: "b" }, { id: "c" }, { id: "c" }];
  assert.deepEqual(
    appendUniqueCardsById(page1, page2).map((c) => c.id),
    ["a", "b", "c"]
  );
});

test("appendUniqueCardsById dedupes a dirty first page", () => {
  assert.deepEqual(
    appendUniqueCardsById([], [{ id: "a" }, { id: "a" }]).map((c) => c.id),
    ["a"]
  );
});

test("appendUniqueCardPage preserves earlier masonry batches", () => {
  const page1 = [{ id: "a" }, { id: "b" }];
  const pages = appendUniqueCardPage([page1], [
    { id: "b" },
    { id: "c" },
    { id: "c" },
    { id: "d" },
  ]);
  assert.equal(pages[0], page1);
  assert.deepEqual(
    pages.map((page) => page.map((card) => card.id)),
    [["a", "b"], ["c", "d"]]
  );
});

test("appendUniqueCardPage does not add an empty duplicate batch", () => {
  const pages = [[{ id: "a" }]];
  assert.equal(appendUniqueCardPage(pages, [{ id: "a" }]), pages);
});

test("buildListingGridItems skips a single that already appeared", () => {
  const cards = [
    { id: "dup", sourceGroupKey: null, cardSplitTotal: 1 },
    { id: "dup", sourceGroupKey: null, cardSplitTotal: 1 },
  ];
  const items = buildListingGridItems(cards);
  assert.equal(items.length, 1);
  assert.equal(items[0]?.type, "single");
  if (items[0]?.type === "single") assert.equal(items[0].card.id, "dup");
});

test("buildListingGridItems collapses split siblings and ignores a later ranked copy", () => {
  const cards = [
    { id: "a", sourceGroupKey: "msg-1", cardSplitTotal: 2 },
    { id: "b", sourceGroupKey: "msg-1", cardSplitTotal: 2 },
    { id: "b", sourceGroupKey: "msg-1", cardSplitTotal: 2 },
  ];
  const items = buildListingGridItems(cards);
  assert.equal(items.length, 1);
  assert.equal(items[0]?.type, "group");
  if (items[0]?.type === "group") {
    assert.equal(items[0].key, "msg-1");
    assert.deepEqual(
      items[0].cards.map((c) => c.id),
      ["a", "b"]
    );
  }
});

test("buildListingGridItems skips a single that was already in a group", () => {
  const cards = [
    { id: "a", sourceGroupKey: "msg-1", cardSplitTotal: 2 },
    { id: "b", sourceGroupKey: "msg-1", cardSplitTotal: 2 },
    { id: "b", sourceGroupKey: null, cardSplitTotal: 1 },
  ];
  const items = buildListingGridItems(cards);
  assert.equal(items.length, 1);
  assert.equal(items[0]?.type, "group");
});
