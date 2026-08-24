import assert from "node:assert/strict";
import test from "node:test";
import { isCameraOrbitUnlocked } from "./camera-orbit-access";

test("camera orbit stays off for regular users when the flag is off", () => {
  assert.equal(isCameraOrbitUnlocked("true", "user@example.com"), true);
  assert.equal(isCameraOrbitUnlocked("false", "azarov.maxim@gmail.com"), true);
  assert.equal(isCameraOrbitUnlocked("false", " Azarov.Maxim@gmail.com "), true);
  if (process.env.NODE_ENV !== "development") {
    assert.equal(isCameraOrbitUnlocked("false", "user@example.com"), false);
    assert.equal(isCameraOrbitUnlocked(undefined, "user@example.com"), false);
    assert.equal(isCameraOrbitUnlocked("", null), false);
  }
});
