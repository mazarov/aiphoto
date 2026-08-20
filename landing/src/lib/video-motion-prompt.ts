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
  const user = rawPrompt.trim();
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

/** Grok/xAI image-to-video prompt. No Gemini [# Sources] tags. */
export function assembleGrokVideoMotionPrompt(rawPrompt: string): string {
  const user = rawPrompt.trim();
  if (!user) return GROK_MOTION_WRAPPER;
  return `${GROK_MOTION_WRAPPER}\nUser motion request: ${user}`;
}
