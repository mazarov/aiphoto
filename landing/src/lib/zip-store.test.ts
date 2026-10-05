import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildStoreZip, crc32, dosDateTime } from "./zip-store";

test("crc32 matches the reference value for 'hello'", () => {
  assert.equal(crc32(new TextEncoder().encode("hello")), 0x3610a686);
  assert.equal(crc32(new Uint8Array(0)), 0);
});

test("dosDateTime packs year/month/day and 2-second time", () => {
  const { time, date } = dosDateTime(new Date(2026, 9, 5, 13, 7, 31));
  assert.equal(date, ((2026 - 1980) << 9) | (10 << 5) | 5);
  assert.equal(time, (13 << 11) | (7 << 5) | 15);
});

test("buildStoreZip writes local headers, central directory and EOCD in order", () => {
  const a = new TextEncoder().encode("AAAA");
  const b = new TextEncoder().encode("bb");
  const zip = buildStoreZip([
    { name: "sticker-01.png", data: a },
    { name: "sticker-02.png", data: b },
  ]);
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);

  assert.equal(view.getUint32(0, true), 0x04034b50);
  assert.equal(view.getUint32(18, true), 4);
  assert.equal(view.getUint16(26, true), "sticker-01.png".length);
  const secondLocal = 30 + "sticker-01.png".length + 4;
  assert.equal(view.getUint32(secondLocal, true), 0x04034b50);
  assert.equal(view.getUint32(secondLocal + 14, true), crc32(b));

  const centralOffset = secondLocal + 30 + "sticker-02.png".length + 2;
  assert.equal(view.getUint32(centralOffset, true), 0x02014b50);
  assert.equal(view.getUint32(centralOffset + 42, true), 0);
  const secondCentral = centralOffset + 46 + "sticker-01.png".length;
  assert.equal(view.getUint32(secondCentral + 42, true), secondLocal);

  const eocd = zip.length - 22;
  assert.equal(view.getUint32(eocd, true), 0x06054b50);
  assert.equal(view.getUint16(10 + eocd, true), 2);
  assert.equal(view.getUint32(16 + eocd, true), centralOffset);
  assert.equal(view.getUint32(12 + eocd, true), eocd - centralOffset);
});

test("buildStoreZip output is accepted by the system unzip", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "zip-store-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, "pack.zip");
  writeFileSync(
    file,
    buildStoreZip([
      { name: "sticker-01.png", data: new TextEncoder().encode("one") },
      { name: "sticker-16.png", data: new TextEncoder().encode("sixteen") },
    ]),
  );
  let listing: string;
  try {
    listing = execFileSync("unzip", ["-l", file], { encoding: "utf8" });
  } catch {
    t.skip("unzip not available");
    return;
  }
  assert.match(listing, /sticker-01\.png/);
  assert.match(listing, /sticker-16\.png/);
  execFileSync("unzip", ["-tq", file], { encoding: "utf8" });
});
