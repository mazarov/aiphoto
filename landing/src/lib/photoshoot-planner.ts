export const PHOTOSHOOT_PLANNER_MODEL = "gemini-2.5-flash";
export const PHOTOSHOOT_PLANNER_PROMPT_VERSION = "PHOTOSHOOT_PLANNER_PROMPT_V2";

export const PHOTOSHOOT_PLANNER_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    theme: { type: "STRING" },
    shots: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          i: { type: "INTEGER" },
          pose: { type: "STRING" },
          motion: { type: "STRING" },
          lens: { type: "STRING" },
        },
        required: ["i", "pose", "motion", "lens"],
      },
    },
  },
  required: ["theme", "shots"],
} as const;

export const PHOTOSHOOT_PLANNER_TEMPERATURE_MIN = 0;
/** Gemini Flash ceiling. UI 100 maps here; 50 stays the old default 0.5. */
export const PHOTOSHOOT_PLANNER_TEMPERATURE_MAX = 2;
export const PHOTOSHOOT_PLANNER_TEMPERATURE_DEFAULT = 0.5;
export const PHOTOSHOOT_PLANNER_TEMPERATURE_STEP = 0.05;

export function clampPhotoshootPlannerTemperature(raw: unknown): number {
  const value =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number(raw)
        : Number.NaN;
  if (!Number.isFinite(value)) return PHOTOSHOOT_PLANNER_TEMPERATURE_DEFAULT;
  const clamped = Math.min(
    PHOTOSHOOT_PLANNER_TEMPERATURE_MAX,
    Math.max(PHOTOSHOOT_PLANNER_TEMPERATURE_MIN, value),
  );
  return Math.round(clamped * 100) / 100;
}

/** UI 0–100 ↔ Gemini temperature. 50 = 0.5, 100 = 2.0. */
export function photoshootCreativityFromTemperature(temperature: unknown): number {
  const t = clampPhotoshootPlannerTemperature(temperature);
  if (t <= PHOTOSHOOT_PLANNER_TEMPERATURE_DEFAULT) {
    return Math.round((t / PHOTOSHOOT_PLANNER_TEMPERATURE_DEFAULT) * 50);
  }
  return Math.round(
    50 +
      ((t - PHOTOSHOOT_PLANNER_TEMPERATURE_DEFAULT) /
        (PHOTOSHOOT_PLANNER_TEMPERATURE_MAX - PHOTOSHOOT_PLANNER_TEMPERATURE_DEFAULT)) *
        50,
  );
}

export function photoshootTemperatureFromCreativity(creativity: unknown): number {
  const value =
    typeof creativity === "number"
      ? creativity
      : typeof creativity === "string"
        ? Number(creativity)
        : Number.NaN;
  if (!Number.isFinite(value)) return PHOTOSHOOT_PLANNER_TEMPERATURE_DEFAULT;
  const c = Math.min(100, Math.max(0, value));
  const temperature =
    c <= 50
      ? (c / 50) * PHOTOSHOOT_PLANNER_TEMPERATURE_DEFAULT
      : PHOTOSHOOT_PLANNER_TEMPERATURE_DEFAULT +
        ((c - 50) / 50) *
          (PHOTOSHOOT_PLANNER_TEMPERATURE_MAX - PHOTOSHOOT_PLANNER_TEMPERATURE_DEFAULT);
  return clampPhotoshootPlannerTemperature(temperature);
}

/** One live hint in the rail — replaces as the slider moves. */
export function photoshootCreativityHint(creativity: unknown): string {
  const value =
    typeof creativity === "number"
      ? creativity
      : typeof creativity === "string"
        ? Number(creativity)
        : Number.NaN;
  const c = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 50;
  if (c <= 39) return "нейтральнее";
  if (c <= 60) return "нейтрально";
  if (c <= 84) return "смелее";
  return "невероятные сюжеты";
}

/** Same knobs as animate-scenario: Flash thinking must not eat the JSON budget. */
export const PHOTOSHOOT_PLANNER_GENERATION_CONFIG = {
  temperature: PHOTOSHOOT_PLANNER_TEMPERATURE_DEFAULT,
  maxOutputTokens: 2048,
  responseMimeType: "application/json" as const,
  responseSchema: PHOTOSHOOT_PLANNER_RESPONSE_SCHEMA,
  thinkingConfig: { thinkingBudget: 0 },
};

export function photoshootPlannerGenerationConfig(temperature?: unknown) {
  return {
    ...PHOTOSHOOT_PLANNER_GENERATION_CONFIG,
    temperature: clampPhotoshootPlannerTemperature(
      temperature ?? PHOTOSHOOT_PLANNER_GENERATION_CONFIG.temperature,
    ),
  };
}

export const PHOTOSHOOT_PLANNER_SYSTEM_PROMPT = `
You are a professional photographer on a set. The attached photograph is the only source of truth for the person, wardrobe, location, and light.

Invent a four-frame photoshoot. English only. Return JSON, no markdown, no commentary.

Schema:
{
  "theme": "short editorial theme",
  "shots": [
    { "i": 1, "pose": "...", "motion": "...", "lens": "..." },
    { "i": 2, "pose": "...", "motion": "...", "lens": "..." },
    { "i": 3, "pose": "...", "motion": "...", "lens": "..." },
    { "i": 4, "pose": "...", "motion": "...", "lens": "..." }
  ]
}

Rules:
- Exactly 4 shots, i = 1..4.
- Pose and motion MUST differ across shots (stance, weight, torso turn, arms, step, gaze).
- Keep the same person, face, body, clothes, location, and lighting implied by the photo.
- Do not make all four look at camera the same way.
- Do not describe on-image text, frames, or collage borders.
- lens is a short camera note (e.g. "85mm, waist-up").
`.trim();

export const PHOTOSHOOT_PLANNER_USER_TEXT =
  "Plan four distinct poses for a contact-sheet photoshoot of the person in this photograph. Return JSON only.";

/** High creativity must change the brief — temperature alone barely moves structured JSON. */
export function buildPhotoshootPlannerUserText(temperature?: unknown): string {
  const t = clampPhotoshootPlannerTemperature(temperature);
  if (t <= 0.25) {
    return [
      "Stay close to the source pose.",
      "Four small, natural variations only: weight shift, gaze, a hand, breath.",
      "Same person, clothes, location, and light. Return JSON only.",
    ].join(" ");
  }
  if (t >= 1.2) {
    return [
      "Invent four bold, unexpected editorial poses.",
      "Push stance, gaze, motion, and crop as far as this location allows.",
      "Same person, face, clothes, location, and light. Return JSON only.",
    ].join(" ");
  }
  return PHOTOSHOOT_PLANNER_USER_TEXT;
}
