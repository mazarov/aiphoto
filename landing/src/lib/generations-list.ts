import {
  PHOTOSHOOT_FRAME_COUNT,
  isPhotoshootEditKind,
  resolvePhotoshootUserFacingResult,
  type PhotoshootUserFacingResult,
} from "./photoshoot";
import { isStickerEditKind } from "./sticker";
import { STICKER_PACK_COUNT, isStickerPackEditKind, resolveStickerPackUserFacingResult } from "./sticker-pack";

/**
 * How many sidecar tiles a completed job of this kind carries in `photoshoot_tile_paths`.
 * Photoshoot = 4 JPEG frames, sticker pack = 16 PNG stickers, anything else = none.
 * Every "is this a tiled result" check goes through here instead of a literal `=== 4`.
 */
export function expectedSidecarTileCount(editKind: string | null | undefined): number | null {
  if (isPhotoshootEditKind(editKind)) return PHOTOSHOOT_FRAME_COUNT;
  if (isStickerPackEditKind(editKind)) return STICKER_PACK_COUNT;
  return null;
}

/** Tile URLs from an API payload, or null unless the list is complete for this kind. */
export function sidecarTileUrls(editKind: string | null | undefined, raw: unknown): string[] | null {
  const expected = expectedSidecarTileCount(editKind);
  if (!expected || !Array.isArray(raw) || raw.length !== expected) return null;
  const urls = raw.map((item) => String(item ?? "").trim());
  return urls.some((url) => !url) ? null : urls;
}

/** 1-based tile number of `resultUrl` in the list, or null when it is not a tile (e.g. the pack preview). */
export function sidecarTileNumberForUrl(tileUrls: string[] | null, resultUrl: string | null): number | null {
  if (!tileUrls || !resultUrl) return null;
  const index = tileUrls.indexOf(resultUrl);
  return index < 0 ? null : index + 1;
}

/** Single-slot path + tiles for any completed job; pack and photoshoot share the same column. */
export function resolveGenerationUserFacingResult(input: {
  editKind?: string | null;
  sheetPath?: string | null;
  tilePaths?: unknown;
}): PhotoshootUserFacingResult {
  return (
    resolveStickerPackUserFacingResult({
      editKind: input.editKind,
      previewPath: input.sheetPath,
      tilePaths: input.tilePaths,
    }) ??
    resolvePhotoshootUserFacingResult({
      editKind: input.editKind,
      sheetPath: input.sheetPath,
      tilePaths: input.tilePaths,
    })
  );
}

export const GENERATIONS_PAGE_SIZE = 24;
export const GENERATIONS_API_MAX_LIMIT = 50;
export const GENERATIONS_GRID_PRIORITY_COUNT = 6;

export type GenerationHistoryItem = {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  prompt: string;
  model: string;
  aspectRatio: string;
  modality?: "image" | "video" | string;
  resultMimeType?: string | null;
  durationSeconds?: number | null;
  creditsSpent: number;
  createdAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  resultUrl: string | null;
  resultThumbUrl?: string | null;
  editKind?: string | null;
  photoshootTileUrls?: string[] | null;
  photoshootTileThumbUrls?: string[] | null;
  photoshootSheetUrl?: string | null;
  photoshootSheetThumbUrl?: string | null;
  cardId: string | null;
  cardSlug: string | null;
  isPublished: boolean;
};

export type GenerationListPage = {
  generations: GenerationHistoryItem[];
  hasMore: boolean;
  nextOffset: number | null;
};

export const GENERATION_LIST_COLUMNS =
  "id, status, prompt_text, model, aspect_ratio, credits_spent, created_at, generation_completed_at, error_message, result_storage_bucket, result_storage_path, ugc_card_id, modality, result_mime_type, duration_seconds, edit_kind, photoshoot_tile_paths";

export type GenerationListRow = {
  id: string;
  status: GenerationHistoryItem["status"] | string;
  prompt_text: string | null;
  model: string | null;
  aspect_ratio: string | null;
  credits_spent: number | null;
  created_at: string;
  generation_completed_at: string | null;
  error_message: string | null;
  result_storage_bucket: string | null;
  result_storage_path: string | null;
  ugc_card_id: string | null;
  modality: string | null;
  result_mime_type: string | null;
  duration_seconds: number | null;
  edit_kind: string | null;
  photoshoot_tile_paths: unknown;
};

export function isUnknownGenerationsListRpc(error: {
  message?: string | null;
  code?: string | null;
}): boolean {
  if (error.code === "PGRST202" || error.code === "42883") return true;
  return /landing_list_my_generations|schema cache|could not find the function/i.test(
    error.message ?? "",
  );
}

function isVideoGenerationMedia(input: {
  modality?: string | null;
  resultMimeType?: string | null;
}): boolean {
  return input.modality === "video" || input.resultMimeType === "video/mp4";
}

export function buildGenerationResultMedia(input: {
  bucket: string | null;
  editKind: string | null;
  sheetPath: string | null;
  tilePaths: unknown;
  modality?: string | null;
  resultMimeType?: string | null;
  toPublicUrl: (bucket: string, path: string) => string;
  toListingUrl: (bucket: string, path: string) => string;
}): Pick<
  GenerationHistoryItem,
  | "resultUrl"
  | "resultThumbUrl"
  | "photoshootTileUrls"
  | "photoshootTileThumbUrls"
  | "photoshootSheetUrl"
  | "photoshootSheetThumbUrl"
> {
  const bucket = input.bucket?.trim() || null;
  const sheetPath = input.sheetPath?.trim() || null;
  // Sticker pack: preview PNG in the single slot, the 16 stickers as tiles (same column as photoshoot).
  const facing = resolveGenerationUserFacingResult({
    editKind: input.editKind,
    sheetPath,
    tilePaths: input.tilePaths,
  });
  const photoshoot = isPhotoshootEditKind(input.editKind);
  const sheetUrl =
    bucket && photoshoot && sheetPath ? input.toPublicUrl(bucket, sheetPath) : null;
  const sheetThumbUrl =
    bucket && photoshoot && sheetPath ? input.toListingUrl(bucket, sheetPath) : null;
  if (!bucket || !facing.resultPath) {
    return {
      resultUrl: null,
      resultThumbUrl: null,
      photoshootTileUrls: null,
      photoshootTileThumbUrls: null,
      photoshootSheetUrl: sheetUrl,
      photoshootSheetThumbUrl: sheetThumbUrl,
    };
  }
  const tiles = facing.tilePaths;
  const video = isVideoGenerationMedia(input);
  // Listing thumbs are JPEG via imgproxy. A sticker PNG is already 512px and
  // its alpha must stay; a JPEG thumb mattes the transparent pixels black.
  const keepOriginal = video || isStickerEditKind(input.editKind) || isStickerPackEditKind(input.editKind);
  return {
    resultUrl: input.toPublicUrl(bucket, facing.resultPath),
    resultThumbUrl: keepOriginal ? null : input.toListingUrl(bucket, facing.resultPath),
    photoshootTileUrls: tiles
      ? tiles.map((path) => input.toPublicUrl(bucket, path))
      : null,
    // Pack stickers are 512 PNG with alpha — serve them as-is instead of a JPEG thumb.
    photoshootTileThumbUrls: tiles
      ? tiles.map((path) => (keepOriginal ? input.toPublicUrl(bucket, path) : input.toListingUrl(bucket, path)))
      : null,
    photoshootSheetUrl: sheetUrl,
    photoshootSheetThumbUrl: sheetThumbUrl,
  };
}

/** Masonry card ratio. Stickers and packs are always 1:1; other jobs use stored `W:H`, else 3:4. */
export function generationListingAspectRatio(
  aspectRatio: string | null | undefined,
  editKind?: string | null,
): number {
  if (isStickerEditKind(editKind) || isStickerPackEditKind(editKind)) return 1;
  const match = /^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/.exec((aspectRatio ?? "").trim());
  if (!match) return 3 / 4;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!(width > 0) || !(height > 0)) return 3 / 4;
  return width / height;
}

export function generationGridDisplay(
  item: Pick<
    GenerationHistoryItem,
    | "resultUrl"
    | "resultThumbUrl"
    | "editKind"
    | "photoshootTileUrls"
    | "photoshootTileThumbUrls"
  >,
): {
  fullTiles: string[] | null;
  displayTiles: string[] | null;
  displaySrc: string | null;
  /** Grid side: 2 for a photoshoot, 4 for a sticker pack, null without tiles. */
  gridColumns: 2 | 4 | null;
} {
  const fullTiles = sidecarTileUrls(item.editKind, item.photoshootTileUrls);
  const displayTiles = sidecarTileUrls(item.editKind, item.photoshootTileThumbUrls) ?? fullTiles;
  const gridColumns: 2 | 4 | null = !fullTiles ? null : fullTiles.length === STICKER_PACK_COUNT ? 4 : 2;
  return {
    fullTiles,
    displayTiles,
    displaySrc: item.resultThumbUrl || item.resultUrl,
    gridColumns,
  };
}

export function takeGenerationPage<T>(
  rows: readonly T[],
  limit: number,
): { page: T[]; hasMore: boolean } {
  if (limit <= 0) return { page: [], hasMore: false };
  return {
    page: rows.slice(0, limit),
    hasMore: rows.length > limit,
  };
}

export function mergeGenerationFirstPage<T extends { id: string }>(
  previous: readonly T[],
  fresh: readonly T[],
): T[] {
  const freshIds = new Set(fresh.map((item) => item.id));
  return [...fresh, ...previous.filter((item) => !freshIds.has(item.id))];
}
