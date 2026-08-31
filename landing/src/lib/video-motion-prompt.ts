/** I2V user beat only — catalog photo extracts are not a Grok/Veo motion request. */
export const VIDEO_I2V_USER_PROMPT_MAX_CHARS = 400;

const PHOTO_SECTION_HEADING =
  /^(Visual Hook|Scene|Genre|Pose|Lighting|Camera|Mood|Color|Clothing|Makeup|Composition|Avoid):$/;

export function looksLikeStructuredPhotoPrompt(text: string): boolean {
  const value = String(text || "");
  if (/^Visual Hook:/m.test(value) || /^CRITICAL RULES/m.test(value)) return true;
  return /^Scene:/m.test(value) && /^Genre:/m.test(value) && /^Pose:/m.test(value);
}

export function extractVideoMotionSection(text: string): string {
  const lines = String(text || "").split("\n");
  let start = -1;
  let firstRest = "";
  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (trimmed === "Motion:" || trimmed.startsWith("Motion:")) {
      start = i;
      firstRest = trimmed.replace(/^Motion:\s*/, "").trim();
      break;
    }
  }
  if (start < 0) return "";
  const body: string[] = [];
  if (firstRest) body.push(firstRest);
  for (let j = start + 1; j < lines.length; j += 1) {
    const trimmed = lines[j].trim();
    if (trimmed === "CRITICAL RULES" || PHOTO_SECTION_HEADING.test(trimmed)) break;
    body.push(lines[j]);
  }
  return body.join("\n").trim();
}

function clampI2vUserPrompt(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= VIDEO_I2V_USER_PROMPT_MAX_CHARS) return normalized;
  return normalized
    .slice(0, VIDEO_I2V_USER_PROMPT_MAX_CHARS)
    .replace(/\s+\S*$/, "")
    .trim();
}

/** Provider-facing motion only. Catalog Visual Hook / Pose / Avoid never go to I2V. */
export function videoI2vUserPrompt(raw: string): string {
  const text = String(raw || "").trim();
  if (!text) return "";
  const motion = extractVideoMotionSection(text);
  if (motion) return clampI2vUserPrompt(motion);
  if (looksLikeStructuredPhotoPrompt(text)) return "";
  return clampI2vUserPrompt(text);
}

const MOTION_WRAPPER = [
  "[# Sources @Image1]",
  "Use Image1 as the starting frame of the video. Animate this exact photograph.",
  "Do not treat the image as a style, character, or beauty reference to redraw.",
  "",
  "IDENTITY LOCK — non-negotiable:",
  "- Keep the same person: face, bone structure, eyes, skin, hair, age, and body.",
  "- Keep the same clothing, accessories, setting, lighting, and camera distance.",
  "- Do not change identity, outfit, or location, and do not add people or objects.",
  "- Do not reframe, zoom to a new crop, or invent a camera angle that shows unseen sides of the face.",
  "- If the output canvas has a different aspect ratio, extend only empty background. Never regenerate the face or body to fill the frame.",
  "",
  "MOTION:",
  "- Only move what is already visible in the starting frame.",
  "- The user request describes motion of this same shot, not a new scene.",
].join("\n");

export function assembleVideoMotionPrompt(rawPrompt: string): string {
  const user = videoI2vUserPrompt(rawPrompt);
  if (!user) return MOTION_WRAPPER;
  return `${MOTION_WRAPPER}\nUser motion request: ${user}`;
}

const GROK_MOTION_WRAPPER = [
  "Use the provided image as the exact starting frame of the video.",
  "Animate this photograph. Do not redraw, restyle, or treat it as a character reference.",
  "",
  "Identity lock:",
  "- Keep the same person: face, bone structure, eyes, skin, hair, age, and body.",
  "- Keep the same clothing, accessories, setting, lighting, and camera distance.",
  "- Do not change identity, outfit, or location, and do not add people or objects.",
  "- Do not reframe, zoom to a new crop, or invent a camera angle that shows unseen sides of the face.",
  "- If the output canvas has a different aspect ratio, extend only empty background. Never regenerate the face or body to fill the frame.",
  "",
  "Motion:",
  "- Only move what is already visible in the starting frame.",
  "- The user request describes motion of this same shot, not a new scene.",
].join("\n");

function assemblePlainMotionPrompt(rawPrompt: string): string {
  const user = videoI2vUserPrompt(rawPrompt);
  if (!user) return GROK_MOTION_WRAPPER;
  return `${GROK_MOTION_WRAPPER}\nUser motion request: ${user}`;
}

/** Grok/xAI image-to-video prompt. No Gemini [# Sources] tags. */
export function assembleGrokVideoMotionPrompt(rawPrompt: string): string {
  return assemblePlainMotionPrompt(rawPrompt);
}

/** Veo 3.1 Lite image-to-video prompt. Same identity lock, no Gemini source tags. */
export function assembleVeoVideoMotionPrompt(rawPrompt: string): string {
  return assemblePlainMotionPrompt(rawPrompt);
}

/** Seedance 2.5 image-to-video prompt. Same identity lock, no Gemini source tags. */
export function assembleSeedanceVideoMotionPrompt(rawPrompt: string): string {
  return assemblePlainMotionPrompt(rawPrompt);
}
