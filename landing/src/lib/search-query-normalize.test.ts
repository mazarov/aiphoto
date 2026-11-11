import assert from "node:assert/strict";
import test from "node:test";
import {
  expandSearchSynonymQuery,
  isPersistableSearchQuery,
  normalizeSearchQueryForCache,
} from "./search-query-normalize";

test("normalizeSearchQueryForCache folds yo-to-e, trims, and collapses spaces", () => {
  assert.equal(
    normalizeSearchQueryForCache("  Чёрно-белое   фото  ёлки "),
    "черно-белое фото елки",
  );
});

test("isPersistableSearchQuery accepts 2..80 normalized chars only", () => {
  assert.equal(isPersistableSearchQuery("а"), false);
  assert.equal(isPersistableSearchQuery("чб"), true);
  assert.equal(isPersistableSearchQuery("x".repeat(80)), true);
  assert.equal(isPersistableSearchQuery("x".repeat(81)), false);
});

test("expandSearchSynonymQuery expands bidirectional RU/EN aliases without mutating normal queries", () => {
  assert.equal(expandSearchSynonymQuery("чб портрет"), "черно-белое портрет");
  assert.equal(expandSearchSynonymQuery("ч/б фото"), "черно-белое фото");
  assert.equal(expandSearchSynonymQuery("чёрно-белый портрет"), "чб портрет");
  assert.equal(expandSearchSynonymQuery("девушка олд мани"), "девушка old money");
  assert.equal(expandSearchSynonymQuery("old money style"), "олд мани style");
  assert.equal(expandSearchSynonymQuery("снимок на полароид"), "снимок на polaroid");
  assert.equal(expandSearchSynonymQuery("polaroid frame"), "полароид frame");
  assert.equal(expandSearchSynonymQuery("киберпанк город"), "cyberpunk город");
  assert.equal(expandSearchSynonymQuery("cyberpunk neon"), "киберпанк neon");
  assert.equal(expandSearchSynonymQuery("аниме аватар"), "anime аватар");
  assert.equal(expandSearchSynonymQuery("фото у авто"), "фото у машина");
  assert.equal(expandSearchSynonymQuery("девушка у ретро автомобиля ночью"), "девушка у ретро машина ночью");
  assert.equal(expandSearchSynonymQuery("открытка на др"), "открытка на день рождения");
  assert.equal(expandSearchSynonymQuery("уютная кухня утренний свет"), null);
});
