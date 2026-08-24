import assert from "node:assert/strict";
import test from "node:test";
import { isCameraOrbitUnlocked } from "./camera-orbit-access";

test("camera orbit stays off for regular users when the flag is off", () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    assert.equal(isCameraOrbitUnlocked("false", "user@example.com"), false);
    assert.equal(isCameraOrbitUnlocked(undefined, "user@example.com"), false);
    assert.equal(isCameraOrbitUnlocked("", null), false);
    assert.equal(isCameraOrbitUnlocked("false", "azarov.maxim@gmail.com"), true);
    assert.equal(isCameraOrbitUnlocked("false", " Azarov.Maxim@gmail.com "), true);
    assert.equal(isCameraOrbitUnlocked("true", "user@example.com"), true);
  } finally {
    process.env.NODE_ENV = previous;
  }
});
