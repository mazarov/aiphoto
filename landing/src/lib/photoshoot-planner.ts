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

/** Same knobs as animate-scenario: Flash thinking must not eat the JSON budget. */
export const PHOTOSHOOT_PLANNER_GENERATION_CONFIG = {
  temperature: 0.5,
  maxOutputTokens: 2048,
  responseMimeType: "application/json" as const,
  responseSchema: PHOTOSHOOT_PLANNER_RESPONSE_SCHEMA,
  thinkingConfig: { thinkingBudget: 0 },
};

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
