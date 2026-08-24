import assert from "node:assert/strict";
import test from "node:test";
import { CAMERA_ORBIT_DEFAULT_MODEL } from "./camera-orbit";
import { isCameraOrbitUnlocked, resolveCameraOrbitModel } from "./camera-orbit-access";

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

test("resolveCameraOrbitModel uses DB id or default Grok, never a silent Flash fallback", () => {
  const models = [
    { id: "gemini-2.5-flash-image", cost: 5 },
    { id: CAMERA_ORBIT_DEFAULT_MODEL, cost: 10 },
    { id: "gemini-3-pro-image-preview", cost: 10 },
  ];
  assert.deepEqual(resolveCameraOrbitModel("", models), {
    id: CAMERA_ORBIT_DEFAULT_MODEL,
    cost: 10,
  });
  assert.deepEqual(resolveCameraOrbitModel("gemini-3-pro-image-preview", models), {
    id: "gemini-3-pro-image-preview",
    cost: 10,
  });
  assert.equal(resolveCameraOrbitModel("not-a-model", models), null);
  assert.equal(resolveCameraOrbitModel("gemini-2.5-flash-image", []), null);
});
