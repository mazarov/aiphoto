import assert from "node:assert/strict";
import test from "node:test";
import {
  groupExampleCandidates,
  isStickerExampleUrl,
  resetStickerExamplesCache,
  validateExampleCandidates,
} from "./sticker-examples";

const ORIGIN = "https://abc.supabase.co";
const ex = (name: string) => `${ORIGIN}/storage/v1/object/public/stickers-examples/${name}.png`;

test("isStickerExampleUrl: only https URLs of the public examples bucket on our Supabase host", () => {
  assert.equal(isStickerExampleUrl(ex("a"), ORIGIN), true);
  assert.equal(isStickerExampleUrl(ex("a"), null), true);
  assert.equal(isStickerExampleUrl(`${ORIGIN}/storage/v1/object/public/stickers/a.png`, ORIGIN), false, "private bucket");
  assert.equal(isStickerExampleUrl("https://evil.example/storage/v1/object/public/stickers-examples/a.png", ORIGIN), false);
  assert.equal(isStickerExampleUrl(ex("a").replace("https:", "http:"), ORIGIN), false);
  assert.equal(isStickerExampleUrl("not a url", ORIGIN), false);
  assert.equal(isStickerExampleUrl(null, ORIGIN), false);
});

test("groupExampleCandidates: newest first, dedup, capped per style, junk rows skipped", () => {
  const rows = [
    { style_preset_id: "anime", public_url: ex("a1"), created_at: "2026-10-05" },
    { style_preset_id: "anime", public_url: ex("a1"), created_at: "2026-10-04" },
    { style_preset_id: "anime", public_url: ex("a2"), created_at: "2026-10-03" },
    { style_preset_id: "anime", public_url: ex("a3"), created_at: "2026-10-02" },
    { style_preset_id: "anime", public_url: ex("a4"), created_at: "2026-10-01" },
    { style_preset_id: "anime", public_url: ex("a5"), created_at: "2026-09-30" },
    { style_preset_id: "", public_url: ex("x"), created_at: null },
    { style_preset_id: "cartoon", public_url: null, created_at: null },
    { style_preset_id: "cartoon", public_url: "https://evil.example/c.png", created_at: null },
    { style_preset_id: "cartoon", public_url: ex("c1"), created_at: null },
  ];
  const grouped = groupExampleCandidates(rows, ORIGIN);
  assert.deepEqual(grouped.get("anime"), [ex("a1"), ex("a2"), ex("a3"), ex("a4")]);
  assert.deepEqual(grouped.get("cartoon"), [ex("c1")]);
  assert.equal(grouped.has(""), false);
});

test("validateExampleCandidates: HEAD-checks once per URL, drops 4xx and errors, keeps ≤ 3 live per style", async () => {
  resetStickerExamplesCache();
  const calls: string[] = [];
  const fetchStub = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push(String(url));
    assert.equal(init?.method, "HEAD");
    if (String(url).includes("dead")) return new Response(null, { status: 400 });
    if (String(url).includes("boom")) throw new Error("network");
    return new Response(null, { status: 200 });
  }) as unknown as typeof fetch;
  const candidates = new Map([
    ["anime", [ex("a1"), ex("dead1"), ex("a2"), ex("a3")]],
    ["cartoon", [ex("dead2"), ex("boom")]],
    ["shared", [ex("a1")]],
  ]);
  const validated = await validateExampleCandidates(candidates, fetchStub, 1_000);
  assert.deepEqual(validated.get("anime"), [ex("a1"), ex("a2"), ex("a3")]);
  assert.equal(validated.has("cartoon"), false, "no live examples → style omitted");
  assert.deepEqual(validated.get("shared"), [ex("a1")]);
  assert.equal(calls.length, 6, "a1 shared between styles is checked once");

  // Second pass within the URL-check TTL reuses verdicts: no new HEADs.
  const again = await validateExampleCandidates(candidates, fetchStub, 2_000);
  assert.equal(calls.length, 6);
  assert.deepEqual(again.get("anime"), [ex("a1"), ex("a2"), ex("a3")]);
  resetStickerExamplesCache();
});
