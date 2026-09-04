import assert from "node:assert/strict";
import test from "node:test";
import { isComposeExampleMatchUnlocked } from "./compose-example-match-access";

test("compose example match stays off for regular users when the flag is off", () => {
  assert.equal(isComposeExampleMatchUnlocked("true", "user@example.com"), true);
  assert.equal(
    isComposeExampleMatchUnlocked("false", "azarov.maxim@gmail.com"),
    true,
  );
  if (process.env.NODE_ENV !== "development") {
    assert.equal(
      isComposeExampleMatchUnlocked("false", "user@example.com"),
      false,
    );
    assert.equal(isComposeExampleMatchUnlocked(undefined, "user@example.com"), false);
  }
});
