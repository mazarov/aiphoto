import { DEFAULT_VIDEO_PROMPT } from "@/lib/generation/image-options";

export const ANIMATE_SCENARIO_MODEL = "gemini-2.5-flash";
export const ANIMATE_SCENARIO_MAX_CHARS = 400;
export const ANIMATE_SCENARIO_PLACEHOLDER = "Придумываю сценарий…";

export const ANIMATE_SCENARIO_SYSTEM_PROMPT = [
  "You invent a 4-second image-to-video motion beat.",
  "The photograph is the only source of truth.",
  "Do not restate appearance, clothing, hair, age, beauty, or body.",
  "",
  "Write 1-2 sentences in Russian that describe physical motion already possible in THIS still frame.",
  "Keep the same person, face, clothing, setting, crop, and camera distance.",
  "",
  "Allowed: breath, gaze, a small gesture implied by the pose, hair or fabric already in frame, weather already visible.",
  "Forbidden: new camera angle, zoom that changes crop, walking out of frame, new people, outfit or location change, on-screen text, a twist that needs a new viewpoint.",
  "",
  "No titles, quotes, markdown, or explanation. Return only the scenario.",
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

export function buildAnimateScenarioUserText(_sourcePrompt?: string): string {
  return [
    "Describe only the motion for the attached photograph.",
    "Write in Russian. Return only the scenario.",
    "Do not describe the person's looks.",
  ].join("\n");
}
