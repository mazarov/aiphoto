import assert from "node:assert/strict";
import test from "node:test";
import { TAG_REGISTRY } from "./tag-registry";
import {
  PINNED_COUNT,
  getAllExplorerChips,
  getMoreChips,
  getMoreChipsByDimension,
  getPinnedChips,
} from "./homepage-explorer-chips";

test("pinned chips follow Wordstat first-row order without passport", () => {
  const pinned = getPinnedChips();
  assert.equal(pinned.length, PINNED_COUNT);
  assert.deepEqual(
    pinned.map((chip) => `${chip.dimension}:${chip.slug}`),
    [
      "audience_tag:devushka",
      "occasion_tag:den_rozhdeniya",
      "audience_tag:para",
      "audience_tag:muzhchina",
      "audience_tag:semya",
      "audience_tag:detskie",
      "audience_tag:s_parnem",
      "object_tag:s_tortom",
      "style_tag:portret",
      "style_tag:cherno_beloe",
      "object_tag:s_mashinoy",
    ]
  );
  assert.equal(
    pinned.some((chip) => chip.slug === "na_pasport"),
    false
  );
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
