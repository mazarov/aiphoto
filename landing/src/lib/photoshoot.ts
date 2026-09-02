import { PHOTOSHOOT_PLANNER_TEMPERATURE } from "./photoshoot-planner";

export const PHOTOSHOOT_EDIT_KIND = "photoshoot";
export const PHOTOSHOOT_DEFAULT_MODEL = "gemini-3-pro-image-preview";
/** One-hop I2I after photoshoot_model fail. Kill-switch: empty `photoshoot_fallback_model`. */
export const PHOTOSHOOT_FALLBACK_DEFAULT_MODEL = "flux-2-flex";
/** BFL 0–5. Photoshoot Flux (primary or fallback) uses the most permissive value. */
export const PHOTOSHOOT_FLUX_SAFETY_TOLERANCE = 5;
export const PHOTOSHOOT_IMAGE_SIZE = "2K";
export const PHOTOSHOOT_FRAME_COUNT = 4;
/** Product price for one photoshoot job. Independent of photoshoot_model picker cost. */
export const PHOTOSHOOT_CREDIT_COST = 15;
export const PHOTOSHOOT_CTA_LABEL = "ИИ фотосессия";
export const PHOTOSHOOT_CTA_DETAIL = `${PHOTOSHOOT_FRAME_COUNT} фото`;
export const PHOTOSHOOT_ENQUEUE_INSTRUCTION = "PHOTOSHOOT";

export function photoshootCtaDetail(): string {
  return PHOTOSHOOT_CTA_DETAIL;
}

/**
 * Overlay chrome stays usable while a photoshoot job is in flight.
 * Exit always closes (job keeps running).
 * Create is the progress surface — no second enqueue until the job settles.
 */
export function photoshootOverlayChromeState(input: {
  capturing: boolean;
  starting: boolean;
}): {
  exitDisabled: false;
  createDisabled: boolean;
  createIsProgress: boolean;
} {
  const inFlight = input.capturing || input.starting;
  return {
    exitDisabled: false,
    createDisabled: inFlight,
    createIsProgress: inFlight,
  };
}

export type PhotoshootShot = {
  i: number;
  pose: string;
  motion: string;
  lens: string;
};

export type PhotoshootPlan = {
  theme: string;
  shots: PhotoshootShot[];
};

export type PhotoshootTileIndex = 1 | 2 | 3 | 4;

/** CSS object-position for 2x2 tiles: TL, TR, BL, BR. */
export const PHOTOSHOOT_TILE_OBJECT_POSITION: Record<PhotoshootTileIndex, string> = {
  1: "0% 0%",
  2: "100% 0%",
  3: "0% 100%",
  4: "100% 100%",
};

export const PHOTOSHOOT_TILE_INDEXES: PhotoshootTileIndex[] = [1, 2, 3, 4];

export const PHOTOSHOOT_SHEET_ASPECTS = ["1:1", "16:9", "9:16"] as const;
export type PhotoshootSheetAspect = (typeof PHOTOSHOOT_SHEET_ASPECTS)[number];

const LANDSCAPE_RATIO_MIN = 1.25;
const PORTRAIT_RATIO_MAX = 0.8;

function parseColonRatio(value: string): number | null {
  const match = String(value || "")
    .trim()
    .match(/^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }
  return width / height;
}

export function snapPhotoshootSheetAspectFromRatio(ratio: number): PhotoshootSheetAspect {
  if (!Number.isFinite(ratio) || ratio <= 0) return "1:1";
  if (ratio >= LANDSCAPE_RATIO_MIN) return "16:9";
  if (ratio <= PORTRAIT_RATIO_MAX) return "9:16";
  return "1:1";
}

/** Snap source format to the three sheet canvases. 4:3/3:2 → 16:9, 3:4/2:3 → 9:16. */
export function resolvePhotoshootSheetAspect(input: {
  aspectRatio?: string | null;
  width?: number;
  height?: number;
}): PhotoshootSheetAspect {
  const named = String(input.aspectRatio || "").trim();
  if ((PHOTOSHOOT_SHEET_ASPECTS as readonly string[]).includes(named)) {
    return named as PhotoshootSheetAspect;
  }
  const fromLabel = parseColonRatio(named);
  if (fromLabel) return snapPhotoshootSheetAspectFromRatio(fromLabel);
  const width = Number(input.width);
  const height = Number(input.height);
  if (width > 0 && height > 0) return snapPhotoshootSheetAspectFromRatio(width / height);
  return "1:1";
}

export function photoshootCanvasConstraint(aspect: PhotoshootSheetAspect): string {
  return [
    `Canvas ${aspect}: ONE 2x2 sheet in ${aspect}.`,
    `Each panel is also ${aspect} and shares edges with its neighbors.`,
    "Do not letterbox. Do not draw gutters, white lines, frames, or a grid between panels.",
  ].join(" ");
}

/** Shared by Gemini / Grok / Seedream sheet assemblers. */
export const PHOTOSHOOT_FLUSH_PANELS_RULE =
  "The four photographs sit flush: shared edges, no gap, no gutter, no white seam, no panel border. If a bright line divides the frames, you FAILED.";

/** Sidecar path next to the sheet: `user/job/lease.jpg` → `user/job/lease-1.jpg`. */
export function photoshootTileStoragePath(
  resultPath: string,
  tile: PhotoshootTileIndex,
): string {
  const path = String(resultPath || "").trim();
  if (!path) return "";
  const slash = path.lastIndexOf("/");
  const file = slash >= 0 ? path.slice(slash + 1) : path;
  const dir = slash >= 0 ? path.slice(0, slash + 1) : "";
  const dot = file.lastIndexOf(".");
  const stem = dot > 0 ? file.slice(0, dot) : file;
  if (!stem) return "";
  return `${dir}${stem}-${tile}.jpg`;
}

export function parsePhotoshootTilePaths(raw: unknown): string[] | null {
  const value = coercePhotoshootTilePathList(raw);
  if (!Array.isArray(value) || value.length !== PHOTOSHOOT_FRAME_COUNT) return null;
  const paths = value.map((item) => String(item ?? "").trim());
  if (paths.some((path) => !path)) return null;
  return paths;
}

/** PostgREST usually sends text[] as JSON; some RPC paths return `{a,b,c,d}`. */
function coercePhotoshootTilePathList(raw: unknown): unknown {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== "string") return raw;
  const trimmed = raw.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return raw;
    }
  }
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed
      .slice(1, -1)
      .split(",")
      .map((part) => part.trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1"));
  }
  return raw;
}

/**
 * Reconstruct sidecar tiles from the internal sheet path.
 * Worker uploads `lease-1.jpg`… before complete; `photoshoot_tile_paths` is a
 * later denormalized write and can lag or fail.
 */
export function derivePhotoshootTilePaths(sheetPath?: string | null): string[] | null {
  const path = String(sheetPath || "").trim();
  if (!path) return null;
  const tiles = PHOTOSHOOT_TILE_INDEXES.map((tile) => photoshootTileStoragePath(path, tile));
  if (tiles.some((item) => !item)) return null;
  return tiles;
}

export function photoshootTilePathsForJob(input: {
  tilePaths?: unknown;
  sheetPath?: string | null;
}): string[] | null {
  return parsePhotoshootTilePaths(input.tilePaths) ?? derivePhotoshootTilePaths(input.sheetPath);
}

export function parsePhotoshootTileIndex(raw: unknown): PhotoshootTileIndex | null {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > PHOTOSHOOT_FRAME_COUNT) return null;
  return value as PhotoshootTileIndex;
}

export function photoshootTileIndexForUrl(
  tileUrls: string[] | null,
  resultUrl: string | null,
): PhotoshootTileIndex {
  if (!tileUrls || !resultUrl) return 1;
  const index = tileUrls.indexOf(resultUrl);
  if (index < 0) return 1;
  return (index + 1) as PhotoshootTileIndex;
}

/** I2I/video source for a photoshoot parent: selected tile, else tile 1. Never the sheet. */
export function resolvePhotoshootParentSourcePath(input: {
  editKind?: string | null;
  sheetPath?: string | null;
  tilePaths?: unknown;
  requestedPath?: string | null;
  tileIndex?: unknown;
}): string | null {
  const sheetPath = String(input.sheetPath || "").trim() || null;
  if (!isPhotoshootEditKind(input.editKind)) return sheetPath;
  const tiles = photoshootTilePathsForJob({
    tilePaths: input.tilePaths,
    sheetPath,
  });
  if (!tiles) return null;
  const requested = String(input.requestedPath || "").trim();
  if (requested && tiles.includes(requested)) return requested;
  const index = parsePhotoshootTileIndex(input.tileIndex);
  if (index) return tiles[index - 1] || tiles[0];
  return tiles[0];
}

export type PhotoshootUserFacingResult = {
  /** Single-image slot for history / share. Never the 2×2 sheet. */
  resultPath: string | null;
  tilePaths: string[] | null;
};

/**
 * User-facing files for a completed job. The contact sheet stays internal
 * (`result_storage_path`) for split/re-cut; clients only get the four tiles.
 */
export function resolvePhotoshootUserFacingResult(input: {
  editKind?: string | null;
  sheetPath?: string | null;
  tilePaths?: unknown;
}): PhotoshootUserFacingResult {
  const sheetPath = String(input.sheetPath || "").trim();
  if (isPhotoshootEditKind(input.editKind)) {
    const tiles = photoshootTilePathsForJob({
      tilePaths: input.tilePaths,
      sheetPath,
    });
    return {
      resultPath: tiles?.[0] ?? null,
      tilePaths: tiles,
    };
  }
  return {
    resultPath: sheetPath || null,
    tilePaths: parsePhotoshootTilePaths(input.tilePaths),
  };
}

/** Media objects for one UGC card. Photoshoot = all 4 tiles, never the sheet. */
export function photoshootUserFacingMediaPaths(
  facing: PhotoshootUserFacingResult,
): string[] {
  if (facing.tilePaths?.length === PHOTOSHOOT_FRAME_COUNT) return facing.tilePaths;
  return facing.resultPath ? [facing.resultPath] : [];
}

/** Sidecar names from `photoshootTileStoragePath`: `stem-1.jpg` … `stem-4.jpg`. */
export function looksLikePhotoshootTilePaths(paths: string[]): boolean {
  if (paths.length !== PHOTOSHOOT_FRAME_COUNT) return false;
  const parsed = paths.map((path) => {
    const file = String(path || "").trim().split("/").pop() || "";
    const match = file.match(/^(.*)-([1-4])\.jpe?g$/i);
    return match ? { stem: match[1], tile: Number(match[2]) } : null;
  });
  if (parsed.some((item) => !item || !item.stem)) return false;
  const stem = parsed[0]?.stem;
  const tiles = new Set(parsed.map((item) => item?.tile));
  return parsed.every((item) => item?.stem === stem) && tiles.size === PHOTOSHOOT_FRAME_COUNT;
}

/** Published UGC album that is one photoshoot, not a Telegram 4-photo split. */
export function isPhotoshootUgcListing(input: {
  datasetSlug?: string | null;
  photoCount?: number;
  storagePaths?: string[] | null;
}): boolean {
  const paths = (input.storagePaths || [])
    .map((path) => String(path || "").trim())
    .filter(Boolean);
  if (looksLikePhotoshootTilePaths(paths)) return true;
  return (
    input.datasetSlug === "web_generation_ugc" &&
    Number(input.photoCount) === PHOTOSHOOT_FRAME_COUNT
  );
}

export function isPhotoshootEditKind(value: unknown): boolean {
  return String(value || "").trim() === PHOTOSHOOT_EDIT_KIND;
}

export function looksLikePhotoshootInstruction(text: string): boolean {
  return /^\s*PHOTOSHOOT\b/i.test(String(text ?? ""));
}

/** Catalog / Repeat must never show the enqueue PHOTOSHOOT blob. */
export function usableCatalogPrompt(text: string | null | undefined): string | null {
  const cleaned = String(text || "").trim();
  if (!cleaned || looksLikePhotoshootInstruction(cleaned)) return null;
  return cleaned;
}

/** Which frame to open from a listing click. Index wins over URL match. */
export function resolvePhotoshootOpenIndex(input: {
  urls: string[];
  photoIndex?: number | null;
  photoUrl?: string | null;
}): number {
  const urls = input.urls;
  const index = input.photoIndex;
  if (
    typeof index === "number" &&
    Number.isInteger(index) &&
    index >= 0 &&
    index < urls.length
  ) {
    return index;
  }
  if (input.photoUrl) {
    const matched = urls.indexOf(input.photoUrl);
    if (matched >= 0) return matched;
  }
  return 0;
}

/** One catalog prompt per frame when variants line up with the 2×2 sheet. */
export function visiblePromptTextsForPhoto(input: {
  promptTexts: readonly string[];
  photoCount: number;
  photoIndex: number;
}): string[] {
  const texts = [...input.promptTexts];
  if (texts.length === input.photoCount && input.photoCount > 1) {
    const selected = texts[input.photoIndex] || texts[0];
    return selected ? [selected] : [];
  }
  return texts;
}

export function selectedPromptText(input: {
  promptTexts: readonly string[];
  photoCount: number;
  photoIndex: number;
}): string {
  return visiblePromptTextsForPhoto(input).join("\n\n");
}

/** Replace enqueue junk / incomplete set before catalog publish. */
export function shouldReplacePhotoshootVariants(texts: string[]): boolean {
  const cleaned = texts.map((text) => String(text || "").trim()).filter(Boolean);
  if (cleaned.length !== PHOTOSHOOT_FRAME_COUNT) return true;
  return cleaned.some((text) => looksLikePhotoshootInstruction(text));
}

export function serializePhotoshootEnqueueInstruction(): string {
  return [
    PHOTOSHOOT_ENQUEUE_INSTRUCTION,
    `planner_temperature=${PHOTOSHOOT_PLANNER_TEMPERATURE.toFixed(2)}`,
    "Four-frame contact sheet from the attached photograph.",
  ].join("\n");
}

/** Leftover numbers in old rows are ignored — planner always uses max. */
export function parsePhotoshootPlannerTemperature(_instruction?: string): number {
  return PHOTOSHOOT_PLANNER_TEMPERATURE;
}

export type PhotoshootSourceError =
  | "photoshoot_source_required"
  | "photoshoot_source_conflict"
  | "photoshoot_one_photo";

export function validatePhotoshootGenerationSource(input: {
  hasParentGeneration: boolean;
  photoCount: number;
}): PhotoshootSourceError | null {
  if (input.hasParentGeneration && input.photoCount > 0) {
    return "photoshoot_source_conflict";
  }
  if (!input.hasParentGeneration && input.photoCount === 0) {
    return "photoshoot_source_required";
  }
  if (!input.hasParentGeneration && input.photoCount !== 1) {
    return "photoshoot_one_photo";
  }
  return null;
}

export function photoshootSourceErrorMessage(error: PhotoshootSourceError): string {
  switch (error) {
    case "photoshoot_source_conflict":
      return "Укажите либо исходное фото, либо предыдущую генерацию";
    case "photoshoot_source_required":
    case "photoshoot_one_photo":
      return "Для фотосессии выберите одно фото";
  }
}

export function photoshootFingerprintFields(
  parentGenerationId: string,
  photoStoragePath?: string,
): {
  editKind: string;
  parentGenerationId: string;
  photoStoragePath: string;
  plannerTemperature: number;
} {
  return {
    editKind: PHOTOSHOOT_EDIT_KIND,
    parentGenerationId: String(parentGenerationId || "").trim(),
    photoStoragePath: String(photoStoragePath || "").trim(),
    plannerTemperature: PHOTOSHOOT_PLANNER_TEMPERATURE,
  };
}

function asCleanLine(value: unknown, max = 240): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function parsePhotoshootPlan(raw: unknown): PhotoshootPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const theme = asCleanLine(row.theme, 160) || "editorial portraits";
  const shotsRaw = Array.isArray(row.shots)
    ? row.shots
    : Array.isArray(row.frames)
      ? row.frames
      : null;
  if (!shotsRaw || shotsRaw.length < PHOTOSHOOT_FRAME_COUNT) return null;

  const seen = new Set<number>();
  const shots: PhotoshootShot[] = [];
  for (const item of shotsRaw) {
    if (!item || typeof item !== "object") continue;
    const shot = item as Record<string, unknown>;
    const i = Number(shot.i);
    const pose = asCleanLine(shot.pose);
    const motion = asCleanLine(shot.motion);
    const lens = asCleanLine(shot.lens, 120) || "85mm";
    if (!Number.isInteger(i) || i < 1 || i > PHOTOSHOOT_FRAME_COUNT) continue;
    if (seen.has(i) || !pose || !motion) continue;
    seen.add(i);
    shots.push({ i, pose, motion, lens });
  }
  if (seen.size !== PHOTOSHOOT_FRAME_COUNT) return null;
  shots.sort((a, b) => a.i - b.i);
  return { theme, shots };
}

export function extractJsonObject(text: string): unknown {
  const raw = String(text ?? "").trim();
  if (!raw) return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] || raw).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function serializePhotoshootSheetInstruction(
  plan: PhotoshootPlan,
  aspect?: string | null,
): string {
  const canvas = resolvePhotoshootSheetAspect({ aspectRatio: aspect });
  const lines = [
    "PHOTOSHOOT (HIGHEST PRIORITY)",
    `Theme: ${plan.theme}`,
    photoshootCanvasConstraint(canvas),
    "Output ONE photorealistic 2x2 sheet: four SEPARATE photographs of the SAME person from the attached reference, flush against each other.",
    PHOTOSHOOT_FLUSH_PANELS_RULE,
    "Panel layout: 1 top-left, 2 top-right, 3 bottom-left, 4 bottom-right.",
    "MUST CHANGE: pose and motion in every panel. If two panels share the same pose, you FAILED.",
    "LOCK: identity, face, body, hair, wardrobe, set, lighting, time of day.",
    "FORBIDDEN: captions, arrows, Polaroid frames, gutters, white seams, panel borders, watermarks, extra people, outfit or location change, returning the input crop unchanged.",
  ];
  for (const shot of plan.shots) {
    lines.push(
      `Panel ${shot.i}: pose — ${shot.pose}; motion — ${shot.motion}; lens — ${shot.lens}.`,
    );
  }
  return lines.join("\n");
}
