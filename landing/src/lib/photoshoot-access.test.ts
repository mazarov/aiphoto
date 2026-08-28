import assert from "node:assert/strict";
import test from "node:test";
import { PHOTOSHOOT_DEFAULT_MODEL } from "./photoshoot";
import { isPhotoshootUnlocked, resolvePhotoshootModel } from "./photoshoot-access";

test("photoshoot stays off for regular users when the flag is off", () => {
  assert.equal(isPhotoshootUnlocked("true", "user@example.com"), true);
  assert.equal(isPhotoshootUnlocked("false", "azarov.maxim@gmail.com"), true);
  assert.equal(isPhotoshootUnlocked("false", " Azarov.Maxim@gmail.com "), true);
  if (process.env.NODE_ENV !== "development") {
    assert.equal(isPhotoshootUnlocked("false", "user@example.com"), false);
    assert.equal(isPhotoshootUnlocked(undefined, "user@example.com"), false);
    assert.equal(isPhotoshootUnlocked("", null), false);
  }
});

test("resolvePhotoshootModel uses DB id or default Gemini 3 Pro, never a silent Flash fallback", () => {
  const models = [
    { id: "gemini-2.5-flash-image", cost: 5 },
    { id: PHOTOSHOOT_DEFAULT_MODEL, cost: 10 },
    { id: "seedream-5.0-pro", cost: 10 },
  ];
  assert.equal(PHOTOSHOOT_DEFAULT_MODEL, "gemini-3-pro-image-preview");
  assert.deepEqual(resolvePhotoshootModel("", models), {
    id: PHOTOSHOOT_DEFAULT_MODEL,
    cost: 10,
  });
  assert.deepEqual(resolvePhotoshootModel("seedream-5.0-pro", models), {
    id: "seedream-5.0-pro",
    cost: 10,
  });
  assert.equal(resolvePhotoshootModel("not-a-model", models), null);
  assert.equal(resolvePhotoshootModel("gemini-2.5-flash-image", []), null);
});
