import assert from "node:assert/strict";
import test from "node:test";
import { heroTileAction } from "./page-hero-ui";

test("carousel tile always removes", () => {
  const action = heroTileAction({ mode: "remove", pinned: true });
  assert.equal(action.op, "unpin");
  assert.equal(action.label, "Убрать");
});

test("grid tile pins, pinned grid tile toggles off", () => {
  assert.equal(heroTileAction({ mode: "pin", pinned: false }).op, "pin");
  const pinned = heroTileAction({ mode: "pin", pinned: true });
  assert.equal(pinned.op, "unpin");
  assert.equal(pinned.label, "В шапке");
});
