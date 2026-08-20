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

const MOTION_WRAPPER_WITH_IDENTITY = [
  "[# Sources @Image1] [# References @Image2]",
  "Use Image1 as the starting frame of the video. Animate this exact photograph.",
  "Use Image2 as a reference for the person's identity only. Image2 is not the starting frame.",
  "Do not treat Image1 as a style, character, or beauty reference to redraw.",
  "",
  "IDENTITY LOCK — non-negotiable:",
  "- Keep the person from Image2: face, bone structure, eyes, skin, hair, age, and body.",
  "- Keep Image1 clothing, accessories, setting, lighting, pose, and camera distance.",
  "- Do not change identity, outfit, or location, and do not add people or objects.",
  "- Do not reframe, zoom to a new crop, or invent a camera angle that shows unseen sides of the face.",
  "- If the output canvas has a different aspect ratio, extend only empty background. Never regenerate the face or body to fill the frame.",
  "",
  "MOTION:",
  "- Only move what is already visible in the starting frame.",
  "- The user request describes motion of this same shot, not a new scene.",
  "Use Image1 as the starting frame. Use Image2 as a reference for the video generation.",
].join("\n");

export function assembleVideoMotionPrompt(
  rawPrompt: string,
  options?: { hasIdentityReference?: boolean },
): string {
  const wrapper = options?.hasIdentityReference ? MOTION_WRAPPER_WITH_IDENTITY : MOTION_WRAPPER;
  const user = rawPrompt.trim();
  if (!user) return wrapper;
  return `${wrapper}\nUser motion request: ${user}`;
}
