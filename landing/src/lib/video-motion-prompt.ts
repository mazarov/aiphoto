const MOTION_WRAPPER =
  "Animate this still photograph into a short living-photo video. Preserve the same person, face, clothing, composition, camera distance, and background. Add only subtle natural motion: breathing, hair, fabric, light, and a nearly static camera. Do not change identity, outfit, scene, or add new objects.";

export function assembleVideoMotionPrompt(rawPrompt: string): string {
  const user = rawPrompt.trim();
  if (!user) return MOTION_WRAPPER;
  return `${MOTION_WRAPPER}\nUser motion request: ${user}`;
}
