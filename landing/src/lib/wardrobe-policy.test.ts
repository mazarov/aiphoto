import assert from "node:assert/strict";
import test from "node:test";
import {
  KEEP_WARDROBE_SECTION_BODY,
  applyWardrobePolicyToPrompt,
  neutralizeWardrobeSections,
  parseWardrobePolicy,
  resolveJobWardrobePolicy,
  resolveRequestedWardrobePolicy,
  shouldShowPreserveOutfitChip,
} from "./wardrobe-policy";

test("parseWardrobePolicy defaults unknown values to replace", () => {
  assert.equal(parseWardrobePolicy("keep"), "keep");
  assert.equal(parseWardrobePolicy("replace"), "replace");
  assert.equal(parseWardrobePolicy(null), "replace");
  assert.equal(parseWardrobePolicy("KEEP"), "replace");
});

test("resolveJobWardrobePolicy keeps only initial I2I with photos", () => {
  assert.equal(
    resolveJobWardrobePolicy({ stored: "keep", hasInputPhotos: true }),
    "keep",
  );
  assert.equal(
    resolveJobWardrobePolicy({ stored: "keep", hasInputPhotos: false }),
    "replace",
  );
  assert.equal(
    resolveJobWardrobePolicy({
      stored: "keep",
      hasInputPhotos: true,
      isPhotoshoot: true,
    }),
    "replace",
  );
  assert.equal(
    resolveJobWardrobePolicy({
      stored: "keep",
      hasInputPhotos: true,
      isVibe: true,
    }),
    "replace",
  );
});

test("resolveRequestedWardrobePolicy requires flag, request, and photos", () => {
  assert.equal(
    resolveRequestedWardrobePolicy({
      preserveOutfitRequested: true,
      flagOn: true,
      hasPhotos: true,
    }),
    "keep",
  );
  assert.equal(
    resolveRequestedWardrobePolicy({
      preserveOutfitRequested: true,
      flagOn: false,
      hasPhotos: true,
    }),
    "replace",
  );
  assert.equal(
    resolveRequestedWardrobePolicy({
      preserveOutfitRequested: false,
      flagOn: true,
      hasPhotos: true,
    }),
    "replace",
  );
  assert.equal(
    resolveRequestedWardrobePolicy({
      preserveOutfitRequested: true,
      flagOn: true,
      hasPhotos: false,
    }),
    "replace",
  );
});

test("shouldShowPreserveOutfitChip is image-compose only", () => {
  assert.equal(
    shouldShowPreserveOutfitChip({
      composeMode: "image",
      photoCount: 1,
      flagOn: true,
    }),
    true,
  );
  assert.equal(
    shouldShowPreserveOutfitChip({
      composeMode: "photoshoot",
      photoCount: 1,
      flagOn: true,
    }),
    false,
  );
  assert.equal(
    shouldShowPreserveOutfitChip({
      composeMode: "image",
      photoCount: 0,
      flagOn: true,
    }),
    false,
  );
});

test("neutralizeWardrobeSections replaces Clothing body and keeps Scene", () => {
  const prompt = [
    "Scene",
    "Evening embankment, city lights.",
    "Clothing",
    "Red silk evening dress, gold heels.",
    "Pose",
    "Looking over the shoulder.",
  ].join("\n");
  const next = neutralizeWardrobeSections(prompt);
  assert.match(next, /Evening embankment/);
  assert.match(next, /Looking over the shoulder/);
  assert.match(next, new RegExp(KEEP_WARDROBE_SECTION_BODY));
  assert.doesNotMatch(next, /Red silk evening dress/);
});

test("neutralizeWardrobeSections rewrites inline Clothing heading", () => {
  const next = neutralizeWardrobeSections("Clothing: navy suit and oxfords\nScene\nOffice.");
  assert.match(next, /Office/);
  assert.match(next, new RegExp(KEEP_WARDROBE_SECTION_BODY));
  assert.doesNotMatch(next, /navy suit/);
});

test("applyWardrobePolicyToPrompt leaves replace text untouched", () => {
  const raw = "Clothing\nRed dress";
  assert.equal(applyWardrobePolicyToPrompt(raw, "replace"), raw);
  assert.doesNotMatch(applyWardrobePolicyToPrompt(raw, "keep"), /Red dress/);
});
