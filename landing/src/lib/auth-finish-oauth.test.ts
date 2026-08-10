import assert from "node:assert/strict";
import test from "node:test";
import {
  appendAuthError,
  resolveOAuthCallbackError,
  sanitizeAuthReturnPath,
} from "./auth-return-path";

test("keeps same-origin next paths", () => {
  assert.equal(sanitizeAuthReturnPath("/admin/payments"), "/admin/payments");
  assert.equal(sanitizeAuthReturnPath("/pricing?test=true"), "/pricing?test=true");
});

test("strips prior auth_error from return path", () => {
  assert.equal(
    sanitizeAuthReturnPath("/promty-dlya-foto-muzhchiny?auth_error=no_code"),
    "/promty-dlya-foto-muzhchiny"
  );
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

test("resolves GoTrue callback error params", () => {
  const params = new URLSearchParams({
    error: "server_error",
    error_description: "Database error saving new user",
  });
  assert.equal(
    resolveOAuthCallbackError(params),
    "Database error saving new user"
  );
  assert.equal(resolveOAuthCallbackError(new URLSearchParams()), "no_code");
});
