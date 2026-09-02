import assert from "node:assert/strict";
import test from "node:test";
import { HERO_MARQUEE_MAX_CARDS, takeHeroMarqueeCards } from "./hero-marquee";

test("hero marquee keeps a short looping strip", () => {
  assert.equal(HERO_MARQUEE_MAX_CARDS, 12);
  assert.deepEqual(
    takeHeroMarqueeCards(Array.from({ length: 50 }, (_, i) => i)),
    Array.from({ length: 12 }, (_, i) => i)
  );
});
