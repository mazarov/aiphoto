import assert from "node:assert/strict";
import test from "node:test";
import {
  cardRepeatComposeIntent,
  dockSurfaceForCardRepeat,
  listingPathForGenerateLeave,
  resolveCardRepeatAction,
  shouldKeepCardAuthReturnOverlay,
} from "./card-repeat-auth";

test("guest Повторить waits while auth is hydrating", () => {
  assert.equal(
    resolveCardRepeatAction({ isAuthed: false, authLoading: true }),
    "wait"
  );
  assert.equal(
    resolveCardRepeatAction({ isAuthed: true, authLoading: true }),
    "wait"
  );
});

test("video card Повторить seeds animate + photos sheet", () => {
  assert.equal(cardRepeatComposeIntent({ videoUrl: null }), "resume");
  assert.equal(cardRepeatComposeIntent({ videoUrl: "   " }), "resume");
  assert.equal(
    cardRepeatComposeIntent({ videoUrl: "https://cdn.example/a.mp4" }),
    "animate"
  );
  assert.equal(dockSurfaceForCardRepeat("resume"), null);
  assert.equal(dockSurfaceForCardRepeat("animate"), "photos");
});

test("guest Повторить opens auth; authed opens generate", () => {
  assert.equal(
    resolveCardRepeatAction({ isAuthed: false, authLoading: false }),
    "auth"
  );
  assert.equal(
    resolveCardRepeatAction({ isAuthed: true, authLoading: false }),
    "generate"
  );
});

test("generate leave uses last listing, never a /p/ overlay", () => {
  assert.equal(
    listingPathForGenerateLeave({ lastListingPath: "/" }),
    "/"
  );
  assert.equal(
    listingPathForGenerateLeave({
      lastListingPath: "/promty-dlya-foto-zhenshchiny?sort=new",
    }),
    "/promty-dlya-foto-zhenshchiny?sort=new"
  );
  assert.equal(
    listingPathForGenerateLeave({ lastListingPath: "/p/visual-hook-neon" }),
    "/"
  );
  assert.equal(listingPathForGenerateLeave({ lastListingPath: null }), "/");
  assert.equal(
    listingPathForGenerateLeave({
      lastListingPath: null,
      fallback: "/p/visual-hook-neon",
    }),
    "/"
  );
});

test("listing leave strips leftover GoTrue error query", () => {
  assert.equal(
    listingPathForGenerateLeave({
      lastListingPath:
        "/?error=invalid_request&error_code=bad_oauth_state&error_description=OAuth+state+not+found+or+expired",
    }),
    "/"
  );
});

test("open generate-dock must not replace a live card overlay", () => {
  assert.equal(
    shouldKeepCardAuthReturnOverlay({ type: "card", slug: "visual-hook-neon" }),
    true
  );
  assert.equal(
    shouldKeepCardAuthReturnOverlay({ type: "generate-dock", intent: "resume" }),
    false
  );
  assert.equal(shouldKeepCardAuthReturnOverlay(null), false);
});
