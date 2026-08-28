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
  const theme = asCleanLine(row.theme, 160);
  const shotsRaw = Array.isArray(row.shots) ? row.shots : null;
  if (!theme || !shotsRaw || shotsRaw.length !== PHOTOSHOOT_FRAME_COUNT) return null;

  const seen = new Set<number>();
  const shots: PhotoshootShot[] = [];
  for (const item of shotsRaw) {
    if (!item || typeof item !== "object") return null;
    const shot = item as Record<string, unknown>;
    const i = Number(shot.i);
    const pose = asCleanLine(shot.pose);
    const motion = asCleanLine(shot.motion);
    const lens = asCleanLine(shot.lens, 120);
    if (!Number.isInteger(i) || i < 1 || i > PHOTOSHOOT_FRAME_COUNT) return null;
    if (seen.has(i) || !pose || !motion || !lens) return null;
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

export function serializePhotoshootSheetInstruction(plan: PhotoshootPlan): string {
  const lines = [
    "PHOTOSHOOT (HIGHEST PRIORITY)",
    `Theme: ${plan.theme}`,
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
