import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveHydratedAuthUser,
  shouldHydrateAuthOnPageShow,
  shouldHydrateAuthOnVisible,
} from "./auth-session-hydrate";

test("verified user wins when getUser succeeds", () => {
  assert.equal(
    resolveHydratedAuthUser({
      sessionUser: { id: "session" },
      verifiedUser: { id: "verified" },
      verifyFailed: false,
    })?.id,
    "verified",
  );
});

test("successful empty getUser signs the chrome out", () => {
  assert.equal(
    resolveHydratedAuthUser({
      sessionUser: { id: "session" },
      verifiedUser: null,
      verifyFailed: false,
    }),
    null,
  );
});

test("keeps cookie session when getUser fails", () => {
  assert.equal(
    resolveHydratedAuthUser({
      sessionUser: { id: "session" },
      verifiedUser: null,
      verifyFailed: true,
    })?.id,
    "session",
  );
});

test("stays signed out when getUser fails and there is no session", () => {
  assert.equal(
    resolveHydratedAuthUser({
      sessionUser: null,
      verifiedUser: null,
      verifyFailed: true,
    }),
    null,
  );
});

test("pageshow hydrates on bfcache or leftover return cookie", () => {
  assert.equal(shouldHydrateAuthOnPageShow(true, false), true);
  assert.equal(shouldHydrateAuthOnPageShow(false, true), true);
  assert.equal(shouldHydrateAuthOnPageShow(false, false), false);
});

test("visibility hydrates only the unsigned-in visible tab", () => {
  assert.equal(shouldHydrateAuthOnVisible("visible", false), true);
  assert.equal(shouldHydrateAuthOnVisible("visible", true), false);
  assert.equal(shouldHydrateAuthOnVisible("hidden", false), false);
});
