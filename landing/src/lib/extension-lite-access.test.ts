import assert from "node:assert/strict";
import test from "node:test";
import { isExtensionLiteGenerateUnlocked } from "./extension-lite-access";

test("extension lite generate stays closed unless the flag or allowlist says otherwise", () => {
  assert.equal(isExtensionLiteGenerateUnlocked("true", "user@example.com"), true);
  assert.equal(isExtensionLiteGenerateUnlocked("1", null), true);
  assert.equal(isExtensionLiteGenerateUnlocked("on", undefined), true);
  assert.equal(isExtensionLiteGenerateUnlocked("yes", ""), true);
  assert.equal(isExtensionLiteGenerateUnlocked("false", "azarov.maxim@gmail.com"), true);
  assert.equal(isExtensionLiteGenerateUnlocked("false", " Azarov.Maxim@gmail.com "), true);
  assert.equal(isExtensionLiteGenerateUnlocked("false", "user@example.com"), false);
  assert.equal(isExtensionLiteGenerateUnlocked(undefined, "user@example.com"), false);
  assert.equal(isExtensionLiteGenerateUnlocked("", null), false);
  assert.equal(isExtensionLiteGenerateUnlocked("false", null), false);
});
