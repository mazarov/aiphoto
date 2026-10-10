/** `npx tsx --conditions react-server --test src/lib/tag-patterns.test.ts` */
import assert from "node:assert/strict";
import test from "node:test";
import { TAG_PATTERNS, patternsForTag } from "./tag-patterns";
import { TAG_REGISTRY } from "./tag-registry";

test("every registry tag has a pattern entry and there are no orphan patterns", () => {
  const registryKeys = TAG_REGISTRY.map((tag) => `${tag.dimension}:${tag.slug}`);
  assert.equal(new Set(registryKeys).size, registryKeys.length);
  for (const key of registryKeys) {
    assert.ok(Object.hasOwn(TAG_PATTERNS, key), `missing patterns for ${key}`);
  }
  for (const key of Object.keys(TAG_PATTERNS)) {
    assert.ok(registryKeys.includes(key), `orphan pattern ${key}`);
  }
});

test("teacher pattern still rejects поучительная", () => {
  const patterns = patternsForTag("occasion_tag", "den_uchitelya");
  assert.equal(patterns.some((pattern) => pattern.test("портрет учителя")), true);
  assert.equal(patterns.some((pattern) => pattern.test("атмосфера поучительная")), false);
});
