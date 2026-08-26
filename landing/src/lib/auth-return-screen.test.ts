import assert from "node:assert/strict";
import test from "node:test";
import {
  hasAuthReturnRestoreSignal,
  sanitizeAuthReturnDestination,
  resolveRememberedReturnPath,
} from "./auth-return-path";
import {
  appendAuthReturnDestination,
  captureAuthReturnScreen,
  cardSlugFromPath,
  parseAuthReturnOverlay,
  preferListingPathOverOverlayNext,
  resetLiveAuthReturnOverlayForTests,
  sanitizeAuthReturnOverlay,
  sanitizeOverlaySlug,
  serializeAuthReturnOverlay,
} from "./auth-return-screen";
import { resolveOAuthNextPath } from "./auth-finish-oauth";

test.afterEach(() => {
  resetLiveAuthReturnOverlayForTests();
});

test("cookie fills remembered path when sessionStorage is empty", () => {
  assert.equal(resolveRememberedReturnPath(null, null), null);
  assert.equal(
    resolveRememberedReturnPath(null, "/promty-dlya-foto-zhenshchiny"),
    "/promty-dlya-foto-zhenshchiny"
  );
  assert.equal(
    resolveRememberedReturnPath("/catalog?sort=new", "/"),
    "/catalog?sort=new"
  );
});

test("auth/api destinations collapse to home", () => {
  assert.equal(sanitizeAuthReturnDestination("/auth/callback?next=/p/x"), "/");
  assert.equal(sanitizeAuthReturnDestination("/api/me"), "/");
  assert.equal(
    sanitizeAuthReturnDestination("/promty-dlya-foto-muzhchiny?sort=new"),
    "/promty-dlya-foto-muzhchiny?sort=new"
  );
});

test("overlay slug rejects paths and protocols", () => {
  assert.equal(sanitizeOverlaySlug("visual-hook-neon"), "visual-hook-neon");
  assert.equal(sanitizeOverlaySlug("../p/x"), null);
  assert.equal(sanitizeOverlaySlug("https://evil.test"), null);
  assert.deepEqual(sanitizeAuthReturnOverlay({ type: "pricing" }), {
    type: "pricing",
  });
  assert.deepEqual(sanitizeAuthReturnOverlay({ type: "card", slug: "ok-slug" }), {
    type: "card",
    slug: "ok-slug",
  });
  assert.equal(
    sanitizeAuthReturnOverlay({ type: "card", slug: "a/b" }),
    null
  );
});

test("overlay serialize / parse round-trips", () => {
  assert.equal(
    serializeAuthReturnOverlay({ type: "card", slug: "foo-bar" }),
    "card:foo-bar"
  );
  assert.deepEqual(parseAuthReturnOverlay("card:foo-bar"), {
    type: "card",
    slug: "foo-bar",
  });
  assert.deepEqual(parseAuthReturnOverlay("pricing"), { type: "pricing" });
  assert.equal(parseAuthReturnOverlay("card:../x"), null);
});

test("card overlay returns to listing origin, not /p/slug", () => {
  const screen = captureAuthReturnScreen({
    currentPath: "/p/visual-hook-neon",
    live: {
      originPath: "/promty-dlya-foto-zhenshchiny?sort=new",
      overlay: { type: "card", slug: "visual-hook-neon" },
    },
    hasPendingGenerateDock: false,
  });
  assert.deepEqual(screen, {
    path: "/promty-dlya-foto-zhenshchiny?sort=new",
    overlay: { type: "card", slug: "visual-hook-neon" },
  });
});

test("generate-from-card keeps the prompt card open", () => {
  const screen = captureAuthReturnScreen({
    currentPath: "/p/visual-hook-neon",
    live: {
      originPath: "/catalog",
      overlay: { type: "card", slug: "visual-hook-neon" },
    },
  });
  assert.deepEqual(screen, {
    path: "/catalog",
    overlay: { type: "card", slug: "visual-hook-neon" },
  });
});

test("hard /p/slug without live overlay still restores the card", () => {
  assert.equal(cardSlugFromPath("/p/visual-hook-neon?ps_auth=1"), "visual-hook-neon");
  const screen = captureAuthReturnScreen({
    currentPath: "/p/visual-hook-neon",
    live: null,
    lastListingPath: null,
  });
  assert.deepEqual(screen, {
    path: "/p/visual-hook-neon",
    overlay: { type: "card", slug: "visual-hook-neon" },
  });
});

test("hard /p/slug with last listing returns to listing and keeps card overlay", () => {
  const screen = captureAuthReturnScreen({
    currentPath: "/p/visual-hook-neon",
    live: null,
    lastListingPath: "/promty-dlya-foto-zhenshchiny?sort=new",
  });
  assert.deepEqual(screen, {
    path: "/promty-dlya-foto-zhenshchiny?sort=new",
    overlay: { type: "card", slug: "visual-hook-neon" },
  });
});

test("destination URL carries the card overlay so restorer cannot miss it", () => {
  assert.equal(
    appendAuthReturnDestination("/catalog", {
      type: "card",
      slug: "visual-hook-neon",
    }),
    "/catalog?ps_auth=1&ps_ov=card%3Avisual-hook-neon"
  );
  assert.equal(
    hasAuthReturnRestoreSignal("/catalog?ps_ov=card:visual-hook-neon", false),
    true
  );
  assert.equal(hasAuthReturnRestoreSignal("/catalog", false), false);
  assert.equal(hasAuthReturnRestoreSignal("/catalog", true), true);
});

test("prefer listing path when next is the overlay URL", () => {
  assert.equal(
    preferListingPathOverOverlayNext({
      fromQuery: "/p/visual-hook-neon",
      rememberedPath: "/catalog?sort=new",
      overlay: { type: "card", slug: "visual-hook-neon" },
    }),
    "/catalog?sort=new"
  );
  assert.equal(
    preferListingPathOverOverlayNext({
      fromQuery: "/p/visual-hook-neon",
      rememberedPath: null,
      overlay: null,
    }),
    "/p/visual-hook-neon"
  );
});

test("empty next falls back to remembered listing path", () => {
  assert.equal(
    resolveOAuthNextPath(new URLSearchParams("next="), {
      rememberedPath: "/catalog",
      overlay: null,
    }),
    "/catalog"
  );
  assert.equal(
    resolveOAuthNextPath(new URLSearchParams(), {
      rememberedPath: "/promty-dlya-foto-zhenshchiny",
      overlay: null,
    }),
    "/promty-dlya-foto-zhenshchiny"
  );
  assert.equal(
    resolveOAuthNextPath(
      new URLSearchParams("next=/p/visual-hook-neon"),
      {
        rememberedPath: "/catalog",
        overlay: { type: "card", slug: "visual-hook-neon" },
      }
    ),
    "/catalog"
  );
});
