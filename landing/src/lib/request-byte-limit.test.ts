import assert from "node:assert/strict";
import test from "node:test";
import {
  PayloadTooLargeError,
  contentLengthExceeds,
  readBlobBytes,
  readLimitedResponseBytes,
  readRequestJson,
} from "./request-byte-limit";

function streamBytes(total: number, chunk = 16): ReadableStream<Uint8Array> {
  let sent = 0;
  return new ReadableStream({
    pull(controller) {
      if (sent >= total) {
        controller.close();
        return;
      }
      const size = Math.min(chunk, total - sent);
      controller.enqueue(new Uint8Array(size));
      sent += size;
    },
  });
}

test("declared Content-Length above the cap is rejected", () => {
  assert.equal(
    contentLengthExceeds(new Headers({ "content-length": "100" }), 40),
    true,
  );
  assert.equal(
    contentLengthExceeds(new Headers({ "content-length": "40" }), 40),
    false,
  );
});

test("a stream past the cap throws and stops", async () => {
  const response = new Response(streamBytes(80, 10), {
    headers: { "content-length": "80" },
  });
  await assert.rejects(
    () => readLimitedResponseBytes(response, 25),
    (error: unknown) => error instanceof PayloadTooLargeError,
  );
});

test("a stream without Content-Length still stops at the cap", async () => {
  const response = new Response(streamBytes(80, 10));
  await assert.rejects(
    () => readLimitedResponseBytes(response, 25),
    (error: unknown) => error instanceof PayloadTooLargeError,
  );
});

test("readRequestJson rejects an oversized body and invalid JSON", async () => {
  const oversized = new Request("https://promptshot.ru/api", {
    method: "POST",
    headers: { "content-length": "500", "content-type": "application/json" },
    body: "{}",
  });
  await assert.rejects(
    () => readRequestJson(oversized, 10),
    (error: unknown) => error instanceof PayloadTooLargeError,
  );

  const invalid = new Request("https://promptshot.ru/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "not-json",
  });
  await assert.rejects(
    () => readRequestJson(invalid, 100),
    (error: unknown) => error instanceof SyntaxError,
  );
});

test("readBlobBytes checks size before buffering", async () => {
  const blob = new Blob([new Uint8Array(30)]);
  await assert.rejects(
    () => readBlobBytes(blob, 10),
    (error: unknown) => error instanceof PayloadTooLargeError,
  );
  const small = await readBlobBytes(new Blob([new Uint8Array([1, 2, 3])]), 10);
  assert.equal(small.byteLength, 3);
});
