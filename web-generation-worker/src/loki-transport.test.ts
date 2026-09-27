import assert from "node:assert/strict";
import test from "node:test";
import {
  createLokiTransport,
  formatConsoleArgs,
  installConsoleLokiSink,
} from "./lib/loki-transport";

test("formatConsoleArgs keeps a json line and wraps text", () => {
  assert.equal(formatConsoleArgs(['{"event":"ping"}']), '{"event":"ping"}');
  assert.equal(formatConsoleArgs(["hello"]), '{"msg":"hello"}');
  assert.equal(formatConsoleArgs(["a", "b"]), '{"msg":"a b"}');
});

test("empty push url never calls fetch", async () => {
  let calls = 0;
  const transport = createLokiTransport({
    pushUrl: "  ",
    service: "landing",
    envLabel: "prod",
    instance: "test",
    schedule: false,
    fetchImpl: async () => {
      calls += 1;
      return new Response(null, { status: 204 });
    },
  });
  transport.push("hello", "info");
  await transport.flush();
  assert.equal(calls, 0);
  transport.stop();
});

test("flush posts one batch grouped by level with basic auth", async () => {
  const bodies: string[] = [];
  const auths: string[] = [];
  const transport = createLokiTransport({
    pushUrl: "http://127.0.0.1:3100/loki/api/v1/push",
    basicAuth: "loki:supersecret",
    service: "landing",
    envLabel: "prod",
    instance: "web-1",
    schedule: false,
    now: () => 1_700_000_000_000,
    fetchImpl: async (_url, init) => {
      bodies.push(String(init?.body));
      const headers = init?.headers as Record<string, string>;
      auths.push(headers.authorization);
      return new Response(null, { status: 204 });
    },
  });
  transport.push('{"event":"a"}', "info");
  transport.push('{"event":"b"}', "error");
  transport.setInstance("web-2");
  await transport.flush();
  transport.stop();

  assert.equal(bodies.length, 1);
  assert.equal(auths[0], `Basic ${Buffer.from("loki:supersecret").toString("base64")}`);
  const parsed = JSON.parse(bodies[0]) as {
    streams: { stream: { instance: string; level: string }; values: [string, string][] }[];
  };
  assert.equal(parsed.streams.length, 2);
  assert.equal(parsed.streams[0].stream.instance, "web-2");
  const stamps = parsed.streams.flatMap((stream) => stream.values.map((value) => value[0]));
  assert.equal(stamps[0] < stamps[1], true);
  assert.equal(transport.dropped(), 0);
});

test("failed push retries once, drops the buffer, and does not throw or leak the secret", async () => {
  let calls = 0;
  const errors: string[] = [];
  const transport = createLokiTransport({
    pushUrl: "http://logs.internal/loki/api/v1/push",
    basicAuth: "loki:supersecret",
    service: "landing",
    envLabel: "prod",
    instance: "web-1",
    schedule: false,
    now: () => 0,
    onError: (message) => errors.push(message),
    fetchImpl: async () => {
      calls += 1;
      throw new Error("down");
    },
  });
  transport.push("one", "info");
  transport.push("two", "info");
  await transport.flush();
  transport.stop();
  assert.equal(calls, 2);
  assert.equal(transport.dropped(), 2);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].includes("supersecret"), false);
  assert.equal(errors[0].includes("logs.internal"), true);
});

test("console sink forwards a json line once", async () => {
  const lines: string[] = [];
  const transport = createLokiTransport({
    pushUrl: "http://127.0.0.1:3100/loki/api/v1/push",
    service: "landing",
    envLabel: "prod",
    instance: "web-1",
    schedule: false,
    fetchImpl: async (_url, init) => {
      lines.push(String(init?.body));
      return new Response(null, { status: 204 });
    },
  });
  const restore = installConsoleLokiSink(transport);
  try {
    console.info(JSON.stringify({ event: "process_start" }));
    await transport.flush();
  } finally {
    restore();
    transport.stop();
  }
  assert.equal(lines.length, 1);
  assert.equal(JSON.parse(lines[0]).streams[0].values[0][1], '{"event":"process_start"}');
});
