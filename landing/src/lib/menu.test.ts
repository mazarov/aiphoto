import assert from "node:assert/strict";
import test from "node:test";
import {
  getClusterChipNavigation,
  getSobytiyaChipNavigation,
  getStilChipNavigation,
  MENU,
} from "./menu";
import { SOBYTIYA_1_SENTYABRYA_PATH } from "./sobytiya-1-sentyabrya";

test("getSobytiyaChipNavigation keeps curated event order and marks active page", () => {
  const chips = getSobytiyaChipNavigation(SOBYTIYA_1_SENTYABRYA_PATH);
  const hrefs = chips.map((chip) => chip.href);

  assert.ok(hrefs.includes(SOBYTIYA_1_SENTYABRYA_PATH));
  assert.ok(hrefs.includes("/sobytiya/den-rozhdeniya"));
  assert.ok(hrefs.includes("/halloween"));
  assert.equal(
    hrefs.indexOf("/sobytiya/8-marta") + 1,
    hrefs.indexOf(SOBYTIYA_1_SENTYABRYA_PATH)
  );
  assert.equal(new Set(hrefs).size, hrefs.length);

  const active = chips.find((chip) => chip.href === SOBYTIYA_1_SENTYABRYA_PATH);
  assert.equal(active?.label, "1 сентября");
  assert.equal(active?.active, true);
  assert.ok(chips.filter((chip) => chip.active).length === 1);
});

test("MENU События includes 1 сентября in Праздники", () => {
  const section = MENU.find((item) => item.dimension === "occasion_tag");
  const holidays = section?.groups.find((group) => group.title === "Праздники");
  assert.ok(holidays?.items.some((item) => item.href === SOBYTIYA_1_SENTYABRYA_PATH));
});

test("getStilChipNavigation lists catalog style pages", () => {
  const chips = getStilChipNavigation();
  const hrefs = chips.map((chip) => chip.href);
  assert.ok(hrefs.includes("/stil/cherno-beloe"));
  assert.ok(hrefs.includes("/stil/portret"));
  assert.ok(chips.every((chip) => chip.active === false));
});

test("getClusterChipNavigation covers audience and object catalog pages", () => {
  const people = getClusterChipNavigation(
    "audience_tag",
    "/promty-dlya-foto-devushki"
  );
  assert.ok(people.some((chip) => chip.href === "/promty-dlya-foto-devushki" && chip.active));
  assert.ok(people.some((chip) => chip.href === "/promty-dlya-foto-par"));

  const objects = getClusterChipNavigation("object_tag", "/s-mashinoy");
  assert.ok(objects.some((chip) => chip.href === "/s-mashinoy" && chip.active));
  assert.ok(objects.some((chip) => chip.href === "/v-forme"));
});
