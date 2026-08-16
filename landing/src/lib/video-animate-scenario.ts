import { DEFAULT_VIDEO_PROMPT } from "@/lib/generation/image-options";

export const ANIMATE_SCENARIO_MODEL = "gemini-2.5-flash";
export const ANIMATE_SCENARIO_MAX_CHARS = 400;
export const ANIMATE_SCENARIO_PLACEHOLDER = "Придумываю сценарий…";

export const ANIMATE_SCENARIO_SYSTEM_PROMPT = [
  "You invent a 4-second image-to-video scenario that people would want to send to a friend or post in a story.",
  "The photograph is the only source of truth. The original image prompt is supporting context only.",
  "",
  "Write exactly 2 sentences in Russian:",
  "1) the hook — a specific visible action that starts in the first second;",
  "2) the payoff — a twist, reaction, or cinematic accent by second 4.",
  "",
  "Make it shareable: one clear beat with attitude, humor, tension, beauty, or surprise.",
  "It must feel like a clip someone would replay, not a living-photo loop.",
  "",
  "Forbidden bland defaults: only breathing, only blinking, only fabric sway, only a slight camera move, only flickering light, only 'subtle natural motion'.",
  "",
  "Keep the same person, face, clothing, setting, and camera distance.",
  "Do not add people, swap locations, change the outfit, or write on-screen text.",
  "Ground the action in what is already in the frame (pose, gaze, props, weather, clothes) and amplify it into a moment.",
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

export function buildAnimateScenarioUserText(sourcePrompt: string): string {
  const prompt = sourcePrompt.trim();
  const lines = [
    "Invent a shareable 4-second motion beat for the attached photograph.",
    "Write in Russian. Return only the scenario.",
    "It must feel like a clip someone would repost, not a subtle living photo.",
  ];
  if (prompt && !isGenericVideoPrompt(prompt)) {
    lines.push("", "ORIGINAL_IMAGE_PROMPT:", prompt);
  }
  return lines.join("\n");
}
