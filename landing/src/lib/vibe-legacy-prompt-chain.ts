/**
 * Steal-This-Vibe legacy style shape from commit 2c23ce94 (8-field extract).
 * POST /api/vibe/expand passthrough: full labeled body from all non-empty fields (no text LLM). Legacy accent expand + merge helpers remain for reference / tooling.
 */

import { parseGeminiJsonArray, parseGeminiJsonObject } from "@/lib/gemini-vibe-debug-log";
import type { GroomingPolicy } from "@/lib/vibe-grooming-assembly";
import { openAiChatCompletionText } from "@/lib/vibe-llm-openai";

export const LEGACY_VIBE_STYLE_FIELDS = [
  "scene",
  "genre",
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
  lighting: "Lighting",
  camera: "Camera",
  mood: "Mood",
  color: "Color",
  clothing: "Clothing",
  composition: "Composition",
};

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
 */
export function appendLegacyGroomingPolicyBlocks(baseBody: string, policy: GroomingPolicy): string {
  const base = String(baseBody ?? "").trimEnd();
  const extras: string[] = [];
  if (policy.applyHair) {
    extras.push(
      "Hair styling (transfer from reference):\n" +
        "Restyle the subject's hair to match the reference photograph — silhouette, volume, parting, and finish — while keeping the subject's natural hair color from their identity photo (see image-gen rules).",
    );
  }
  if (policy.applyMakeup) {
    extras.push(
      "Makeup and skin (transfer from reference):\n" +
        "Match makeup intensity, eye look, lip finish, and skin finish to the reference photograph on the subject's face.",
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

- scene: What is depicted (subject, setting, action). 1-2 sentences.
- genre: The photographic genre (fashion editorial, street photography, portrait, etc.)
- lighting: Describe the lighting setup, direction, quality, color temperature.
- camera: Lens, focal length, depth of field, angle, distance.
- mood: The emotional tone and atmosphere.
- color: Color palette, grading, contrast, saturation levels.
- clothing: What the subject is wearing (if applicable, empty string if not).
- composition: Framing, rule of thirds, negative space, leading lines.

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

/** If DB style JSON is legacy 8-field shape, coerce; else null. */
export function legacyStyleFromUnknownRowStyle(style: unknown): LegacyVibeStylePayload | null {
  return coerceLegacyVibeStylePayload(style);
}
