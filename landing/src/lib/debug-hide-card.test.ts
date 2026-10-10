import assert from "node:assert/strict";
import test from "node:test";
import {
  omitCardById,
  omitCardFromPages,
  omitHiddenCardIds,
  parseDebugHideCardRequest,
  shouldDropHiddenCardFromListing,
} from "./debug-hide-card";

test("hide request defaults published to false and trims ids", () => {
  const parsed = parseDebugHideCardRequest({
    cardId: "  abc  ",
    confirmSlug: " slug ",
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.deepEqual(parsed.value, {
    cardId: "abc",
    confirmSlug: "slug",
    published: false,
  });
});

test("restore request keeps published true", () => {
  const parsed = parseDebugHideCardRequest({
    cardId: "abc",
    confirmSlug: "slug",
    published: true,
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.published, true);
});

test("rejects empty body and a non-boolean published flag", () => {
  assert.equal(parseDebugHideCardRequest(null).ok, false);
  assert.equal(parseDebugHideCardRequest({ cardId: "a" }).ok, false);
  const badFlag = parseDebugHideCardRequest({
    cardId: "a",
    confirmSlug: "b",
    published: "no",
  });
  assert.equal(badFlag.ok, false);
  if (badFlag.ok) return;
  assert.match(badFlag.error, /boolean/);
});

test("public vitrina drops a hidden card; admin all/no keeps it", () => {
  assert.equal(shouldDropHiddenCardFromListing(null), true);
  assert.equal(shouldDropHiddenCardFromListing("yes"), true);
  assert.equal(shouldDropHiddenCardFromListing("all"), false);
  assert.equal(shouldDropHiddenCardFromListing("no"), false);
});

test("omitHiddenCardIds keeps the array when nothing is hidden", () => {
  const items = [{ id: "a" }];
  assert.equal(omitHiddenCardIds(items, new Set()), items);
  assert.deepEqual(omitHiddenCardIds(items, new Set(["a"])), []);
});

test("omit helpers keep the same array when the card is absent", () => {
  const items = [{ id: "a" }, { id: "b" }];
  assert.equal(omitCardById(items, "missing"), items);
  const pages = [items];
  assert.equal(omitCardFromPages(pages, "missing"), pages);
  assert.deepEqual(omitCardFromPages([[{ id: "a" }, { id: "b" }], [{ id: "a" }]], "a"), [
    [{ id: "b" }],
  ]);
});
