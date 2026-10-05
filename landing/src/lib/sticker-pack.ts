/**
 * Sticker-pack generation contract — shared by the landing API, the worker and the compose UI.
 * No `@/` imports: the worker compiles this file via tsconfig include + Dockerfile COPY.
 *
 * One job = 16 stickers from one photo. The provider paints 4 sheets of 2×2 (1024 px → 512 px
 * cells, no upscale); each cell goes through the single-sticker finalize (alpha / chroma / rembg,
 * 512 PNG, safe margin, no outline). The 16 PNGs are the user-facing result, like photoshoot
 * tiles; `result_storage_path` holds a 4×4 preview sheet for lists.
 */

import { STICKER_BACKGROUND_HEX, type StickerBackgroundMode } from "./sticker";

export const STICKER_PACK_EDIT_KIND = "sticker_pack";
export const STICKER_PACK_CONFIG_ENABLED_KEY = "sticker_pack_enabled";
export const STICKER_PACK_CONFIG_COST_KEY = "sticker_pack_cost";
/** Image model for the pack sheets. Empty → `sticker_model`, then `default_model`. */
export const STICKER_PACK_CONFIG_MODEL_KEY = "sticker_pack_model";
/** Product price for one pack job (credits). DB `sticker_pack_cost` overrides. */
export const STICKER_PACK_DEFAULT_CREDIT_COST = 20;
export const STICKER_PACK_ASPECT_RATIO = "1:1";
export const STICKER_PACK_IMAGE_SIZE = "1K";

export const STICKER_PACK_COUNT = 16;
/** Preview sheet and bot example grid: 16 → 4×4. */
export const STICKER_PACK_GRID = 4;
/** Each provider call paints one 2×2 sheet; 4 calls make the pack. */
export const STICKER_PACK_SHEET_GRID = 2;
export const STICKER_PACK_SHEET_CELLS = STICKER_PACK_SHEET_GRID * STICKER_PACK_SHEET_GRID;
export const STICKER_PACK_SHEET_COUNT = STICKER_PACK_COUNT / STICKER_PACK_SHEET_CELLS;
/** GPT Image (OpenRouter) is 1024 px only; 2×2 on 1024 → 512 px cells, the sticker canvas. */
export const STICKER_PACK_PROVIDER_SHEET_PX = 1024;
export const STICKER_PACK_CELL_PX = STICKER_PACK_PROVIDER_SHEET_PX / STICKER_PACK_SHEET_GRID;
/** 4×4 preview of the finished 512 stickers, 256 px per cell. */
export const STICKER_PACK_PREVIEW_PX = 1024;
/** Same margin the bot uses when fitting a cut cell into 512 (`fitStickerIn512WithMargin`). */
export const STICKER_PACK_FIT_MARGIN = 0.05;
/** Placeholder in `pack_content_sets.scene_descriptions`; the bot swaps a gender word in. */
export const STICKER_PACK_SUBJECT_PLACEHOLDER = /\{subject\}/gi;
export const STICKER_PACK_SUBJECT_WORD = "the person";
export const STICKER_PACK_SCENE_MAX_CHARS = 400;

export const STICKER_PACK_PROMPT_MARKER = "STICKER_PACK";
export const STICKER_PACK_SCENES_HEADER = "SCENES";

export type StickerPackCell = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type StickerPackPromptSpec = {
  styleId: string;
  setId: string;
  /** Style block for the image model (English, imperative). */
  stylePrompt: string;
  /** Exactly `STICKER_PACK_COUNT` scenes, `{subject}` already replaced. */
  scenes: string[];
};

export function isStickerPackEditKind(value: unknown): boolean {
  return String(value ?? "").trim() === STICKER_PACK_EDIT_KIND;
}

/** DB `sticker_pack_cost`: non-negative integer, else the code default. */
export function parseStickerPackCreditCost(value: unknown): number {
  const raw = String(value ?? "").trim();
  if (!raw) return STICKER_PACK_DEFAULT_CREDIT_COST;
  const num = Number(raw);
  if (!Number.isInteger(num) || num < 0) return STICKER_PACK_DEFAULT_CREDIT_COST;
  return num;
}

/** Square-ish grid: 16 → 4×4, 9 → 3×3, 4 → 2×2. Same formula as the bot worker. */
export function stickerPackGrid(stickerCount: number): { cols: number; rows: number } {
  const count = Math.max(1, Math.floor(stickerCount));
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  return { cols, rows };
}

/**
 * Pixel box of cell `index` (row-major, left to right) on a `sheetWidth`×`sheetHeight` sheet.
 * `null` when the index is past the sticker count. Cells share edges — no gutter.
 */
export function stickerPackCellBox(
  index: number,
  stickerCount = STICKER_PACK_COUNT,
  sheetWidth = STICKER_PACK_PROVIDER_SHEET_PX,
  sheetHeight = sheetWidth,
): StickerPackCell | null {
  if (!Number.isInteger(index) || index < 0 || index >= stickerCount) return null;
  const { cols, rows } = stickerPackGrid(stickerCount);
  const width = Math.floor(sheetWidth / cols);
  const height = Math.floor(sheetHeight / rows);
  const col = index % cols;
  const row = Math.floor(index / cols);
  return { left: col * width, top: row * height, width, height };
}

/** Scenes of provider sheet `sheetIndex` (0-based): 4 consecutive scenes in pack order. */
export function stickerPackSheetScenes(scenes: readonly string[], sheetIndex: number): string[] {
  if (!Number.isInteger(sheetIndex) || sheetIndex < 0 || sheetIndex >= STICKER_PACK_SHEET_COUNT) return [];
  const start = sheetIndex * STICKER_PACK_SHEET_CELLS;
  return scenes.slice(start, start + STICKER_PACK_SHEET_CELLS).map((scene) => String(scene ?? "").trim());
}

/** Pack index (0-based) of cell `cellIndex` on sheet `sheetIndex`. */
export function stickerPackStickerIndex(sheetIndex: number, cellIndex: number): number {
  return sheetIndex * STICKER_PACK_SHEET_CELLS + cellIndex;
}

function cleanSceneLine(value: unknown): string {
  return String(value ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, STICKER_PACK_SCENE_MAX_CHARS);
}

/**
 * `pack_content_sets.scene_descriptions` → 16 clean scene lines with `{subject}` replaced.
 * `null` when the set is not a 16-sticker set or a scene is empty.
 */
export function normalizeStickerPackScenes(raw: unknown, count = STICKER_PACK_COUNT): string[] | null {
  if (!Array.isArray(raw) || raw.length !== count) return null;
  const scenes = raw.map((item) => cleanSceneLine(item).replace(STICKER_PACK_SUBJECT_PLACEHOLDER, STICKER_PACK_SUBJECT_WORD));
  if (scenes.some((scene) => !scene)) return null;
  return scenes;
}

const ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

export function isStickerPackSetId(value: unknown): value is string {
  return typeof value === "string" && ID_RE.test(value.trim());
}

/**
 * Server-side SSOT for `landing_generations.prompt_text` of a pack job.
 * Marker line, the style block, then a numbered scene list the worker splits into 4 sheets.
 */
export function buildStickerPackPromptText(spec: StickerPackPromptSpec): string {
  const styleId = String(spec.styleId || "").trim();
  const setId = String(spec.setId || "").trim();
  if (!ID_RE.test(styleId) || !ID_RE.test(setId)) {
    throw new Error("sticker_pack_prompt_invalid_ids");
  }
  const scenes = normalizeStickerPackScenes(spec.scenes);
  if (!scenes) throw new Error("sticker_pack_prompt_invalid_scenes");
  const stylePrompt = String(spec.stylePrompt || "").replace(/\r/g, "").trim();
  if (!stylePrompt || /^SCENES$/m.test(stylePrompt)) throw new Error("sticker_pack_prompt_invalid_style");
  return [
    `${STICKER_PACK_PROMPT_MARKER} style=${styleId} set=${setId} count=${scenes.length}`,
    stylePrompt,
    STICKER_PACK_SCENES_HEADER,
    ...scenes.map((scene, i) => `${i + 1}. ${scene}`),
  ].join("\n");
}

export function parseStickerPackPrompt(promptText: unknown): StickerPackPromptSpec | null {
  const text = String(promptText ?? "").replace(/\r/g, "");
  const lines = text.split("\n");
  const header = /^STICKER_PACK style=([A-Za-z0-9_-]+) set=([A-Za-z0-9_-]+) count=(\d+)\s*$/.exec(lines[0]?.trim() ?? "");
  if (!header) return null;
  const count = Number(header[3]);
  if (count !== STICKER_PACK_COUNT) return null;
  const scenesAt = lines.findIndex((line, i) => i > 0 && line.trim() === STICKER_PACK_SCENES_HEADER);
  if (scenesAt < 0) return null;
  const stylePrompt = lines.slice(1, scenesAt).join("\n").trim();
  if (!stylePrompt) return null;
  const scenes: string[] = [];
  for (const line of lines.slice(scenesAt + 1)) {
    const match = /^(\d+)\.\s+(.+)$/.exec(line.trim());
    if (!match) continue;
    if (Number(match[1]) !== scenes.length + 1) return null;
    scenes.push(match[2].trim());
  }
  if (scenes.length !== count) return null;
  return { styleId: header[1], setId: header[2], stylePrompt, scenes };
}

export function isStickerPackPromptText(promptText: unknown): boolean {
  return /^STICKER_PACK style=/.test(String(promptText ?? ""));
}

function sheetBackgroundRule(mode: StickerBackgroundMode): string {
  return mode === "transparent"
    ? "2. Background MUST be fully TRANSPARENT (alpha channel) in EVERY cell — the figures are isolated. No backdrop, no floor, no shadow, no props behind the subject. Any prop in a scene stands on the same transparent background."
    : `2. Background MUST be flat uniform BRIGHT MAGENTA (${STICKER_BACKGROUND_HEX}) in EVERY cell. Any prop in a scene stands on this same flat background — no walls, no room interior, no extra environment.`;
}

function sheetMarginWord(mode: StickerBackgroundMode): string {
  return mode === "transparent" ? "transparent" : "magenta";
}

function sheetSpillRule(mode: StickerBackgroundMode): string {
  return mode === "transparent"
    ? ""
    : "\n11. Avoid magenta or pink tones on the subject itself (clothes, lips, cheeks lean warm / neutral) so chroma cleanup does not eat the figure.";
}

/**
 * Worker prompt for one 2×2 provider sheet. Ported from the bot pack grid task; the style block
 * is the same `style_presets_v2.prompt_hint` the single sticker uses. `transparent` for GPT Image,
 * `magenta` for RGB-only providers (chroma key / rembg per cell afterwards).
 */
export function assembleStickerPackSheetPrompt(input: {
  stylePrompt: string;
  scenes: readonly string[];
  mode?: StickerBackgroundMode;
}): string {
  const mode = input.mode ?? "magenta";
  const scenes = input.scenes.map((scene) => String(scene ?? "").trim()).filter(Boolean);
  if (scenes.length !== STICKER_PACK_SHEET_CELLS) throw new Error("sticker_pack_sheet_scenes_invalid");
  const grid = STICKER_PACK_SHEET_GRID;
  const sceneList = scenes.map((scene, i) => `${i + 1}. ${scene}`).join("\n");
  const outcome =
    mode === "transparent"
      ? "Each cell is used directly as a messenger sticker."
      : "Each cell will be background-removed programmatically and used as a messenger sticker.";
  return `${input.stylePrompt.trim()}

[TASK — STICKER PACK GRID]
The input image shows the SUBJECT (a real person). Create ONE square image laid out as a ${grid}x${grid} grid (${scenes.length} cells, equal size, row-major: 1 top-left, 2 top-right, 3 bottom-left, 4 bottom-right).
Each cell = ONE picture of that same person with a DISTINCT pose / emotion from the list below. ${outcome}

Scenes (one per cell, left-to-right, top-to-bottom):
${sceneList}

GAZE DIRECTION (MANDATORY): if a scene says where the person looks ("gaze at camera", "looking down", "eyes closed"), that cell MUST follow it exactly. Default: direct gaze at the camera.

CRITICAL RULES FOR THE GRID:
The character must look EXACTLY like the person in the reference photo in EVERY cell.
0. STYLE (apply in every cell): the style block above.
1. Do NOT draw any outline, border, stroke, glow or contour around the character — raw clean edges only. No sticker-style white borders; they are added later.
${sheetBackgroundRule(mode)}
3. Each figure fully visible inside its cell, nothing cropped. Hands, arms, fingers and hair FULLY inside the cell with clear margin — never crop at the wrists. If a pose would leave the cell, draw the figure smaller.
4. MANDATORY PADDING: every figure is SURROUNDED by empty ${sheetMarginWord(mode)} space on ALL four sides — at least 15% of the cell on top, bottom, left and right. Raised arms or wide gestures: 20% or more. A figure that touches a cell edge FAILED.
5. SEAMLESS GRID: the image is one continuous surface — NO lines, stripes, frames, gutters or separators between the ${scenes.length} cells. We cut the image programmatically at the exact midlines; a figure that crosses a midline FAILED.
6. LIKENESS: in EVERY cell eye color matches the reference EXACTLY; keep freckles, moles, glasses (if worn), face shape, skin tone, hair color and shape. Do not swap in a different face.
7. Style IDENTICAL across all cells — same art style, proportions, line work, palette.
8. No text, letters, captions, emojis, watermarks or logos anywhere.
9. FRAMING: chest-up (mid-torso to top of head), head about 35–45% of the cell height, camera distance identical in all cells. No full body unless the scene demands it.
10. EXPRESSION: lively but natural — emotion intensity about 60–70% of maximum, caught mid-action, not posing. The person must stay instantly recognisable.${sheetSpillRule(mode)}`.trim();
}

/* ---------- Storage layout ---------- */

/** Sidecar next to the preview: `user/job/lease.png` → `user/job/lease-01.png` … `lease-16.png`. */
export function stickerPackTileStoragePath(resultPath: string, stickerNumber: number): string {
  const path = String(resultPath || "").trim();
  if (!path || !Number.isInteger(stickerNumber) || stickerNumber < 1 || stickerNumber > STICKER_PACK_COUNT) return "";
  const slash = path.lastIndexOf("/");
  const file = slash >= 0 ? path.slice(slash + 1) : path;
  const dir = slash >= 0 ? path.slice(0, slash + 1) : "";
  const dot = file.lastIndexOf(".");
  const stem = dot > 0 ? file.slice(0, dot) : file;
  if (!stem) return "";
  return `${dir}${stem}-${String(stickerNumber).padStart(2, "0")}.png`;
}

/** PostgREST usually sends text[] as JSON; some RPC paths return `{a,b,c}`. */
export function coerceTilePathList(raw: unknown): unknown {
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

export function parseStickerPackTilePaths(raw: unknown): string[] | null {
  const value = coerceTilePathList(raw);
  if (!Array.isArray(value) || value.length !== STICKER_PACK_COUNT) return null;
  const paths = value.map((item) => String(item ?? "").trim());
  if (paths.some((path) => !path)) return null;
  return paths;
}

/** Worker uploads the 16 sidecars before complete; rebuild them when the denormalized column lags. */
export function deriveStickerPackTilePaths(previewPath?: string | null): string[] | null {
  const path = String(previewPath || "").trim();
  if (!path) return null;
  const tiles = Array.from({ length: STICKER_PACK_COUNT }, (_, i) => stickerPackTileStoragePath(path, i + 1));
  if (tiles.some((item) => !item)) return null;
  return tiles;
}

export function stickerPackTilePathsForJob(input: {
  tilePaths?: unknown;
  previewPath?: string | null;
}): string[] | null {
  return parseStickerPackTilePaths(input.tilePaths) ?? deriveStickerPackTilePaths(input.previewPath);
}

/**
 * `landing_generations.photoshoot_tile_paths` carries 4 photoshoot JPEGs or 16 pack PNGs.
 * The complete RPC and the worker accept exactly these cardinalities.
 */
export function isSidecarTileCount(count: number): boolean {
  return count === 4 || count === STICKER_PACK_COUNT;
}

export type StickerPackUserFacingResult = {
  /** Single-image slot for history: the 4×4 preview PNG. */
  resultPath: string | null;
  /** The 16 stickers, pack order. */
  tilePaths: string[] | null;
};

export function resolveStickerPackUserFacingResult(input: {
  editKind?: string | null;
  previewPath?: string | null;
  tilePaths?: unknown;
}): StickerPackUserFacingResult | null {
  if (!isStickerPackEditKind(input.editKind)) return null;
  const previewPath = String(input.previewPath || "").trim() || null;
  return {
    resultPath: previewPath,
    tilePaths: stickerPackTilePathsForJob({ tilePaths: input.tilePaths, previewPath }),
  };
}

export function stickerPackFingerprintFields(
  photoStoragePath: string,
  styleId: string,
  setId: string,
): {
  editKind: string;
  photoStoragePath: string;
  stickerStyleId: string;
  stickerPackSetId: string;
} {
  return {
    editKind: STICKER_PACK_EDIT_KIND,
    photoStoragePath: String(photoStoragePath || "").trim(),
    stickerStyleId: String(styleId || "").trim(),
    stickerPackSetId: String(setId || "").trim(),
  };
}
