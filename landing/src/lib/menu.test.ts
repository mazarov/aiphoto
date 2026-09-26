import assert from "node:assert/strict";
import test from "node:test";
import {
  getClusterChipNavigation,
  getSobytiyaChipNavigation,
  getStilChipNavigation,
  MENU,
} from "./menu";
test("getSobytiyaChipNavigation keeps curated event order and marks active page", () => {
  const chips = getSobytiyaChipNavigation("/promty-dlya-foto/1-sentyabrya");
  const hrefs = chips.map((chip) => chip.href);

  assert.ok(hrefs.includes("/promty-dlya-foto/1-sentyabrya"));
  assert.ok(hrefs.includes("/sobytiya/den-rozhdeniya"));
  assert.ok(hrefs.includes("/promty-dlya-foto/halloween"));
  assert.equal(
    hrefs.indexOf("/promty-dlya-foto/8-marta") + 1,
    hrefs.indexOf("/promty-dlya-foto/1-sentyabrya")
  );
  assert.equal(new Set(hrefs).size, hrefs.length);

  const active = chips.find((chip) => chip.href === "/promty-dlya-foto/1-sentyabrya");
  assert.equal(active?.label, "1 сентября");
  assert.equal(active?.active, true);
  assert.ok(chips.filter((chip) => chip.active).length === 1);
});

test("MENU События includes 1 сентября in Праздники", () => {
  const section = MENU.find((item) => item.dimension === "occasion_tag");
  const holidays = section?.groups.find((group) => group.title === "Праздники");
  assert.ok(holidays?.items.some((item) => item.href === "/promty-dlya-foto/1-sentyabrya"));
});

test("MENU does not link through the retired с-парнем redirect", () => {
  const hrefs = MENU.flatMap((section) =>
    section.groups.flatMap((group) => group.items.map((item) => item.href)),
  );
  assert.equal(hrefs.includes("/promty-dlya-foto-s-parnem"), false);
});

test("getStilChipNavigation lists catalog style pages", () => {
  const chips = getStilChipNavigation();
  const hrefs = chips.map((chip) => chip.href);
  assert.ok(hrefs.includes("/promty-dlya-foto/cherno-beloe"));
  assert.ok(hrefs.includes("/promty-dlya-foto/portret"));
  assert.ok(chips.every((chip) => chip.active === false));
});

test("getClusterChipNavigation covers audience and object catalog pages", () => {
  const people = getClusterChipNavigation(
    "audience_tag",
    "/promty-dlya-foto-devushki"
  );
  assert.ok(people.some((chip) => chip.href === "/promty-dlya-foto-devushki" && chip.active));
  assert.ok(people.some((chip) => chip.href === "/promty-dlya-foto-par"));

  const objects = getClusterChipNavigation("object_tag", "/promty-dlya-foto/s-mashinoy");
  assert.ok(objects.some((chip) => chip.href === "/promty-dlya-foto/s-mashinoy" && chip.active));
  assert.ok(objects.some((chip) => chip.href === "/v-forme"));
});
