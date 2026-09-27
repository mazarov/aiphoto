import assert from "node:assert/strict";
import test from "node:test";
import { logProductSnapshot, snapshotLogLine } from "./ops-snapshot";

test("snapshotLogLine keeps event name even if the payload has one", () => {
  const line = JSON.parse(snapshotLogLine({ event: "other", registrations_1h: 3 })) as {
    event: string;
    registrations_1h: number;
    service: string;
  };
  assert.equal(line.event, "product_snapshot");
  assert.equal(line.service, "landing");
  assert.equal(line.registrations_1h, 3);
});

test("logProductSnapshot writes the rpc payload", async () => {
  const lines: string[] = [];
  const original = console.info;
  console.info = (message?: unknown) => {
    lines.push(String(message));
  };
  try {
    await logProductSnapshot({
      rpc: async () => ({ data: { registrations_1h: 2, alert_queue_stuck: 0 }, error: null }),
    });
  } finally {
    console.info = original;
  }
  const parsed = JSON.parse(lines[0]) as { event: string; registrations_1h: number };
  assert.equal(parsed.event, "product_snapshot");
  assert.equal(parsed.registrations_1h, 2);
});
