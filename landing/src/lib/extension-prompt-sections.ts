export const SECTION_SPEC_ORDER = [
  "Visual Hook",
  "Scene",
  "Genre",
  "Pose",
  "Lighting",
  "Camera",
  "Mood",
  "Color",
  "Clothing",
  "Makeup",
  "Composition",
  "Avoid",
] as const;

export type ExtractStyle =
  | "photoreal"
  | "midjourney"
  | "sd"
  | "flux"
  | "nano"
  | "dalle";

const HEADER = `You are an expert AI image analyst and photographic art director.
Analyze the image and produce a structured scene description for an AI image generator.

Output ONLY the labeled sections below, in the exact specified order. Put each English label
on its own line and its description on the next line. No extra commentary or markdown fences.

Describe this specific image faithfully, not an idealized version. Preserve the actual pose,
head and torso direction, crop, subject scale, camera angle, garment construction, lighting,
background, palette, and composition. State concrete geometry before mood or style language.
Do not invent hidden limbs, contact points, accessories, or scene details. If a limb is
occluded, say "not visible". Report the true magnitude of bends and angles without softening.

Pose, Camera, and Composition must describe the same orientation, gaze, and framing. Camera
framing must include every body region named in Pose. Always produce every section exactly
once and finish every sentence.`;

const SECTION_SPECS: Record<(typeof SECTION_SPEC_ORDER)[number], string> = {
  "Visual Hook":
    "One concise art-direction sentence naming the image's distinctive must-survive aesthetic or silhouette. Do not catalogue literal scene, pose, clothing, or camera details.",
  Scene:
    'Where it is and what is happening in 1–2 sentences. Use "the subject" or "a person"; do not describe identity, facial features, age, skin tone, hair, or body type.',
  Genre:
    "The photographic genre, such as fashion editorial, street photography, portrait, boudoir, fitness, or documentary.",
  Pose:
    "One detailed paragraph. Begin with torso orientation relative to the lens and head-turn/gaze. Then describe shoulder line, torso lean, spine/back curvature and magnitude, visible arms/hands and contacts, hips/legs, and a final posture label. Preserve extreme bends explicitly. Describe only visible limbs; say not visible for occluded parts. No focal length or framing.",
  Lighting:
    "Key-light direction and hardness, fill/rim presence, color temperature, visible shadows and highlights. Be technically specific.",
  Camera:
    "Estimated full-frame focal-length range; framing scale; camera height; horizontal viewing angle consistent with Pose; depth of field and sharp/blurred regions. Preserve crop and subject scale.",
  Mood: "Emotional tone and atmosphere, with a brief interpretation.",
  Color:
    "Dominant/accent colors, color grade, contrast, saturation, and any cinematic grading treatment.",
  Clothing:
    "One detailed paragraph covering visible upper and lower garments, construction, neckline/sleeves/cut, colors/patterns, materials, fit/styling, jewelry, footwear, and worn accessories. Preserve distinctive structural details. Say not visible or none visible where appropriate.",
  Makeup:
    "Visible cosmetic application only: overall look, complexion finish, eyes, lips, brows, blush/highlight/contour. Say no visible makeup or not visible when appropriate; do not describe identity.",
  Composition:
    "Subject placement, exact crop and included regions, vertical position/horizon, foreground/midground/background, leading or framing elements, and negative space. Preserve the original composition.",
  Avoid:
    "A compact generator-ready list of relevant artifacts and anti-drift constraints: wrong pose/orientation, flattened spine, redesigned clothing, altered crop/camera/scale, invented props, distorted anatomy, plastic skin, cartoon/3D look, and inappropriate lighting.",
};

/** BCP-47 → English language name for the extract contract (`ru` → Russian). */
export function analyzeBodyLanguageName(locale: string): string {
  const lang = (locale.split("-")[0] || "en").trim().toLowerCase() || "en";
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(lang) || "English";
  } catch {
    return "English";
  }
}

/**
 * Headings stay English (remix / diagnostics). Bodies follow the request locale.
 * Must sit at the top of the extract prompt — a trailing "in ru" postfix loses to HEADER.
 */
export function buildExtractLanguageContract(locale: string): string {
  const bodyLanguage = analyzeBodyLanguageName(locale);
  return [
    "LANGUAGE (mandatory):",
    `- Keep every section heading exactly in English: ${SECTION_SPEC_ORDER.join(", ")}.`,
    `- Write every section body in ${bodyLanguage}. A section body is the text after each heading.`,
    `- Do not write section bodies in any other language.`,
    `- Latin camera units (mm) and the occlusion token "not visible" may stay as written.`,
  ].join("\n");
}

const TUNING: Record<Exclude<ExtractStyle, "photoreal">, string> = {
  midjourney:
    "Use vivid, evocative, keyword-rich wording inside the existing section bodies.",
  sd: "Use concrete keyword-friendly wording and natural quality vocabulary inside the existing section bodies.",
  flux:
    "Use clear, natural, complete descriptive sentences rather than tag lists.",
  nano:
    "Use clear, natural, slightly instructive language that plainly states what should appear.",
  dalle: "Use vivid, descriptive natural-language phrasing.",
};

export function buildExtractPrompt(style: ExtractStyle, locale = "en"): string {
  const bodyLanguage = analyzeBodyLanguageName(locale);
  const sections = SECTION_SPEC_ORDER.map(
    (label) =>
      `${label}:\nWrite the body in ${bodyLanguage}. ${SECTION_SPECS[label]}`,
  );
  const base = [
    buildExtractLanguageContract(locale),
    HEADER,
    ...sections,
    `LANGUAGE CHECK: every section body must be ${bodyLanguage}. Headings stay English.`,
  ].join("\n\n");
  if (style === "photoreal") return base;
  return `${base}\n\nModel tuning: keep every section and heading unchanged. ${TUNING[style]} Stay photorealistic and faithful to the image.`;
}
