/**
 * Pure image-generation prompt assembly shared by Landing previews and the
 * standalone generation worker. Keep database/env access out of this module.
 */

export const VIBE_IMAGE_PART_LABEL_REFERENCE = `
[IMAGE A — STYLE REFERENCE ONLY]
The NEXT part is a photograph used ONLY as a recipe: pose, lighting, wardrobe style, hair styling, makeup/beauty look, background, camera, color grade, mood.
It is NOT the person to depict in the output. Do NOT copy this person's face, bone structure, skin, eyes, or hair color as the result identity.
`.trim();

export const VIBE_IMAGE_PART_LABEL_SUBJECT = `
[IMAGE B — SUBJECT / USER IDENTITY]
The NEXT image is the ONLY source for WHO the person is: face shape, bone structure, features, eyes, skin undertone, age, body, and natural HAIR COLOR/pigment (never use A's hair color).
It is NOT the styling source for hair layout or makeup when the long text below includes "Hair styling (transfer from reference)" and/or "Makeup and skin (transfer from reference)": then hair STYLING and MAKEUP LOOK come from IMAGE A, not from B's pixels — only B's identity + hair pigment stay from B.
If those grooming sections are absent in the text, keep B's casual hair and face as in B.
The output must read as B's face, not A's. If it looks like A's face, you FAILED.
Ignore B's pose, head tilt, and camera angle when they conflict with IMAGE A — re-pose to match A's geometry and the scene.
`.trim();

const IMAGE_QUALITY_CRITICAL_BULLET =
  "- Photorealistic output, high textural detail, high quality, 8K-grade resolution and micro-detail (maximize sharpness and surface fidelity).";

const GENERATE_VIBE_CRITICAL_RULES_SINGLE = `
CRITICAL RULES
- Preserve: face structure, features, skin tone, eye color, proportions.
- Subject must look naturally photographed in the setting, not pasted.
${IMAGE_QUALITY_CRITICAL_BULLET}
`.trim();

export const GENERATE_LANDING_CARD_CRITICAL_RULES = `
CRITICAL RULES
The input image(s) show the SUBJECT (a real person). Output exactly one new photorealistic photograph of that same person following the text description above (the prompt).

- Identity: preserve the same person — face structure, features, skin tone, eye color, body proportions, natural hair color from the input. Do not swap in a different face or body.
- Wardrobe — fully replace clothing: ignore the apparel, shoes, and visible accessories in the input photo as the outfit to keep. Treat input clothing as something to discard unless the text explicitly says to preserve it. Dress the subject exactly as the text prompt describes — fully change the outfit to match the prompt; do not default to copying the T-shirt, hoodie, jeans, dress, or shoes from the upload. If the text names specific garments, colors, or style, the output must show those.
- Result must look naturally photographed, not pasted or flatly composited.
${IMAGE_QUALITY_CRITICAL_BULLET}
`.trim();

const GENERATE_VIBE_CRITICAL_RULES_DUAL = `
CRITICAL RULES
Earlier parts were labeled: IMAGE A = style reference (not the output identity); IMAGE B = subject (only identity). Output one new photograph of B as if shot in A's session — A's pose, light, set, wardrobe, and grade on B. Not a face-swap or lazy crop.

- Scene / Genre / Mood (and similar prose) were written from the reference image and may still mention hair, face, or skin. Treat that as **setting and atmosphere only**. They must NOT replace IMAGE B's face, natural hair color, hair length, or resting hairstyle. If there is **no** "Hair styling (transfer from reference):" section in the text, keep B's real hair from B's photo — ignore any hair adjectives in Scene. If that section **is** present, take hair **styling** from A and natural **pigment** from B (as below).
- Split sources: from B = identity (face, bones, eyes, body) + natural HAIR COLOR only. From A = hair STYLING and MAKEUP LOOK when the text includes the grooming-transfer sections — then do not treat B's hairstyle or makeup in B's photo as the target; override them with A's styled look while keeping B's face and hair pigment.
- If grooming transfer is requested, the change must read clearly in pixels — B must not look like an unstyled snapshot of B when A is clearly groomed.
- Grooming = beauty finish only — does not override torso/head angles from A or the scene.
- Wardrobe, set, light, camera, palette: match A + scene on B.
${IMAGE_QUALITY_CRITICAL_BULLET}
`.trim();

function joinFinalPromptParts(scene: string, criticalRules: string): string {
  const body = String(scene ?? "").trimEnd();
  return `${body}\n\n${criticalRules}`.trim();
}

function groomingRecencyTail(unprefixedBody: string): string {
  const body = String(unprefixedBody ?? "");
  const hair =
    body.includes("Hair styling (transfer from reference):") ||
    body.includes("Hair styling (match reference shoot):");
  const makeup =
    body.includes("Makeup and skin (transfer from reference):") ||
    body.includes("Makeup and skin finish (match reference shoot):");
  if (!hair && !makeup) return "";

  const lines = [
    "LAST — must show in the output image (not optional wording):",
    "Hierarchy: B = who + natural hair color; A = hair styling + makeup (for this request). Ignore B's haircut/makeup pixels as the goal when they differ from A.",
  ];
  if (hair) {
    lines.push(
      "• Hair: visibly match IMAGE A's styling (silhouette, volume, parting, finish) on B's head; keep only B's natural pigment — not B's original layout from the photo."
    );
  }
  if (makeup) {
    lines.push(
      "• Face: visibly match IMAGE A's makeup and skin finish on B — replace B's casual look, do not clone B's bare/casual face from the input."
    );
  }
  return `\n\n${lines.join("\n")}`;
}

export function assembleVibeFinalPrompt(
  rawExpandedPrompt: string,
  assumeReferenceImageLoaded = false
): string {
  const scene = String(rawExpandedPrompt ?? "").trimEnd();
  if (assumeReferenceImageLoaded) {
    const withCritical = joinFinalPromptParts(scene, GENERATE_VIBE_CRITICAL_RULES_DUAL);
    return `${withCritical}${groomingRecencyTail(scene)}`.trim();
  }
  return joinFinalPromptParts(scene, GENERATE_VIBE_CRITICAL_RULES_SINGLE);
}

export function assembleLandingCardFinalPrompt(rawCardPrompt: string): string {
  return joinFinalPromptParts(
    String(rawCardPrompt ?? "").trimEnd(),
    GENERATE_LANDING_CARD_CRITICAL_RULES
  );
}
