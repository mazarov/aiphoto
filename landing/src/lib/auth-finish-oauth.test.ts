import assert from "node:assert/strict";
import test from "node:test";
import { appendAuthError, sanitizeAuthReturnPath } from "./auth-return-path";

test("keeps same-origin next paths", () => {
  assert.equal(sanitizeAuthReturnPath("/admin/payments"), "/admin/payments");
  assert.equal(sanitizeAuthReturnPath("/pricing?test=true"), "/pricing?test=true");
});

test("rejects absolute / protocol-relative next", () => {
  assert.equal(sanitizeAuthReturnPath("https://evil.test/x"), "/");
  assert.equal(sanitizeAuthReturnPath("//evil.test"), "/");
});

test("appends auth_error without breaking existing query", () => {
  assert.equal(
    appendAuthError("/admin/payments", "no_code"),
    "/admin/payments?auth_error=no_code"
  );
  assert.equal(
    appendAuthError("/pricing?test=true", "no_code"),
    "/pricing?test=true&auth_error=no_code"
  );
});
