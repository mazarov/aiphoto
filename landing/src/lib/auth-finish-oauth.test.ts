import assert from "node:assert/strict";
import test from "node:test";
import {
  appendAuthError,
  appendAuthReturnMarker,
  consumeAuthReturnMarkerFromHref,
  resolveOAuthCallbackError,
  sanitizeAuthReturnPath,
} from "./auth-return-path";
import {
  isRecoverableOAuthExchangeError,
  resolveOAuthFinishLocation,
} from "./auth-finish-oauth";

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

test("strips leftover GoTrue error query from return path", () => {
  assert.equal(
    sanitizeAuthReturnPath(
      "/?error=invalid_request&error_code=bad_oauth_state&error_description=OAuth+state+not+found+or+expired"
    ),
    "/"
  );
  assert.equal(
    sanitizeAuthReturnPath(
      "/promty-dlya-foto-zhenshchiny?sort=new&error=invalid_request&error_code=bad_oauth_state"
    ),
    "/promty-dlya-foto-zhenshchiny?sort=new"
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
  assert.equal(
    sanitizeAuthReturnPath("/catalog?ps_sy=1840&sort=new"),
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
  assert.equal(
    appendAuthReturnMarker("/catalog", "card:visual-hook-neon", 1840),
    "/catalog?ps_auth=1&ps_ov=card%3Avisual-hook-neon&ps_sy=1840"
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
  assert.deepEqual(
    consumeAuthReturnMarkerFromHref("/catalog?ps_auth=1&ps_ov=card:x&ps_sy=1840"),
    { found: true, nextHref: "/catalog" }
  );
});

test("recovers PKCE verifier-missing and invalid-flow replays", () => {
  assert.equal(
    isRecoverableOAuthExchangeError(
      "PKCE code verifier not found in storage. This can happen if the auth flow was initiated in a different browser or device, or if the storage was cleared."
    ),
    true
  );
  assert.equal(isRecoverableOAuthExchangeError("invalid flow state"), true);
  assert.equal(isRecoverableOAuthExchangeError("access_denied"), false);
});

test("logged-in PKCE miss returns to the card instead of auth_error", () => {
  assert.deepEqual(
    resolveOAuthFinishLocation({
      exchangeError:
        "PKCE code verifier not found in storage. This can happen if the auth flow was initiated in a different browser or device, or if the storage was cleared. For SSR frameworks (Next.js, SvelteKit, etc.), use @supabase/ssr on both the server and client to store the code verifier in cookies.",
      hasSessionUser: true,
      next: "/",
      overlay: {
        type: "card",
        slug: "visual-hook-a-candid-intimate-black-and-white-portrait-capturing-a-relaxed-momen-52f7a",
      },
      scrollY: 1840,
    }),
    {
      ok: true,
      destination:
        "/?ps_auth=1&ps_ov=card%3Avisual-hook-a-candid-intimate-black-and-white-portrait-capturing-a-relaxed-momen-52f7a&ps_sy=1840",
    }
  );
});

test("exchange success keeps listing origin and card overlay", () => {
  assert.deepEqual(
    resolveOAuthFinishLocation({
      exchangeError: null,
      hasSessionUser: true,
      next: "/",
      overlay: { type: "card", slug: "visual-hook-neon" },
    }),
    {
      ok: true,
      destination: "/?ps_auth=1&ps_ov=card%3Avisual-hook-neon",
    }
  );
});

test("failed exchange without a session still surfaces auth_error", () => {
  assert.deepEqual(
    resolveOAuthFinishLocation({
      exchangeError: "PKCE code verifier not found in storage",
      hasSessionUser: false,
      next: "/",
      overlay: { type: "card", slug: "visual-hook-neon" },
    }),
    {
      ok: false,
      destination: "/?auth_error=PKCE%20code%20verifier%20not%20found%20in%20storage",
    }
  );
});

test("any exchange error with a live session restores the screen", () => {
  assert.deepEqual(
    resolveOAuthFinishLocation({
      exchangeError: "server_error",
      hasSessionUser: true,
      next: "/promty-dlya-foto-zhenshchiny",
      overlay: { type: "card", slug: "visual-hook-neon" },
    }),
    {
      ok: true,
      destination:
        "/promty-dlya-foto-zhenshchiny?ps_auth=1&ps_ov=card%3Avisual-hook-neon",
    }
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
