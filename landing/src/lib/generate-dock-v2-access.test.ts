import assert from "node:assert/strict";
import test from "node:test";
import {
  GENERATE_DOCK_V2_CONFIG_KEY,
  isGenerateDockV2Unlocked,
} from "./generate-dock-v2-access";

test("GENERATE_DOCK_V2_CONFIG_KEY matches SQL 282", () => {
  assert.equal(GENERATE_DOCK_V2_CONFIG_KEY, "generate_dock_v2_enabled");
});

test("isGenerateDockV2Unlocked is closed by default and opens on 'true' or '1'", () => {
  assert.equal(isGenerateDockV2Unlocked(undefined, null), false);
  assert.equal(isGenerateDockV2Unlocked(null, null), false);
  assert.equal(isGenerateDockV2Unlocked("", null), false);
  assert.equal(isGenerateDockV2Unlocked("false", "visitor@example.com"), false);
  assert.equal(isGenerateDockV2Unlocked("0", "visitor@example.com"), false);

  assert.equal(isGenerateDockV2Unlocked("true", null), true);
  assert.equal(isGenerateDockV2Unlocked(" TRUE ", "visitor@example.com"), true);
  assert.equal(isGenerateDockV2Unlocked("1", null), true);
});

test("isGenerateDockV2Unlocked allows internal QA email while DB flag is 'false'", () => {
  assert.equal(
    isGenerateDockV2Unlocked("false", "azarov.maxim@gmail.com"),
    true,
  );
  assert.equal(
    isGenerateDockV2Unlocked(undefined, "Azarov.Maxim@gmail.com"),
    true,
  );
  assert.equal(
    isGenerateDockV2Unlocked("false", "someone.else@gmail.com"),
    false,
  );
});
