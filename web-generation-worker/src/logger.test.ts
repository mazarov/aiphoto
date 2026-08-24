import assert from "node:assert/strict";
import test from "node:test";
import { configureLogger, log } from "./lib/logger";

test("log lines always include configured workerId", () => {
  configureLogger({ workerId: "replica-a:1:abcd" });
  const lines: string[] = [];
  const original = console.log;
  console.log = (message: unknown) => {
    lines.push(String(message));
  };
  try {
    log("info", "generations_claimed", { workerId: "stale", count: 2 });
  } finally {
    console.log = original;
  }

  assert.equal(lines.length, 1);
  const parsed = JSON.parse(lines[0]) as Record<string, unknown>;
  assert.equal(parsed.service, "web-generation-worker");
  assert.equal(parsed.event, "generations_claimed");
  assert.equal(parsed.count, 2);
  assert.equal(parsed.workerId, "replica-a:1:abcd");
});
