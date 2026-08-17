import assert from "node:assert/strict";
import test from "node:test";
import {
  createConcurrencyGate,
  createSingleFlight,
  createTtlLruCache,
} from "./visual-search-cache";

test("TTL LRU evicts expired and oldest entries", () => {
  const cache = createTtlLruCache<number>(2, 100);
  cache.set("a", 1, 0);
  cache.set("b", 2, 0);
  cache.set("c", 3, 0);
  assert.equal(cache.get("a", 10), undefined);
  assert.equal(cache.get("b", 10), 2);
  assert.equal(cache.get("c", 10), 3);
  assert.equal(cache.get("c", 200), undefined);
});

test("single-flight shares one in-flight factory", async () => {
  const flight = createSingleFlight<number>();
  let calls = 0;
  const task = () =>
    flight.run("q", async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return 7;
    });
  const [a, b] = await Promise.all([task(), task()]);
  assert.equal(a, 7);
  assert.equal(b, 7);
  assert.equal(calls, 1);
});

test("concurrency gate caps parallel work", async () => {
  const gate = createConcurrencyGate(1);
  let max = 0;
  let current = 0;
  await Promise.all(
    [1, 2, 3].map((n) =>
      gate.run(async () => {
        current += 1;
        max = Math.max(max, current);
        await new Promise((resolve) => setTimeout(resolve, 10));
        current -= 1;
        return n;
      }),
    ),
  );
  assert.equal(max, 1);
});
