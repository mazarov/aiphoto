import { DEFAULT_VIDEO_PROMPT } from "@/lib/generation/image-options";

export const ANIMATE_SCENARIO_MODEL = "gemini-2.5-flash";
export const ANIMATE_SCENARIO_MAX_CHARS = 400;
export const ANIMATE_SCENARIO_PLACEHOLDER = "Придумываю сценарий…";

export const ANIMATE_SCENARIO_SYSTEM_PROMPT = [
  "You invent a short motion scenario for a 4-second image-to-video clip.",
  "The photograph is the only source of truth. The original image prompt is supporting context only.",
  "",
  "Write 1-2 sentences in Russian that describe concrete physical motion that could happen in THIS still frame over 4 seconds.",
  "",
  "Rules:",
  "- Keep the same person, face, clothing, pose family, setting, lighting, and camera distance.",
  "- Do not add people, objects, locations, weather, text, or style changes.",
  "- Prefer living-photo motion: breath, hair, fabric, eyes, light, a tiny camera ease.",
  "- If the frame already implies a specific action, use that action. Do not invent a different story.",
  "- No titles, quotes, markdown, or explanation. Return only the scenario.",
].join("\n");

export function isGenericVideoPrompt(text: string): boolean {
  const normalized = text.trim().toLowerCase().replace(/[.!?…]+$/g, "");
  return !normalized || normalized === DEFAULT_VIDEO_PROMPT.toLowerCase();
}

export function sanitizeAnimateScenario(raw: string): string {
  let text = String(raw || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^\s*["«»']+|["«»']+\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length > ANIMATE_SCENARIO_MAX_CHARS) {
    text = text.slice(0, ANIMATE_SCENARIO_MAX_CHARS).replace(/\s+\S*$/, "").trim();
  }
  return text;
}

export function buildAnimateScenarioUserText(sourcePrompt: string): string {
  const prompt = sourcePrompt.trim();
  const lines = [
    "Invent a 4-second motion scenario for the attached photograph.",
    "Write in Russian. Return only the scenario.",
  ];
  if (prompt && !isGenericVideoPrompt(prompt)) {
    lines.push("", "ORIGINAL_IMAGE_PROMPT:", prompt);
  }
  return lines.join("\n");
}
