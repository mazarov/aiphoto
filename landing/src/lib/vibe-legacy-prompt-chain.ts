/**
 * Steal-This-Vibe legacy style shape from commit 2c23ce94 (extract) + **pose** field (9 keys).
 * POST /api/vibe/expand passthrough: full labeled body from all non-empty fields (no text LLM). Legacy accent expand + merge helpers remain for reference / tooling.
 */

import { parseGeminiJsonArray, parseGeminiJsonObject } from "@/lib/gemini-vibe-debug-log";
import type { GroomingPolicy } from "@/lib/vibe-grooming-assembly";
import { openAiChatCompletionText } from "@/lib/vibe-llm-openai";

export const LEGACY_VIBE_STYLE_FIELDS = [
  "scene",
  "genre",
  "pose",
  "lighting",
  "camera",
  "mood",
  "color",
  "clothing",
  "composition",
] as const;

export type LegacyVibeStyleField = (typeof LEGACY_VIBE_STYLE_FIELDS)[number];
export type LegacyVibeStylePayload = Record<LegacyVibeStyleField, string>;

/** Section titles for image-gen text built from extract JSON (order = {@link LEGACY_VIBE_STYLE_FIELDS}). */
export const LEGACY_VIBE_FIELD_LABELS: Record<LegacyVibeStyleField, string> = {
  scene: "Scene",
  genre: "Genre",
  pose: "Pose",
  lighting: "Lighting",
  camera: "Camera",
  mood: "Mood",
  color: "Color",
  clothing: "Clothing",
  composition: "Composition",
};

/** When `pose` is missing in stored JSON (pre–pose-field vibes), expand coerces to this so prompts stay valid. */
export const LEGACY_POSE_MISSING_BACKFILL =
  "Infer subject pose from the reference image: head orientation relative to camera and shoulders, torso angle, arm and hand placement, stance or seated posture, and weight distribution as visible.";

/**
 * Verbatim style text for expand → generate: every non-empty legacy field as a labeled block.
 * Skips empty strings (e.g. clothing N/A).
 */
export function buildLegacyVibeFullPromptBody(style: LegacyVibeStylePayload): string {
  const parts: string[] = [];
  for (const field of LEGACY_VIBE_STYLE_FIELDS) {
    const text = String(style[field] ?? "").trim();
    if (!text) continue;
    parts.push(`${LEGACY_VIBE_FIELD_LABELS[field]}:\n${text}`);
  }
  return parts.join("\n\n").trim();
}

/**
 * Extension checkboxes «волосы / макияж»: без отдельных колонок grooming в legacy — добавляем явные
 * англоязычные секции к телу промпта (перед `assembleVibeFinalPrompt`).
 * Section title lines (`Hair styling (transfer from reference):`, etc.) are referenced by
 * `VIBE_IMAGE_PART_LABEL_SUBJECT` in `vibe-gemini-instructions.ts` — keep titles in sync.
 */
export function appendLegacyGroomingPolicyBlocks(baseBody: string, policy: GroomingPolicy): string {
  const base = String(baseBody ?? "").trimEnd();
  const extras: string[] = [];
  if (policy.applyHair) {
    extras.push(
      "Hair styling (transfer from reference):\n" +
        "No conflict with identity: from IMAGE B take only face + natural hair COLOR/pigment (never copy A's hair color). From IMAGE A take the entire HAIR STYLING — silhouette, length impression, volume, parting, texture, finish.\n" +
        "Do not preserve B's haircut layout, part, or volume from B's pixels when they differ from A; B is not the styling reference for hair. Output must show A's hairstyle on B's head with B's natural pigment.",
    );
  }
  if (policy.applyMakeup) {
    extras.push(
      "Makeup and skin (transfer from reference):\n" +
        "No conflict with identity: from IMAGE B take only facial structure and identity. From IMAGE A take the MAKEUP LOOK and skin/beauty finish (eyes, lips, brows, contour, matte vs glow).\n" +
        "Replace B's apparent makeup and skin finish in B's photo with A's groomed look on B's face — do not keep B's casual/unmade-up pixels as the target when A is clearly styled.",
    );
  }
  if (!extras.length) return base;
  return `${base}\n\n${extras.join("\n\n")}`.trim();
}

export const LEGACY_PROMPT_ACCENTS = ["lighting", "mood", "composition"] as const;
export type LegacyPromptAccent = (typeof LEGACY_PROMPT_ACCENTS)[number];
export type LegacyPromptVariant = { accent: LegacyPromptAccent; prompt: string };

/** Exact vision instruction from git 2c23ce94:landing/src/app/api/vibe/extract/route.ts */
export const LEGACY_EXTRACT_PROMPT_2C23CE94 = `
Analyze this image and extract its visual style as a structured description.
Return a JSON object with these exact fields:

- scene: Where, environment, and what is happening — 1-2 sentences. Use a neutral subject label if needed ("the subject", "a person") but do NOT describe hair color, hair length, hair texture, facial features, skin tone, age, or body type here (those fields are for the reference model only and would wrongly override a different person's photo at generation time). Put pose in pose; put garments in clothing. Actions and props (mirror selfie, phone, walking, sitting) are OK without cataloguing the model's biometrics.
- genre: The photographic genre (fashion editorial, street photography, portrait, etc.)
- pose: One cohesive English paragraph for downstream IMAGE GENERATION. Describe ONLY the subject's physical pose and body geometry (not camera/lens — camera field; not placement inside the frame rectangle — composition field).
  Cover in order (omit a clause only if that body region is out of frame; say "not visible"):
  (1) Head vs torso: facing direction (toward camera / away / profile), head turn relative to shoulders, tilt (chin up or down, ear toward shoulder if any).
  (2) Shoulders and torso: square vs angled to camera, lean forward or back, twist, visible spine curve if any.
  (3) Arms and hands: positions, angles, and contacts (face, hair, hips, pockets, props, crossed arms, etc.); relaxed vs tense.
  (4) Hips and legs if visible: stance, which leg bears weight, knee bend, sitting or lying pose if applicable.
  (5) One short posture label if accurate (e.g. upright formal, relaxed slouch, contrapposto, arms-akimbo).
  Do NOT repeat the camera field: no focal length, mm, camera height relative to eyes, or horizontal viewing angle. Do NOT repeat composition-only framing (rule-of-thirds, negative space).
- lighting: Describe the lighting setup, direction, quality, color temperature.
- camera: One paragraph that MUST answer, in this order, using clear photographic terms (not vague words like "selfie angle" alone):
  (1) Estimated focal length class: ultra-wide / wide / normal / short tele / tele (give a plausible full-frame equivalent range in mm if inferable, else say "unknown").
  (2) Subject distance and framing scale: e.g. extreme close-up / close-up / bust / waist-up / full body / wide environmental (pick one).
  (3) Camera height relative to the subject's eyes: below eye level / eye level / slightly above / clearly above / overhead / ground level (pick one; justify briefly from the image).
  (4) Horizontal viewing angle: frontal (0°) / slight three-quarter (~20–35°) / strong three-quarter (~45–60°) / near-profile (~70–90°) / profile (pick one; justify using face or ears or nose symmetry and visible jawline).
  (5) Camera roll or tilt: level horizon vs Dutch tilt; if tilted, direction and approximate degrees only if confident.
  (6) Depth of field: shallow / moderate / deep; what is sharp vs blurred.
  If face or body geometry is ambiguous, state uncertainty explicitly (e.g. "uncertain between eye-level and slightly above") instead of guessing.
- mood: The emotional tone and atmosphere.
- color: Color palette, grading, contrast, saturation levels.
- clothing: One cohesive English paragraph for IMAGE GENERATION. Describe garments, jewelry, and worn accessories on the subject only (not pose — pose field; not body shape commentary unless it affects how cloth reads).
  Cover in order (say "not visible" if a region is out of frame; use empty string "" only if no clothing, jewelry, or worn accessories are visible at all, e.g. face-only crop with nothing worn visible):
  (1) Upper body: garment type(s) (e.g. tank, tee, shirt, blouse, sweater, jacket, coat), neckline/collar, sleeve length and cut, layers (under/over).
  (2) Lower body if visible: pants, skirt, shorts, dress continuation — cut (wide, slim, straight), rise if inferable.
  (3) Colors and patterns: name dominant and accent colors; stripes, checks, solid, print motif if any.
  (4) Material read: what the fabric looks like (denim, ribbed knit, leather, satin, mesh, fleece, linen, suit wool, etc.) even if approximate.
  (5) Fit and styling: tight / fitted / relaxed / oversized; cropped, tucked vs untucked, rolled cuffs, undone buttons, off-shoulder, etc.
  (6) Jewelry and piercings: earrings (studs, hoops, drops), necklaces/chokers/chains, rings, bracelets/bangles, anklets, visible piercings, brooches, pins, body chains — metal color (gold, silver, rose) and stones if any; say "none visible" if absent.
  (7) Other worn accessories: footwear if visible; headwear (cap, beanie, headband); belt; watch; eyeglasses/sunglasses; gloves; scarf; bag/handbag/clutch on body or strap crossing torso — one short phrase each or "none visible".
  Do NOT repeat pose geometry; do not describe background wardrobe on other people unless they are the main subject.
- composition: One cohesive paragraph written for downstream IMAGE GENERATION. The expand step does not rewrite this field — it is passed through verbatim under the label "Composition", so be concrete and actionable inside the picture frame only.
  Cover in order (skip a clause only if truly not applicable; say "not visible" when unsure):
  (1) Subject placement vs frame: centered, rule-of-thirds (name which intersection if clear), edge-weighted, or symmetrical balance.
  (2) Crop tightness and what is included: e.g. tight face, head-and-shoulders, waist-up, full figure, or environment-dominant; note headroom and chin room if relevant.
  (3) Vertical position of the subject in the frame (high / mid / low) and, if a horizon or strong horizontal is visible, whether it sits high or low in the frame.
  (4) Foreground / midground / background emphasis in one short phrase.
  (5) Leading lines, framing elements, or strong geometry — name them if present; otherwise "no strong leading lines".
  (6) Notable negative space: amount and side (left/right/top/bottom) if any.
  Do NOT repeat the camera field: no focal length, no mm equivalents, no camera-height-relative-to-eyes or horizontal viewing-angle analysis here — only how the scene is arranged inside the rectangle. One short cross-reference to the shot scale (e.g. "matches the waist-up framing implied above") is OK if it avoids duplicating lens/pose geometry.

Be specific and precise. Focus on reproducible visual attributes.
Return ONLY valid JSON, no markdown.
`.trim();

/** Text expand instruction from git 2c23ce94:landing/src/app/api/vibe/expand/route.ts */
export const LEGACY_EXPAND_PROMPT_2C23CE94 = `
You are a prompt engineer for AI image generation.

Given a structured style description of a photo, generate exactly 3 prompts for recreating this style with a different person's photo.

Each prompt must:
1. Include "the person in the provided reference photo" phrase
2. Be 1-3 sentences, 30-80 words
3. Focus on a different visual accent:
   - Prompt A: emphasize LIGHTING (direction, quality, color temperature, shadows)
   - Prompt B: emphasize MOOD (atmosphere, emotion, narrative)
   - Prompt C: emphasize COMPOSITION (framing, angles, spatial arrangement)
4. Include all style elements but weight the accent aspect more heavily
5. Be directly usable as a Gemini image generation prompt

Return ONLY valid JSON array with 3 objects and exact accents:
[
  { "accent": "lighting", "prompt": "..." },
  { "accent": "mood", "prompt": "..." },
  { "accent": "composition", "prompt": "..." }
]
`.trim();

export const VIBE_MERGE_ACCENT_PROMPTS_INSTRUCTION = `
You merge three accent-focused image-generation prompts into ONE cohesive English prompt for an image model.

Rules:
1. Output a single plain-text prompt only: 1–4 sentences. No JSON, no markdown, no bullet lists.
2. Preserve information from all three accents (lighting, mood, composition). Do not contradict lighting or composition; if mood conflicts with them, soften mood or describe a compromise in one short phrase.
3. Mention "the person in the provided reference photo" at most once (or rephrase once as subject + style reference compatible with a two-image setup: reference for style, separate photo for identity).
4. Target length roughly 200–900 characters. Be concise; remove duplicate boilerplate across the three inputs.

You will receive STYLE CONTEXT as JSON and three labeled lines [LIGHTING], [MOOD], [COMPOSITION].
`.trim();

const MERGED_MIN_CHARS = 40;
const MERGED_MAX_CHARS = 12_000;

export function coerceLegacyVibeStylePayload(input: unknown): LegacyVibeStylePayload | null {
  if (!input || typeof input !== "object") return null;
  const row = input as Record<string, unknown>;
  const style = {} as LegacyVibeStylePayload;
  for (const field of LEGACY_VIBE_STYLE_FIELDS) {
    if (field === "pose") {
      const value = row[field];
      if (typeof value === "string" && value.trim()) {
        style.pose = value.trim();
      } else {
        style.pose = LEGACY_POSE_MISSING_BACKFILL;
      }
      continue;
    }
    const value = row[field];
    if (typeof value !== "string") return null;
    const normalized = value.trim();
    if (!normalized && field !== "clothing") return null;
    style[field] = normalized;
  }
  return style;
}

export function coerceLegacyPromptVariants(input: unknown[]): LegacyPromptVariant[] | null {
  if (input.length !== 3) return null;
  const variants: LegacyPromptVariant[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    const accent = row.accent;
    const prompt = row.prompt;
    if (accent !== "lighting" && accent !== "mood" && accent !== "composition") return null;
    if (typeof prompt !== "string") return null;
    const normalized = prompt.trim();
    if (normalized.length < 8) return null;
    variants.push({ accent: accent as LegacyPromptAccent, prompt: normalized });
  }
  const dedup = new Set(variants.map((v) => v.accent));
  return dedup.size === 3 ? variants : null;
}

export function parseLegacyExpandVariantsFromLlmText(text: string): LegacyPromptVariant[] | null {
  const fromArray = parseGeminiJsonArray(text).value;
  if (fromArray && Array.isArray(fromArray)) {
    const v = coerceLegacyPromptVariants(fromArray);
    if (v) return v;
  }
  const obj = parseGeminiJsonObject(text).value;
  if (obj && typeof obj === "object") {
    const prompts = (obj as Record<string, unknown>).prompts;
    if (Array.isArray(prompts)) {
      const v = coerceLegacyPromptVariants(prompts);
      if (v) return v;
    }
  }
  return null;
}

export function buildLegacyExpandUserText(style: LegacyVibeStylePayload): string {
  return `${LEGACY_EXPAND_PROMPT_2C23CE94}\n\nStyle description:\n${JSON.stringify(style, null, 2)}`;
}

/** §5.4 mechanical merge: fixed accent order. */
export function mechanicalMergeLegacyVariants(variants: LegacyPromptVariant[]): string {
  const order: LegacyPromptAccent[] = ["lighting", "mood", "composition"];
  const by = new Map(variants.map((v) => [v.accent, v.prompt] as const));
  return order
    .map((a) => by.get(a))
    .filter((p): p is string => Boolean(p && p.trim()))
    .join("\n\n");
}

/** §11.5 п.1 fallback when merge is unavailable: lighting, else sorted first available. */
export function fallbackSinglePromptFromLegacyVariants(variants: LegacyPromptVariant[]): string {
  const by = Object.fromEntries(variants.map((v) => [v.accent, v.prompt])) as Record<string, string>;
  if (by.lighting?.trim()) return by.lighting.trim();
  for (const a of LEGACY_PROMPT_ACCENTS) {
    if (by[a]?.trim()) return by[a].trim();
  }
  return variants.map((v) => v.prompt).find((p) => p.trim()) || "";
}

function stripFencedMarkdown(text: string): string {
  const t = text.trim();
  const m = t.match(/^```(?:\w*)?\s*([\s\S]*?)\s*```$/);
  if (m?.[1]) return m[1].trim();
  return t;
}

function normalizeMergedText(raw: string): string {
  return stripFencedMarkdown(raw).replace(/\r\n/g, "\n").trim();
}

function buildMergeUserPayload(style: LegacyVibeStylePayload, variants: LegacyPromptVariant[]): string {
  const lines = variants.map((v) => `[${String(v.accent).toUpperCase()}] ${v.prompt}`);
  return `${VIBE_MERGE_ACCENT_PROMPTS_INSTRUCTION}

Style context (JSON):
${JSON.stringify(style, null, 2)}

Accent variants:
${lines.join("\n\n")}
`.trim();
}

export type LegacyMergeLlmResult = {
  merged: string;
  usedLlm: boolean;
  mergeModelUsed: string;
  fallbackReason?: string;
};

export async function runLegacyAccentMerge(params: {
  provider: "gemini" | "openai";
  geminiBaseUrl: string;
  model: string;
  apiKey: string;
  style: LegacyVibeStylePayload;
  variants: LegacyPromptVariant[];
}): Promise<LegacyMergeLlmResult> {
  const userText = buildMergeUserPayload(params.style, params.variants);
  const mergeModelUsed = params.model;

  if (params.provider === "openai") {
    const res = await openAiChatCompletionText({
      apiKey: params.apiKey,
      model: params.model,
      messages: [{ role: "user", content: userText }],
      timeoutMs: 90_000,
    });
    if (!res.ok) {
      return {
        merged: "",
        usedLlm: false,
        mergeModelUsed,
        fallbackReason: res.errorMessage ?? `openai_http_${res.status}`,
      };
    }
    const merged = normalizeMergedText(res.text);
    if (merged.length < MERGED_MIN_CHARS || merged.length > MERGED_MAX_CHARS) {
      return {
        merged: "",
        usedLlm: false,
        mergeModelUsed,
        fallbackReason: `openai_merge_len_${merged.length}`,
      };
    }
    return { merged, usedLlm: true, mergeModelUsed };
  }

  const geminiUrl = `${params.geminiBaseUrl.replace(/\/+$/, "")}/v1beta/models/${params.model}:generateContent`;
  let geminiRes: Response;
  try {
    geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": params.apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: userText }] }],
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 2048,
        },
      }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (err) {
    return {
      merged: "",
      usedLlm: false,
      mergeModelUsed,
      fallbackReason: err instanceof Error ? err.message : String(err),
    };
  }

  let geminiData: {
    error?: { message?: string };
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  try {
    geminiData = (await geminiRes.json()) as typeof geminiData;
  } catch {
    return {
      merged: "",
      usedLlm: false,
      mergeModelUsed,
      fallbackReason: "gemini_merge_body_not_json",
    };
  }

  if (!geminiRes.ok) {
    return {
      merged: "",
      usedLlm: false,
      mergeModelUsed,
      fallbackReason: geminiData?.error?.message ?? `gemini_http_${geminiRes.status}`,
    };
  }

  const text =
    geminiData?.candidates?.[0]?.content?.parts?.find((p) => typeof p.text === "string")?.text || "";
  const merged = normalizeMergedText(text);
  if (merged.length < MERGED_MIN_CHARS || merged.length > MERGED_MAX_CHARS) {
    return {
      merged: "",
      usedLlm: false,
      mergeModelUsed,
      fallbackReason: `gemini_merge_len_${merged.length}`,
    };
  }
  return { merged, usedLlm: true, mergeModelUsed };
}

export function resolveMergedPromptWithFallback(
  mergeResult: LegacyMergeLlmResult,
  variants: LegacyPromptVariant[],
): { mergedPrompt: string; mergeFallbackReason?: string } {
  if (mergeResult.merged) {
    return { mergedPrompt: mergeResult.merged };
  }
  const mechanical = mechanicalMergeLegacyVariants(variants);
  if (mechanical.length >= MERGED_MIN_CHARS) {
    return {
      mergedPrompt: mechanical,
      mergeFallbackReason: mergeResult.fallbackReason ?? "mechanical_merge",
    };
  }
  return {
    mergedPrompt: fallbackSinglePromptFromLegacyVariants(variants),
    mergeFallbackReason: mergeResult.fallbackReason ?? "single_accent_fallback",
  };
}

/** If DB style JSON is legacy shape (9 fields, or 8 without pose — backfilled), coerce; else null. */
export function legacyStyleFromUnknownRowStyle(style: unknown): LegacyVibeStylePayload | null {
  return coerceLegacyVibeStylePayload(style);
}
