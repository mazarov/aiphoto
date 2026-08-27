import assert from "node:assert/strict";
import { test } from "node:test";
import { uniqueListingChipsByHref } from "./listing-cluster-chips";

test("keeps the first chip when hrefs are unique", () => {
  const items = [
    { href: "/sobytiya/den-rozhdeniya/devushki", label: "Девушке" },
    { href: "/sobytiya/den-rozhdeniya/deti", label: "Детям" },
  ];
  assert.deepEqual(uniqueListingChipsByHref(items), items);
});

test("collapses birthday audience aliases onto one href", () => {
  const items = [
    { href: "/sobytiya/den-rozhdeniya/deti", label: "Мальчик", count: 40 },
    { href: "/sobytiya/den-rozhdeniya/deti", label: "Детям", count: 80 },
    { href: "/sobytiya/den-rozhdeniya/deti", label: "Девочка", count: 20 },
  ];
  const unique = uniqueListingChipsByHref(items, (kept, next) =>
    (next.count ?? 0) > (kept.count ?? 0) ? next : kept
  );
  assert.deepEqual(unique, [
    { href: "/sobytiya/den-rozhdeniya/deti", label: "Детям", count: 80 },
  ]);
});
