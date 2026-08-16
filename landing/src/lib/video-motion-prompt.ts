const MOTION_WRAPPER =
  "Animate this still photograph into a 4-second video people would want to share. Preserve the same person, face, clothing, setting, and camera distance. Do not change identity, outfit, or location, and do not add new people or objects unless already implied by the frame. The user scenario is the main action: play it with a clear hook and payoff. Do not reduce it to breathing, blinking, or idle fabric motion.";

export function assembleVideoMotionPrompt(rawPrompt: string): string {
  const user = rawPrompt.trim();
  if (!user) return MOTION_WRAPPER;
  return `${MOTION_WRAPPER}\nUser motion request: ${user}`;
}
