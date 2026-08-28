export const PHOTOSHOOT_EDIT_KIND = "photoshoot";
export const PHOTOSHOOT_DEFAULT_MODEL = "grok-imagine-image-2.0";
export const PHOTOSHOOT_FRAME_COUNT = 4;
export const PHOTOSHOOT_ENQUEUE_INSTRUCTION = "PHOTOSHOOT";

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
  return `Canvas ${aspect}: ONE 2x2 contact sheet in ${aspect}. Each panel is also ${aspect}. Do not letterbox.`;
}

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
  if (!Array.isArray(raw) || raw.length !== PHOTOSHOOT_FRAME_COUNT) return null;
  const paths = raw.map((item) => String(item ?? "").trim());
  if (paths.some((path) => !path)) return null;
  return paths;
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
  const tiles = parsePhotoshootTilePaths(input.tilePaths);
  if (isPhotoshootEditKind(input.editKind)) {
    return {
      resultPath: tiles?.[0] ?? null,
      tilePaths: tiles,
    };
  }
  const sheetPath = String(input.sheetPath || "").trim();
  return {
    resultPath: sheetPath || null,
    tilePaths: tiles,
  };
}

export function isPhotoshootEditKind(value: unknown): boolean {
  return String(value || "").trim() === PHOTOSHOOT_EDIT_KIND;
}

export function looksLikePhotoshootInstruction(text: string): boolean {
  return /^\s*PHOTOSHOOT\b/i.test(String(text ?? ""));
}

export function serializePhotoshootEnqueueInstruction(): string {
  return [
    PHOTOSHOOT_ENQUEUE_INSTRUCTION,
    "Four-frame contact sheet from the attached photograph.",
  ].join("\n");
}

export function photoshootFingerprintFields(parentGenerationId: string): {
  editKind: string;
  parentGenerationId: string;
} {
  return {
    editKind: PHOTOSHOOT_EDIT_KIND,
    parentGenerationId,
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
    "Output ONE photorealistic 2x2 contact sheet: four SEPARATE photographs of the SAME person from the attached reference.",
    "Panel layout: 1 top-left, 2 top-right, 3 bottom-left, 4 bottom-right.",
    "MUST CHANGE: pose and motion in every panel. If two panels share the same pose, you FAILED.",
    "LOCK: identity, face, body, hair, wardrobe, set, lighting, time of day.",
    "FORBIDDEN: captions, arrows, Polaroid frames, watermarks, extra people, outfit or location change, returning the input crop unchanged.",
  ];
  for (const shot of plan.shots) {
    lines.push(
      `Panel ${shot.i}: pose — ${shot.pose}; motion — ${shot.motion}; lens — ${shot.lens}.`,
    );
  }
  return lines.join("\n");
}
