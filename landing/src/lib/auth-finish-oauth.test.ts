import assert from "node:assert/strict";
import test from "node:test";
import {
  appendAuthError,
  appendAuthReturnMarker,
  consumeAuthReturnMarkerFromHref,
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

test("auth_error path drops a leftover return marker", () => {
  assert.equal(
    appendAuthError("/catalog?ps_auth=1", "no_code"),
    "/catalog?auth_error=no_code"
  );
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

test("strips leftover ps_auth from remembered return paths", () => {
  assert.equal(
    sanitizeAuthReturnPath("/catalog?ps_auth=1&sort=new"),
    "/catalog?sort=new"
  );
  assert.equal(
    sanitizeAuthReturnPath("/catalog?ps_ov=card:foo&sort=new"),
    "/catalog?sort=new"
  );
});

test("appends a one-shot return marker without dropping query or hash", () => {
  assert.equal(appendAuthReturnMarker("/catalog"), "/catalog?ps_auth=1");
  assert.equal(
    appendAuthReturnMarker("/pricing?test=true#pay"),
    "/pricing?test=true&ps_auth=1#pay"
  );
  assert.equal(appendAuthReturnMarker("/catalog?ps_auth=1"), "/catalog?ps_auth=1");
  assert.equal(
    appendAuthReturnMarker("/catalog", "card:visual-hook-neon"),
    "/catalog?ps_auth=1&ps_ov=card%3Avisual-hook-neon"
  );
});

test("consumes the return marker from an absolute or relative href", () => {
  assert.deepEqual(
    consumeAuthReturnMarkerFromHref("https://promptshot.ru/catalog?ps_auth=1&sort=new"),
    { found: true, nextHref: "/catalog?sort=new" }
  );
  assert.deepEqual(consumeAuthReturnMarkerFromHref("/catalog"), {
    found: false,
    nextHref: "/catalog",
  });
  assert.deepEqual(
    consumeAuthReturnMarkerFromHref("/catalog?ps_ov=card:visual-hook-neon"),
    { found: true, nextHref: "/catalog" }
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
