import assert from "node:assert/strict";
import test from "node:test";
import {
  HERO_MARQUEE_MAX_CARDS,
  heroMarqueeDurationSeconds,
  takeHeroMarqueeCards,
} from "./hero-marquee";

test("longer curated strips scroll at the same speed", () => {
  assert.equal(heroMarqueeDurationSeconds(4), 110);
  assert.equal(heroMarqueeDurationSeconds(12), 110);
  assert.equal(heroMarqueeDurationSeconds(24), 220);
});

test("hero marquee keeps a short looping strip", () => {
  assert.equal(HERO_MARQUEE_MAX_CARDS, 12);
  assert.deepEqual(
    takeHeroMarqueeCards(Array.from({ length: 50 }, (_, i) => i)),
    Array.from({ length: 12 }, (_, i) => i)
  );
});
