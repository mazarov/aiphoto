/**
 * Step-1 JSON for STV anti-copy extract (docs/24-03-stv-three-step-style-prompt-pipeline.md).
 */

export type StvAntiCopyExtractionPayload = {
  scene_abstraction: string;
  genre: string;
  lighting: string;
  camera: string;
  composition_rules: string;
  color_style: string;
  mood: string;
  styling_cues: string;
  background_type: string;
  key_style_tokens: string[];
  negative_constraints: string[];
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === "string" && x.trim().length > 0).map((s) => s.trim());
}

/**
 * Returns coerced payload or null if validation fails.
 */
export function coerceStvAntiCopyExtractionPayload(raw: Record<string, unknown> | null): StvAntiCopyExtractionPayload | null {
  if (!raw || typeof raw !== "object") return null;

  const scene_abstraction = isNonEmptyString(raw.scene_abstraction) ? raw.scene_abstraction.trim() : "";
  const genre = isNonEmptyString(raw.genre) ? raw.genre.trim() : "";
  const lighting = isNonEmptyString(raw.lighting) ? raw.lighting.trim() : "";
  const camera = isNonEmptyString(raw.camera) ? raw.camera.trim() : "";
  const composition_rules = isNonEmptyString(raw.composition_rules) ? raw.composition_rules.trim() : "";
  const color_style = isNonEmptyString(raw.color_style) ? raw.color_style.trim() : "";
  const mood = isNonEmptyString(raw.mood) ? raw.mood.trim() : "";
  const styling_cues = isNonEmptyString(raw.styling_cues) ? raw.styling_cues.trim() : "";
  const background_type = isNonEmptyString(raw.background_type) ? raw.background_type.trim() : "";

  const key_style_tokens = asStringArray(raw.key_style_tokens);
  const negative_constraints = asStringArray(raw.negative_constraints);

  if (
    !scene_abstraction ||
    !genre ||
    !lighting ||
    !camera ||
    !composition_rules ||
    !color_style ||
    !mood ||
    !styling_cues ||
    !background_type
  ) {
    return null;
  }

  if (key_style_tokens.length < 5 || key_style_tokens.length > 10) return null;
  if (negative_constraints.length < 3 || negative_constraints.length > 8) return null;

  return {
    scene_abstraction,
    genre,
    lighting,
    camera,
    composition_rules,
    color_style,
    mood,
    styling_cues,
    background_type,
    key_style_tokens,
    negative_constraints,
  };
}
