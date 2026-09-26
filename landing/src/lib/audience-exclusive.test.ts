import assert from "node:assert/strict";
import { test } from "node:test";
import {
  EXCLUSIVE_AUDIENCE_PROMPT_RULES,
  normalizeExclusiveAudience,
} from "./audience-exclusive";

test("couple keeps para and drops both genders", () => {
  assert.deepEqual(
    normalizeExclusiveAudience(["devushka", "muzhchina", "para", "vlyublennykh"]),
    ["para", "vlyublennykh"],
  );
});

test("family drops adult genders and keeps the relationship", () => {
  assert.deepEqual(
    normalizeExclusiveAudience(["semya", "devushka", "muzhchina", "s_mamoy"]),
    ["semya", "s_mamoy"],
  );
});

test("both genders without para stay for vision to decide", () => {
  assert.deepEqual(normalizeExclusiveAudience(["devushka", "muzhchina"]), [
    "devushka",
    "muzhchina",
  ]);
});

test("solo man is unchanged", () => {
  assert.deepEqual(normalizeExclusiveAudience(["muzhchina", "delovoe"]), [
    "muzhchina",
    "delovoe",
  ]);
});

test("para without stacked genders is unchanged", () => {
  assert.deepEqual(normalizeExclusiveAudience(["para", "vlyublennykh"]), [
    "para",
    "vlyublennykh",
  ]);
});

test("prompt rules forbid clothing-based gender and stacked exclusive tags", () => {
  assert.match(EXCLUSIVE_AUDIENCE_PROMPT_RULES, /Do not infer gender from clothing/);
  assert.match(EXCLUSIVE_AUDIENCE_PROMPT_RULES, /Do not also add devushka or muzhchina/);
});
