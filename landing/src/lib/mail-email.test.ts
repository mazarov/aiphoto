import assert from "node:assert/strict";
import test from "node:test";
import {
  hashMailEmail,
  isInternalMailEmail,
  isValidMailEmail,
  normalizeMailEmail,
  parseMailAllowlist,
} from "./mail-email";

test("normalizeMailEmail trims and lowercases", () => {
  assert.equal(normalizeMailEmail("  A@PromptShot.RU "), "a@promptshot.ru");
  assert.equal(normalizeMailEmail("   "), null);
});

test("internal and invalid emails are rejected", () => {
  assert.equal(isInternalMailEmail("guest@promptshot.internal"), true);
  assert.equal(isValidMailEmail("guest@promptshot.internal"), false);
  assert.equal(isValidMailEmail("not-an-email"), false);
  assert.equal(isValidMailEmail("user@example.com"), true);
});

test("hash and allowlist stay stable without logging raw email", () => {
  assert.equal(hashMailEmail("User@Example.com"), hashMailEmail("user@example.com"));
  assert.deepEqual(parseMailAllowlist("One@x.ru, two@x.ru;\nTHREE@x.ru"), [
    "one@x.ru",
    "two@x.ru",
    "three@x.ru",
  ]);
});
