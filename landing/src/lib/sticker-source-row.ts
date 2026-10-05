import { isStickerEditKind } from "./sticker";
import { resolveStickerSourcePath } from "./sticker-pack";

/** Columns every sticker route needs to pick its source PNG. */
export const STICKER_SOURCE_ROW_COLUMNS =
  "status,modality,edit_kind,result_storage_bucket,result_storage_path,photoshoot_tile_paths";

export type StickerSourceRow = {
  status: string;
  modality: string | null;
  edit_kind: string | null;
  result_storage_bucket: string | null;
  result_storage_path: string | null;
  photoshoot_tile_paths?: unknown;
};

export type StickerSourceFailure = "not_ready" | "not_sticker" | "tile_required" | "tile_missing";

export type StickerSourceFile =
  | { ok: true; bucket: string; path: string; isPack: boolean; tile: number | null }
  | { ok: false; reason: StickerSourceFailure };

/**
 * Which stored PNG a sticker route (download / border / text) works on.
 * Single sticker → `result_storage_path`. Sticker pack → `photoshoot_tile_paths[tile - 1]`
 * (`tile` 1..16 mandatory: the pack's single slot is a 4×4 preview, not a sticker).
 */
export function resolveStickerSourceFile(row: StickerSourceRow, tile: unknown): StickerSourceFile {
  if (row.status !== "completed" || !row.result_storage_bucket || (row.modality || "image") !== "image") {
    return { ok: false, reason: "not_ready" };
  }
  const resolved = resolveStickerSourcePath({
    editKind: row.edit_kind,
    resultPath: row.result_storage_path,
    tilePaths: row.photoshoot_tile_paths,
    tile,
    isSingleSticker: isStickerEditKind,
  });
  if (!resolved.ok) return resolved;
  return { ok: true, bucket: row.result_storage_bucket, path: resolved.path, isPack: resolved.isPack, tile: resolved.tile };
}

/** Error code for the JSON body: a pack without a tile is a client bug, not a wrong row. */
export function stickerSourceErrorCode(reason: StickerSourceFailure): "pack_tile_required" | "not_a_sticker" {
  return reason === "tile_required" || reason === "tile_missing" ? "pack_tile_required" : "not_a_sticker";
}

/** User-facing message; `fallback` is the route's own «только для готового стикера» line. */
export function stickerSourceErrorMessage(reason: StickerSourceFailure, fallback: string): string {
  switch (reason) {
    case "tile_required":
      return "Выберите стикер из пака";
    case "tile_missing":
      return "Этот стикер пака недоступен";
    default:
      return fallback;
  }
}
