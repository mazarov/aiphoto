import assert from "node:assert/strict";
import test from "node:test";
import { TAG_REGISTRY } from "./tag-registry";
import {
  HOMEPAGE_CATALOG_THEME_COUNT,
  PINNED_COUNT,
  getAllExplorerChips,
  getHomepageCatalogThemeItems,
  getMoreChips,
  getMoreChipsByDimension,
  getPinnedChips,
} from "./homepage-explorer-chips";

test("pinned chips are 15 without passport, documents, or realistic", () => {
  const pinned = getPinnedChips();
  const catalog = new Set(getHomepageCatalogThemeItems().map((item) => item.title));
  assert.equal(pinned.length, PINNED_COUNT);
  assert.deepEqual(
    pinned.map((chip) => chip.label),
    [
      "Девушки",
      "День рождения",
      "Пары",
      "Мужчины",
      "Семья",
      "Дети",
      "С парнем",
      "С тортом",
      "Портрет",
      "С собакой",
      "На чёрном фоне",
      "Девочка",
      "Свадьба",
      "Мальчик",
      "В форме",
    ]
  );
  assert.equal(
    pinned.some(
      (chip) =>
        chip.slug === "na_pasport" ||
        chip.slug === "na_dokumenty" ||
        chip.slug === "realistichnoe"
    ),
    false
  );
  const extras = pinned.slice(9).map((chip) => chip.label);
  assert.equal(extras.includes("В форме"), true);
  for (const label of extras) {
    assert.equal(catalog.has(label), false, `extra chip ${label} is already in catalog`);
  }
});

test("explorer chips cover every TAG_REGISTRY entry exactly once", () => {
  const chips = getAllExplorerChips();
  const keys = chips.map((chip) => `${chip.dimension}:${chip.slug}`);
  const registryKeys = TAG_REGISTRY.map((tag) => `${tag.dimension}:${tag.slug}`);
  assert.deepEqual(new Set(keys), new Set(registryKeys));
  assert.equal(keys.length, registryKeys.length);
});

test("more chips exclude pinned and stay Wordstat-sorted within groups", () => {
  const pinnedKeys = new Set(
    getPinnedChips().map((chip) => `${chip.dimension}:${chip.slug}`)
  );
  const more = getMoreChips();
  assert.ok(more.length > 0);
  for (const chip of more) {
    assert.equal(pinnedKeys.has(`${chip.dimension}:${chip.slug}`), false);
  }
  for (let i = 1; i < more.length; i++) {
    const prev = more[i - 1];
    const next = more[i];
    assert.ok(
      prev.score > next.score ||
        (prev.score === next.score &&
          prev.label.localeCompare(next.label, "ru") <= 0)
    );
  }

  const grouped = getMoreChipsByDimension();
  const groupedKeys = grouped.flatMap((group) =>
    group.chips.map((chip) => `${chip.dimension}:${chip.slug}`)
  );
  assert.deepEqual(groupedKeys.sort(), more.map((chip) => `${chip.dimension}:${chip.slug}`).sort());
});

test("catalog theme items take Wordstat top 15 without passport, documents, husband, realistic", () => {
  const items = getHomepageCatalogThemeItems();

  assert.equal(items.length, HOMEPAGE_CATALOG_THEME_COUNT);
  assert.deepEqual(
    items.map((item) => item.title),
    [
      "Девушки",
      "День рождения",
      "Пары",
      "Мужчины",
      "Семья",
      "Дети",
      "С парнем",
      "С тортом",
      "Портрет",
      "Чёрно-белое",
      "Мультяшное",
      "С машиной",
      "Деловое",
      "С мамой",
      "Студийное",
    ]
  );
  const titles = new Set(items.map((item) => item.title));
  assert.equal(titles.has("На паспорт"), false);
  assert.equal(titles.has("На документы"), false);
  assert.equal(titles.has("С мужем"), false);
  assert.equal(titles.has("Реалистичное"), false);
  for (const item of items) {
    assert.equal(item.href.startsWith("/generaciya-foto"), false);
    assert.equal(item.title.length > 0, true);
  }
});

test("head-cluster and tool expanders are not chips", () => {
  const labels = getAllExplorerChips().map((chip) => chip.label.toLowerCase());
  const slugs = getAllExplorerChips().map((chip) => chip.slug);
  for (const banned of ["gpt", "гпт", "gemini", "гемини", "nano", "банан", "chatgpt"]) {
    assert.equal(
      labels.some((label) => label.includes(banned)),
      false,
      `unexpected chip label containing ${banned}`
    );
    assert.equal(
      slugs.some((slug) => slug.includes(banned)),
      false,
      `unexpected chip slug containing ${banned}`
    );
  }
});
