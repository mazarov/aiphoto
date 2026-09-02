import { isPhotoshootEditKind, resolvePhotoshootUserFacingResult } from "./photoshoot";

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
  const facing = resolvePhotoshootUserFacingResult({
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
  return {
    resultUrl: input.toPublicUrl(bucket, facing.resultPath),
    resultThumbUrl: video ? null : input.toListingUrl(bucket, facing.resultPath),
    photoshootTileUrls: tiles
      ? tiles.map((path) => input.toPublicUrl(bucket, path))
      : null,
    photoshootTileThumbUrls: tiles
      ? tiles.map((path) => input.toListingUrl(bucket, path))
      : null,
    photoshootSheetUrl: sheetUrl,
    photoshootSheetThumbUrl: sheetThumbUrl,
  };
}

export function generationGridDisplay(
  item: Pick<
    GenerationHistoryItem,
    | "resultUrl"
    | "resultThumbUrl"
    | "photoshootTileUrls"
    | "photoshootTileThumbUrls"
  >,
): {
  fullTiles: string[] | null;
  displayTiles: string[] | null;
  displaySrc: string | null;
} {
  const fullTiles =
    item.photoshootTileUrls?.length === 4 ? item.photoshootTileUrls : null;
  const displayTiles =
    item.photoshootTileThumbUrls?.length === 4
      ? item.photoshootTileThumbUrls
      : fullTiles;
  return {
    fullTiles,
    displayTiles,
    displaySrc: item.resultThumbUrl || item.resultUrl,
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
