import assert from "node:assert/strict";
import test from "node:test";
import {
  GENERACIYA_FOTO_HUB_PATH,
  getGeneraciyaFotoChipNavigation,
} from "./generaciya-foto-chip-nav";
import { GENERACIYA_FOTO_SEO } from "./generaciya-foto-seo-copy";
import { GENERACIYA_FOTO_SCENARIO_ROUTES } from "./generaciya-foto-routes";

test("hub chip nav is scenarios only", () => {
  const hub = getGeneraciyaFotoChipNavigation(null);
  assert.equal(hub.length, GENERACIYA_FOTO_SCENARIO_ROUTES.length);
  assert.equal(hub.some((item) => item.kind === "hub"), false);
  assert.equal(hub[0].kind, "scenario");
  assert.equal(hub[0].href, "/generaciya-foto/pary");
  assert.deepEqual(
    hub.map((item) => item.href),
    GENERACIYA_FOTO_SCENARIO_ROUTES.map(
      (route) => `/generaciya-foto/${route.slug}`
    )
  );
  assert.equal(
    hub.filter((item) => item.kind === "scenario" && item.active).length,
    0
  );
});

test("nested slug keeps hub chip first and marks only that scenario active", () => {
  const items = getGeneraciyaFotoChipNavigation("devushki");
  assert.equal(items[0].kind, "hub");
  assert.equal(items[0].href, GENERACIYA_FOTO_HUB_PATH);
  assert.equal(items[0].label, GENERACIYA_FOTO_SEO.chipHubLabel);
  assert.equal(items[0].active, false);
  const current = items.find((item) => item.active);
  assert.equal(current?.kind, "scenario");
  assert.equal(current?.href, "/generaciya-foto/devushki");
});
