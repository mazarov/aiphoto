import assert from "node:assert/strict";
import test from "node:test";
import {
  isAnalyticsAdminEmail,
  parseAnalyticsAdminEmails,
} from "./analytics-admin-core";

test("admin allowlist parsing normalizes supported separators and case", () => {
  assert.deepEqual(
    parseAnalyticsAdminEmails(" Admin@Example.COM,second@example.com;\n THIRD@example.com "),
    ["admin@example.com", "second@example.com", "third@example.com"],
  );
});

test("admin email matching is case-insensitive and fail-closed", () => {
  const allowlist = parseAnalyticsAdminEmails("admin@example.com");
  assert.equal(isAnalyticsAdminEmail(" ADMIN@example.com ", allowlist), true);
  assert.equal(isAnalyticsAdminEmail("other@example.com", allowlist), false);
  assert.equal(isAnalyticsAdminEmail(null, allowlist), false);
  assert.equal(isAnalyticsAdminEmail("admin@example.com", []), false);
  assert.deepEqual(parseAnalyticsAdminEmails(" , ; \n "), []);
});
