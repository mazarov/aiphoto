import assert from "node:assert/strict";
import test from "node:test";
import {
  groupExampleCandidates,
  isStickerExampleUrl,
  parseStickerLandingExampleIds,
  pinnedExampleCandidates,
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

const ID_A = "419006e8-7386-45f0-bf08-750c9ef79237";
const ID_B = "6589a6e4-0917-4569-b5cc-4474cb7b6b7d";
const ID_C = "ac9ca279-7651-4693-9238-69b66d04b029";
const ID_D = "510b7553-91b6-41a4-842e-660597d2d5ed";

test("parseStickerLandingExampleIds keeps display order and drops junk", () => {
  assert.equal(parseStickerLandingExampleIds(null), null);
  assert.equal(parseStickerLandingExampleIds(""), null);
  assert.equal(parseStickerLandingExampleIds("not json"), null);
  assert.equal(parseStickerLandingExampleIds("[]"), null);
  const parsed = parseStickerLandingExampleIds(
    JSON.stringify({
      cartoon_telegram: [ID_A, "nope", ID_A, ID_B, ID_C, ID_D, "00000000-0000-0000-0000-000000000000"],
      "  ": [ID_A],
      empty: [],
    }),
  );
  // Four valid uuids would exceed the per-style cap of 3; the zero uuid is not a v1–v5 id.
  assert.deepEqual(parsed, { cartoon_telegram: [ID_A, ID_B, ID_C] });
});

test("pinnedExampleCandidates follows the pin order and skips urls outside the examples bucket", () => {
  const pins = { cartoon_telegram: [ID_A, ID_B], photo_realistic: [ID_C] };
  const rows = [
    { id: ID_B, public_url: ex("b") },
    { id: ID_A, public_url: ex("a") },
    { id: ID_C, public_url: `${ORIGIN}/storage/v1/object/public/stickers/c.png` },
  ];
  const pinned = pinnedExampleCandidates(pins, rows, ORIGIN);
  assert.deepEqual(pinned.get("cartoon_telegram"), [ex("a"), ex("b")]);
  assert.equal(pinned.has("photo_realistic"), false);
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
