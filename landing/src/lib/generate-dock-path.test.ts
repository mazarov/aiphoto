import assert from "node:assert/strict";
import test from "node:test";
import {
  isGenerateDockListingPath,
  isGenerateDockSeoPagePath,
  normalizeGenerateDockPath,
} from "./generate-dock-path";

test("normalizeGenerateDockPath strips trailing slash", () => {
  assert.equal(normalizeGenerateDockPath(""), "/");
  assert.equal(normalizeGenerateDockPath("/"), "/");
  assert.equal(normalizeGenerateDockPath("/foto-v-promt/"), "/foto-v-promt");
});

test("isGenerateDockSeoPagePath is only /generaciya-foto", () => {
  assert.equal(isGenerateDockSeoPagePath("/generaciya-foto"), true);
  assert.equal(isGenerateDockSeoPagePath("/generaciya-foto/"), true);
  assert.equal(isGenerateDockSeoPagePath("/foto-v-promt"), false);
});

test("isGenerateDockListingPath includes foto-v-promt and analyses", () => {
  assert.equal(isGenerateDockListingPath("/foto-v-promt"), true);
  assert.equal(isGenerateDockListingPath("/foto-v-promt/"), true);
  assert.equal(isGenerateDockListingPath("/analyses"), true);
  assert.equal(isGenerateDockListingPath("/generations"), true);
  assert.equal(isGenerateDockListingPath("/generaciya-foto"), true);
});

test("isGenerateDockListingPath still blocks admin, pricing, and cards", () => {
  assert.equal(isGenerateDockListingPath("/admin"), false);
  assert.equal(isGenerateDockListingPath("/admin/analyze-history"), false);
  assert.equal(isGenerateDockListingPath("/pricing"), false);
  assert.equal(isGenerateDockListingPath("/p/some-card"), false);
});
