import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { publicObjectUploadOptions } from "../../landing/src/lib/storage-cache-control";
import type { StickerBackgroundMode } from "../../landing/src/lib/sticker";
import {
  STICKER_PACK_CELL_PX,
  STICKER_PACK_COUNT,
  STICKER_PACK_GRID,
  STICKER_PACK_PREVIEW_PX,
  STICKER_PACK_SHEET_CELLS,
  STICKER_PACK_SHEET_COUNT,
  STICKER_PACK_UPSCALED_SHEET_PX,
  assembleStickerPackSheetPrompt,
  parseStickerPackPrompt,
  stickerPackCellBox,
  stickerPackSheetScenes,
  stickerPackStickerIndex,
  stickerPackTileStoragePath,
  type StickerPackPromptSpec,
} from "../../landing/src/lib/sticker-pack";
import { finalizeStickerPackCell, type StickerFinalizeStats } from "./sticker-finalize";
import { ProcessingError, RESULTS_BUCKET } from "./input-source";
import { errorFields, log } from "./lib/logger";

/** One provider sheet per pack. */
export const STICKER_PACK_SHEET_CONCURRENCY = STICKER_PACK_SHEET_COUNT;

export type StickerPackSheetRunner = (input: { prompt: string; sheetIndex: number }) => Promise<Buffer>;

export type StickerPackJobLike = {
  id: string;
  user_id: string;
  lease_token: string;
  prompt_text: string | null;
};

export type StickerPackStats = {
  sheetMs: number;
  splitMs: number;
  finalizeMs: number;
  previewMs: number;
  uploadMs: number;
  /** `alpha_native` / `chroma` / `rembg` … → count of cells that took that route. */
  routes: Record<string, number>;
  rembgMs: number;
  bytesOut: number;
  previewBytes: number;
};

export type StickerPackResult = {
  /** 4×4 preview PNG — `result_storage_path`. */
  resultPath: string;
  /** 16 × 512 PNG — `photoshoot_tile_paths`, pack order. */
  tilePaths: string[];
  stats: StickerPackStats;
};

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

/** Scale the 1024 provider sheet up to 1512 so a 4×4 cut yields 378 px cells. */
export async function upscaleStickerPackSheet(
  sheet: Buffer,
  target = STICKER_PACK_UPSCALED_SHEET_PX,
): Promise<Buffer> {
  return sharp(sheet, { failOn: "none" })
    .ensureAlpha()
    .resize(target, target, { fit: "fill", kernel: "lanczos3" })
    .png()
    .toBuffer();
}

/** One 4×4 sheet → 16 PNG cells (row-major). Non-square sheets split by their own width/height. */
export async function splitStickerPackSheet(sheet: Buffer): Promise<{ cells: Buffer[]; width: number; height: number }> {
  const meta = await sharp(sheet, { failOn: "none" }).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width < STICKER_PACK_SHEET_CELLS || height < STICKER_PACK_SHEET_CELLS) {
    throw new ProcessingError("provider_error", `Sticker pack sheet is too small: ${width}x${height}`, false);
  }
  const cells: Buffer[] = [];
  for (let i = 0; i < STICKER_PACK_SHEET_CELLS; i += 1) {
    const box = stickerPackCellBox(i, STICKER_PACK_SHEET_CELLS, width, height);
    if (!box) throw new ProcessingError("provider_error", "Sticker pack cell box is empty", false);
    cells.push(
      await sharp(sheet, { failOn: "none" })
        .ensureAlpha()
        .extract(box)
        .png({ compressionLevel: 3 })
        .toBuffer(),
    );
  }
  return { cells, width, height };
}

/** 4×4 contact sheet of the finished stickers on a transparent canvas; the list thumbnail. */
export async function composeStickerPackPreview(
  tiles: readonly Buffer[],
  previewPx = STICKER_PACK_PREVIEW_PX,
): Promise<Buffer> {
  if (tiles.length !== STICKER_PACK_COUNT) {
    throw new ProcessingError("provider_error", `Sticker pack preview needs ${STICKER_PACK_COUNT} tiles`, false);
  }
  const cellPx = Math.floor(previewPx / STICKER_PACK_GRID);
  const composites = await Promise.all(
    tiles.map(async (tile, index) => {
      const box = stickerPackCellBox(index, STICKER_PACK_COUNT, previewPx);
      if (!box) throw new ProcessingError("provider_error", "Sticker pack preview cell is empty", false);
      const input = await sharp(tile, { failOn: "none" })
        .ensureAlpha()
        .resize(cellPx, cellPx, { fit: "inside", background: TRANSPARENT })
        .png()
        .toBuffer();
      return { input, left: box.left, top: box.top };
    }),
  );
  return sharp({
    create: { width: cellPx * STICKER_PACK_GRID, height: cellPx * STICKER_PACK_GRID, channels: 4, background: TRANSPARENT },
  })
    .composite(composites)
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();
}

export function stickerPackPreviewPath(job: Pick<StickerPackJobLike, "id" | "user_id" | "lease_token">): string {
  return `${job.user_id}/${job.id}/${job.lease_token}.png`;
}

export function requireStickerPackPrompt(promptText: string | null | undefined): StickerPackPromptSpec {
  const spec = parseStickerPackPrompt(promptText);
  if (!spec) {
    throw new ProcessingError("input_missing", "Sticker pack prompt is malformed (marker / 16 scenes)", false);
  }
  return spec;
}

async function mapLimited<T, R>(items: readonly T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const run = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      out[index] = await fn(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, run));
  return out;
}

function storageTemporary(error: unknown): boolean {
  const raw = error as { status?: number; statusCode?: number | string; message?: string } | null;
  const status = Number(raw?.status ?? raw?.statusCode);
  if (status === 429 || (status >= 500 && status <= 599)) return true;
  return /timeout|timed out|network|fetch failed|econn|enotfound|socket/i.test(String(raw?.message || ""));
}

/**
 * Sticker pack job: one GPT Image sheet (4×4, 1024 px, transparent) → scale to 1512 →
 * 16 cells of 378 px (safe margin, no outline). No chroma key and no rembg.
 * The provider call is injected so this module stays free of OpenRouter / Gemini plumbing.
 */
export async function processStickerPack(input: {
  supabase: SupabaseClient;
  job: StickerPackJobLike;
  signal: AbortSignal;
  context: Record<string, unknown>;
  mode: StickerBackgroundMode;
  runSheet: StickerPackSheetRunner;
  ensureLease: () => Promise<void>;
  concurrency?: number;
}): Promise<StickerPackResult> {
  const spec = requireStickerPackPrompt(input.job.prompt_text);
  const sheetPrompts = Array.from({ length: STICKER_PACK_SHEET_COUNT }, (_, sheetIndex) =>
    assembleStickerPackSheetPrompt({
      stylePrompt: spec.stylePrompt,
      scenes: stickerPackSheetScenes(spec.scenes, sheetIndex),
      mode: input.mode,
    }),
  );
  log("info", "sticker_pack_started", {
    ...input.context,
    styleId: spec.styleId,
    setId: spec.setId,
    sheets: STICKER_PACK_SHEET_COUNT,
    mode: input.mode,
    promptLength: sheetPrompts[0]?.length ?? 0,
  });

  const sheetsStarted = Date.now();
  const sheets = await mapLimited(sheetPrompts, input.concurrency ?? STICKER_PACK_SHEET_CONCURRENCY, async (prompt, sheetIndex) => {
    const started = Date.now();
    const buffer = await input.runSheet({ prompt, sheetIndex });
    log("info", "sticker_pack_sheet_ok", { ...input.context, sheetIndex, bytes: buffer.length, durationMs: Date.now() - started });
    return buffer;
  });
  const sheetMs = Date.now() - sheetsStarted;
  await input.ensureLease();

  const tiles: Buffer[] = new Array(STICKER_PACK_COUNT);
  const routes: Record<string, number> = {};
  let splitMs = 0;
  let finalizeMs = 0;
  let rembgMs = 0;
  let bytesOut = 0;
  for (let sheetIndex = 0; sheetIndex < sheets.length; sheetIndex += 1) {
    const splitStarted = Date.now();
    const scaled = await upscaleStickerPackSheet(sheets[sheetIndex]);
    const split = await splitStickerPackSheet(scaled);
    splitMs += Date.now() - splitStarted;
    for (let cellIndex = 0; cellIndex < split.cells.length; cellIndex += 1) {
      const finalizeStarted = Date.now();
      const encoded = await finalizeStickerPackCell(split.cells[cellIndex], {
        signal: input.signal,
        outputPx: STICKER_PACK_CELL_PX,
      });
      finalizeMs += Date.now() - finalizeStarted;
      const stats: StickerFinalizeStats = encoded.sticker;
      routes[stats.route] = (routes[stats.route] ?? 0) + 1;
      rembgMs += stats.rembgMs;
      bytesOut += encoded.bytesOut;
      tiles[stickerPackStickerIndex(sheetIndex, cellIndex)] = encoded.buffer;
    }
    log("info", "sticker_pack_sheet_split", {
      ...input.context,
      sheetIndex,
      sheetWidth: split.width,
      sheetHeight: split.height,
    });
    await input.ensureLease();
  }
  if (tiles.some((tile) => !tile?.length)) {
    throw new ProcessingError("provider_error", "Sticker pack is missing cells after finalize", true);
  }

  const previewStarted = Date.now();
  const preview = await composeStickerPackPreview(tiles);
  const previewMs = Date.now() - previewStarted;

  const resultPath = stickerPackPreviewPath(input.job);
  const tilePaths = tiles.map((_, i) => stickerPackTileStoragePath(resultPath, i + 1));
  if (tilePaths.some((path) => !path)) {
    throw new ProcessingError("result_upload_error", "Sticker pack tile path is empty", false);
  }
  const uploadStarted = Date.now();
  const uploads: Array<{ path: string; buffer: Buffer }> = [
    ...tilePaths.map((path, i) => ({ path, buffer: tiles[i] })),
    { path: resultPath, buffer: preview },
  ];
  try {
    await mapLimited(uploads, 4, async (item) => {
      const { error } = await input.supabase.storage
        .from(RESULTS_BUCKET)
        .upload(item.path, item.buffer, publicObjectUploadOptions({ contentType: "image/png", upsert: true }));
      if (error) throw error;
    });
  } catch (error) {
    log("warn", "sticker_pack_upload_failed", { ...input.context, ...errorFields(error) });
    throw new ProcessingError(
      "result_upload_error",
      error instanceof Error ? error.message : String(error),
      storageTemporary(error),
    );
  }
  const uploadMs = Date.now() - uploadStarted;

  const stats: StickerPackStats = {
    sheetMs,
    splitMs,
    finalizeMs,
    previewMs,
    uploadMs,
    routes,
    rembgMs,
    bytesOut,
    previewBytes: preview.length,
  };
  log("info", "sticker_pack_finalized", { ...input.context, resultPath, tiles: tilePaths.length, ...stats });
  return { resultPath, tilePaths, stats };
}
