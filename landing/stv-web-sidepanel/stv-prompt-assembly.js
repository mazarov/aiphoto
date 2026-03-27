/**
 * Client-side mirror of legacy vibe prompt assembly (must stay in sync with server).
 * @see landing/src/lib/vibe-legacy-prompt-chain.ts
 * @see landing/src/lib/vibe-gemini-instructions.ts — assembleVibeFinalPrompt, CRITICAL_RULES, grooming tail
 */

export const LEGACY_VIBE_STYLE_FIELDS = [
  "scene",
  "genre",
  "pose",
  "lighting",
  "camera",
  "mood",
  "color",
  "clothing",
  "composition"
];

export const LEGACY_VIBE_FIELD_LABELS = {
  scene: "Scene",
  genre: "Genre",
  pose: "Pose",
  lighting: "Lighting",
  camera: "Camera",
  mood: "Mood",
  color: "Color",
  clothing: "Clothing",
  composition: "Composition"
};

const IMAGE_QUALITY_CRITICAL_BULLET =
  "- Photorealistic output, high textural detail, high quality, 8K-grade resolution and micro-detail (maximize sharpness and surface fidelity).";

const GENERATE_VIBE_CRITICAL_RULES_SINGLE = `
CRITICAL RULES
- Preserve: face structure, features, skin tone, eye color, proportions.
- Subject must look naturally photographed in the setting, not pasted.
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

function joinVibeFinalPromptParts(scene, criticalRules) {
  const body = String(scene ?? "").trimEnd();
  return `${body}\n\n${criticalRules}`.trim();
}

function detectGroomingSectionsInUnprefixedBody(body) {
  const b = String(body ?? "");
  const hair =
    b.includes("Hair styling (transfer from reference):") || b.includes("Hair styling (match reference shoot):");
  const makeup =
    b.includes("Makeup and skin (transfer from reference):") ||
    b.includes("Makeup and skin finish (match reference shoot):");
  return { hair, makeup };
}

function buildFlashImageGroomingRecencyTail(unprefixedBody) {
  const { hair, makeup } = detectGroomingSectionsInUnprefixedBody(unprefixedBody);
  if (!hair && !makeup) return "";
  const lines = [
    "LAST — must show in the output image (not optional wording):",
    "Hierarchy: B = who + natural hair color; A = hair styling + makeup (for this request). Ignore B's haircut/makeup pixels as the goal when they differ from A."
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

/**
 * @param {string} rawExpandedPrompt
 * @param {boolean} assumeReferenceImageLoaded
 */
export function assembleVibeFinalPrompt(rawExpandedPrompt, assumeReferenceImageLoaded = false) {
  const scene = String(rawExpandedPrompt ?? "").trimEnd();
  if (assumeReferenceImageLoaded) {
    const withCritical = joinVibeFinalPromptParts(scene, GENERATE_VIBE_CRITICAL_RULES_DUAL);
    return `${withCritical}${buildFlashImageGroomingRecencyTail(scene)}`.trim();
  }
  return joinVibeFinalPromptParts(scene, GENERATE_VIBE_CRITICAL_RULES_SINGLE);
}

/**
 * @param {Record<string, string>} style
 */
export function buildLegacyVibeFullPromptBody(style) {
  const parts = [];
  for (const field of LEGACY_VIBE_STYLE_FIELDS) {
    const text = String(style?.[field] ?? "").trim();
    if (!text) continue;
    parts.push(`${LEGACY_VIBE_FIELD_LABELS[field]}:\n${text}`);
  }
  return parts.join("\n\n").trim();
}

/**
 * @param {string} baseBody
 * @param {{ applyHair: boolean; applyMakeup: boolean }} policy
 */
export function appendLegacyGroomingPolicyBlocks(baseBody, policy) {
  const base = String(baseBody ?? "").trimEnd();
  const extras = [];
  if (policy.applyHair) {
    extras.push(
      "Hair styling (transfer from reference):\n" +
        "No conflict with identity: from IMAGE B take only face + natural hair COLOR/pigment (never copy A's hair color). From IMAGE A take the entire HAIR STYLING — silhouette, length impression, volume, parting, texture, finish.\n" +
        "Do not preserve B's haircut layout, part, or volume from B's pixels when they differ from A; B is not the styling reference for hair. Output must show A's hairstyle on B's head with B's natural pigment."
    );
  }
  if (policy.applyMakeup) {
    extras.push(
      "Makeup and skin (transfer from reference):\n" +
        "No conflict with identity: from IMAGE B take only facial structure and identity. From IMAGE A take the MAKEUP LOOK and skin/beauty finish (eyes, lips, brows, contour, matte vs glow).\n" +
        "Replace B's apparent makeup and skin finish in B's photo with A's groomed look on B's face — do not keep B's casual/unmade-up pixels as the target when A is clearly styled."
    );
  }
  if (!extras.length) return base;
  return `${base}\n\n${extras.join("\n\n")}`.trim();
}

/**
 * Normalize API style object for editor + legacy body (pose vs subject_pose).
 * @param {unknown} style
 */
export function normalizeLegacyStyleFromState(style) {
  /** @type {Record<string, string>} */
  const o = {};
  for (const field of LEGACY_VIBE_STYLE_FIELDS) {
    o[field] = "";
  }
  if (!style || typeof style !== "object") return o;
  const src = /** @type {Record<string, unknown>} */ (style);
  for (const field of LEGACY_VIBE_STYLE_FIELDS) {
    if (field === "pose") {
      o.pose = String(src.pose ?? src.subject_pose ?? "").trim();
    } else {
      o[field] = String(src[field] ?? "").trim();
    }
  }
  return o;
}

/**
 * @param {unknown} style
 * @param {{ applyHair: boolean; applyMakeup: boolean }} groomingPolicy
 */
export function buildUnprefixedGenerationBodyFromStyle(style, groomingPolicy) {
  const norm = normalizeLegacyStyleFromState(style);
  const styleBody = buildLegacyVibeFullPromptBody(norm);
  if (!styleBody) return "";
  return appendLegacyGroomingPolicyBlocks(styleBody, groomingPolicy);
}

/**
 * @param {string} unprefixedBody
 * @param {boolean} assumeTwoImages
 */
export function buildFinalPromptForUiPreview(unprefixedBody, assumeTwoImages) {
  return assembleVibeFinalPrompt(String(unprefixedBody ?? "").trimEnd(), assumeTwoImages);
}
