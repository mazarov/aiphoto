import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  composeStickerPackPreview,
  processStickerPack,
  requireStickerPackPrompt,
  splitStickerPackSheet,
  stickerPackPreviewPath,
} from "./sticker-pack-generation";
import { buildStickerPackPromptText } from "../../landing/src/lib/sticker-pack";

const SCENES = Array.from({ length: 16 }, (_, i) => `{subject} pose ${i + 1}`);
const PROMPT = buildStickerPackPromptText({ styleId: "cartoon", setId: "office", stylePrompt: "Cartoon.", scenes: SCENES });

/** 2×2 sheet with a transparent background and a distinct solid blob in each cell. */
async function transparentSheet(px = 256): Promise<Buffer> {
  const half = px / 2;
  const colors = ["#ff0000", "#00ff00", "#0000ff", "#ffff00"];
  const rects = colors
    .map((fill, i) => {
      const x = (i % 2) * half + half * 0.3;
      const y = Math.floor(i / 2) * half + half * 0.3;
      return `<rect x="${x}" y="${y}" width="${half * 0.4}" height="${half * 0.4}" fill="${fill}"/>`;
    })
    .join("");
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}">${rects}</svg>`);
  return sharp(svg).png().toBuffer();
}

async function pixelAt(png: Buffer, x: number, y: number): Promise<[number, number, number, number]> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const o = (y * info.width + x) * 4;
  return [data[o], data[o + 1], data[o + 2], data[o + 3]];
}

test("splitStickerPackSheet cuts a 2×2 sheet into 4 cells at the midlines", async () => {
  const sheet = await transparentSheet(256);
  const split = await splitStickerPackSheet(sheet);
  assert.equal(split.width, 256);
  assert.equal(split.cells.length, 4);
  for (const cell of split.cells) {
    const meta = await sharp(cell).metadata();
    assert.equal(meta.width, 128);
    assert.equal(meta.height, 128);
  }
  // Cell 1 (top-right) holds the green blob; cell 2 (bottom-left) the blue one.
  const green = await pixelAt(split.cells[1], 64, 64);
  const blue = await pixelAt(split.cells[2], 64, 64);
  assert.deepEqual(green.slice(0, 3), [0, 255, 0]);
  assert.deepEqual(blue.slice(0, 3), [0, 0, 255]);
  // Corners stay transparent.
  assert.equal((await pixelAt(split.cells[0], 2, 2))[3], 0);
});

test("composeStickerPackPreview lays 16 tiles on a transparent 4×4 canvas", async () => {
  const tile = await sharp({ create: { width: 64, height: 64, channels: 4, background: { r: 10, g: 20, b: 30, alpha: 255 } } })
    .png()
    .toBuffer();
  const preview = await composeStickerPackPreview(Array.from({ length: 16 }, () => tile), 256);
  const meta = await sharp(preview).metadata();
  assert.equal(meta.width, 256);
  assert.equal(meta.height, 256);
  assert.equal(meta.channels, 4);
  assert.deepEqual(await pixelAt(preview, 32, 32), [10, 20, 30, 255]);
  await assert.rejects(() => composeStickerPackPreview([tile], 256));
});

test("requireStickerPackPrompt rejects a single-sticker prompt", () => {
  assert.equal(requireStickerPackPrompt(PROMPT).scenes.length, 16);
  assert.throws(() => requireStickerPackPrompt("STICKER style=cartoon\nCartoon."), /input_missing|malformed/);
  assert.equal(stickerPackPreviewPath({ id: "j", user_id: "u", lease_token: "l" }), "u/j/l.png");
});

test("processStickerPack: 4 sheets → 16 × 512 PNG sidecars + preview, uploaded under the lease stem", async () => {
  const uploads = new Map<string, Buffer>();
  const supabase = {
    storage: {
      from: () => ({
        upload: async (path: string, buffer: Buffer) => {
          uploads.set(path, buffer);
          return { error: null };
        },
      }),
    },
  } as unknown as Parameters<typeof processStickerPack>[0]["supabase"];
  const prompts: string[] = [];
  const sheet = await transparentSheet(256);
  const result = await processStickerPack({
    supabase,
    job: { id: "job", user_id: "user", lease_token: "lease", prompt_text: PROMPT },
    signal: new AbortController().signal,
    context: { generationId: "job" },
    mode: "transparent",
    rembgUrl: "http://rembg.invalid",
    ensureLease: async () => undefined,
    runSheet: async ({ prompt, sheetIndex }) => {
      prompts[sheetIndex] = prompt;
      return sheet;
    },
  });
  assert.equal(result.resultPath, "user/job/lease.png");
  assert.equal(result.tilePaths.length, 16);
  assert.equal(result.tilePaths[0], "user/job/lease-01.png");
  assert.equal(result.tilePaths[15], "user/job/lease-16.png");
  assert.equal(uploads.size, 17);
  const first = uploads.get("user/job/lease-01.png")!;
  const meta = await sharp(first).metadata();
  assert.equal(meta.width, 512);
  assert.equal(meta.height, 512);
  assert.equal(meta.format, "png");
  assert.equal(prompts.length, 4);
  assert.match(prompts[0], /1\. the person pose 1/);
  assert.match(prompts[3], /4\. the person pose 16/);
  assert.equal(result.stats.routes.alpha_native, 16);
  assert.equal(result.stats.rembgMs, 0);
});
