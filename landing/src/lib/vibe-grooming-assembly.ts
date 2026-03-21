/**
 * Deterministic scene + reference-grooming assembly for vibe pipeline (no LLM).
 * @see docs/20-03-vibe-grooming-extension-controls.md
 */

export type GroomingReference = {
  hair: string;
  makeup: string;
};

export type GroomingPolicy = {
  applyHair: boolean;
  applyMakeup: boolean;
};

/** Hard caps for DB / API responses (abuse + accidental huge model output). */
export const MAX_VIBE_SCENE_CORE_CHARS = 50_000;
export const MAX_VIBE_GROOMING_SLOT_CHARS = 12_000;
/** scene + inserted grooming blocks + small margin */
export const MAX_VIBE_COMBINED_UNPREFIXED_CHARS = 100_000;

export type VibePersistValidationFailureReason =
  | "scene_too_long"
  | "hair_too_long"
  | "makeup_too_long"
  | "combined_too_long";

export type VibePersistValidation =
  | { ok: true; sceneCore: string; grooming: GroomingReference; combinedUnprefixed: string }
  | { ok: false; reason: VibePersistValidationFailureReason };

/**
 * Reject persist/response when model output exceeds caps (trim scene only).
 */
export function validateVibePersistParts(
  sceneCore: string,
  grooming: GroomingReference,
  combinedUnprefixed: string,
): VibePersistValidation {
  const scene = sceneCore.trim();
  if (scene.length > MAX_VIBE_SCENE_CORE_CHARS) return { ok: false, reason: "scene_too_long" };
  if (grooming.hair.length > MAX_VIBE_GROOMING_SLOT_CHARS) return { ok: false, reason: "hair_too_long" };
  if (grooming.makeup.length > MAX_VIBE_GROOMING_SLOT_CHARS) return { ok: false, reason: "makeup_too_long" };
  if (combinedUnprefixed.length > MAX_VIBE_COMBINED_UNPREFIXED_CHARS) {
    return { ok: false, reason: "combined_too_long" };
  }
  return {
    ok: true,
    sceneCore: scene,
    grooming: { hair: grooming.hair, makeup: grooming.makeup },
    combinedUnprefixed,
  };
}

function normalizeGroomingRef(raw: unknown): GroomingReference {
  if (!raw || typeof raw !== "object") return { hair: "", makeup: "" };
  const o = raw as Record<string, unknown>;
  const hair = typeof o.hair === "string" ? o.hair.trim() : "";
  const makeup = typeof o.makeup === "string" ? o.makeup.trim() : "";
  return { hair, makeup };
}

/** True if toggling hair/makeup can change the assembled body (both may be present). */
export function hasUsableGroomingReference(ref: GroomingReference | null | undefined): boolean {
  const r = ref ?? { hair: "", makeup: "" };
  return r.hair.length > 0 || r.makeup.length > 0;
}

export function parseGroomingReferenceFromRow(value: unknown): GroomingReference {
  if (value == null) return { hair: "", makeup: "" };
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return normalizeGroomingRef(parsed);
    } catch {
      return { hair: "", makeup: "" };
    }
  }
  if (typeof value === "object") return normalizeGroomingRef(value);
  return { hair: "", makeup: "" };
}

/**
 * Builds the grooming paragraph block (no leading/trailing extra newlines beyond join).
 */
export function buildGroomingInsert(ref: GroomingReference | null | undefined, policy: GroomingPolicy): string {
  const r = ref ?? { hair: "", makeup: "" };
  const parts: string[] = [];

  if (policy.applyHair) {
    if (r.hair) parts.push(`Hair styling (match reference shoot): ${r.hair}`);
  }
  if (policy.applyMakeup) {
    if (r.makeup) parts.push(`Makeup and skin finish (match reference shoot): ${r.makeup}`);
  }

  if (parts.length === 0) return "";
  return `\n\n${parts.join("\n\n")}`;
}

export type VibePromptAssemblyRow = {
  prompt_scene_core: string | null;
  grooming_reference: unknown;
  last_monolithic_prompt: string | null;
  prefilled_generation_prompt: string | null;
};

export type CombineVibeBodyResult = {
  /** Unprefixed body passed to assembleVibeFinalPrompt / stored as generation prompt_text for vibes. */
  combinedUnprefixed: string;
  /** When true, checkbox policy was applied; when false, monolith fallback (policy ignored). */
  usedSplitPath: boolean;
};

/**
 * §7.1: split path uses scene core + grooming insert; otherwise monolith from last_monolithic or prefilled.
 */
export function combineVibePromptBody(
  row: VibePromptAssemblyRow,
  policy: GroomingPolicy,
): CombineVibeBodyResult {
  const scene = String(row.prompt_scene_core ?? "").trim();
  if (scene.length > 0) {
    const ref = parseGroomingReferenceFromRow(row.grooming_reference);
    const groomingBlock = buildGroomingInsert(ref, policy);
    return { combinedUnprefixed: scene + groomingBlock, usedSplitPath: true };
  }

  const mono =
    String(row.last_monolithic_prompt ?? "").trim() ||
    String(row.prefilled_generation_prompt ?? "").trim();
  return { combinedUnprefixed: mono, usedSplitPath: false };
}

/** Default policy for first expand response (both on). */
export const DEFAULT_GROOMING_POLICY: GroomingPolicy = { applyHair: true, applyMakeup: true };

/**
 * Combined unprefixed body for expand/one-shot response when model returned split JSON.
 */
export function combineSceneAndGroomingForDefaultDisplay(scene: string, ref: GroomingReference): string {
  const trimmed = scene.trim();
  const block = buildGroomingInsert(ref, DEFAULT_GROOMING_POLICY);
  return trimmed + block;
}

/**
 * Parse expand / one-shot JSON: { prompt, grooming?: { hair, makeup } } or legacy array wrapper.
 * `minPromptChars` — caller supplies (e.g. MIN_VIBE_SCENE_PROMPT_CHARS).
 */
export function parseExpandStructuredResult(
  parsedObject: Record<string, unknown> | null,
  parsedArray: unknown[] | null,
  minPromptChars: number,
): { scene: string; grooming: GroomingReference } | null {
  if (parsedObject && typeof parsedObject.prompt === "string") {
    const scene = parsedObject.prompt.trim();
    if (scene.length < minPromptChars) return null;
    const grooming = normalizeGroomingRef(parsedObject.grooming);
    return { scene, grooming };
  }
  if (parsedArray?.length === 1) {
    const item = parsedArray[0];
    if (item && typeof item === "object") {
      const row = item as Record<string, unknown>;
      if (typeof row.prompt === "string") {
        const scene = row.prompt.trim();
        if (scene.length < minPromptChars) return null;
        const grooming = normalizeGroomingRef(row.grooming);
        return { scene, grooming };
      }
    }
  }
  return null;
}
