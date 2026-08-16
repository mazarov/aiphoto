import assert from "node:assert/strict";
import test from "node:test";
import {
  creditsRemainingByUserId,
  parseAdminUserGenerationClientSource,
  parseAdminUserGenerationPublicationFilter,
  parseAdminUserGenerationStatus,
  parseUserCreditsRemaining,
  sanitizeGenerationError,
} from "./admin-user-generations";

test("admin user generation filters are strict and normalized", () => {
  assert.equal(parseAdminUserGenerationStatus(null), "all");
  assert.equal(parseAdminUserGenerationStatus("PROCESSING"), "processing");
  assert.equal(parseAdminUserGenerationStatus("retrying"), null);
  assert.equal(parseAdminUserGenerationPublicationFilter("PUBLISHED"), "published");
  assert.equal(parseAdminUserGenerationPublicationFilter("missing"), null);
  assert.equal(parseAdminUserGenerationClientSource(null), null);
  assert.equal(parseAdminUserGenerationClientSource("all"), null);
  assert.equal(parseAdminUserGenerationClientSource("Extension_STV"), "extension_stv");
  assert.equal(parseAdminUserGenerationClientSource("../admin"), undefined);
});

test("generation errors are compact and safe for the admin response", () => {
  assert.equal(sanitizeGenerationError(null), null);
  assert.equal(sanitizeGenerationError("  upstream\n timeout  "), "upstream timeout");
  assert.equal(sanitizeGenerationError("x".repeat(500))?.length, 300);
});

test("user credits remaining floor to a non-negative integer", () => {
  assert.equal(parseUserCreditsRemaining(null), null);
  assert.equal(parseUserCreditsRemaining(""), null);
  assert.equal(parseUserCreditsRemaining("12.8"), 12);
  assert.equal(parseUserCreditsRemaining(-3), 0);
  assert.deepEqual(
    [...creditsRemainingByUserId([
      { id: "u1", credits: 20 },
      { id: "u2", credits: "0" },
      { id: "", credits: 5 },
    ])],
    [["u1", 20], ["u2", 0]],
  );
});
