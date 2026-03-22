import type { createSupabaseServer } from "@/lib/supabase";

export const VIBE_PROMPT_CHAIN_MODERN = "modern" as const;
export const VIBE_PROMPT_CHAIN_LEGACY_2C23 = "legacy_2c23" as const;

export type VibePromptChain = typeof VIBE_PROMPT_CHAIN_MODERN | typeof VIBE_PROMPT_CHAIN_LEGACY_2C23;

/** Global flag: new extracts use legacy 8-field chain; one-shot extract config is ignored. */
export const PHOTO_APP_CONFIG_KEY_VIBE_LEGACY_PROMPT_CHAIN_2C23 = "vibe_legacy_prompt_chain_2c23ce94";

function parseBooleanConfig(value: string | null | undefined, fallback: boolean): boolean {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return fallback;
  if (["true", "1", "yes", "y", "on"].includes(raw)) return true;
  if (["false", "0", "no", "n", "off"].includes(raw)) return false;
  return fallback;
}

/**
 * When true, POST /api/vibe/extract uses legacy vision JSON (8 fields) and sets prompt_chain = legacy_2c23.
 * Source of truth: photo_app_config only (migration sql/153_*.sql seeds default `false`).
 */
export async function getVibeLegacyPromptChainEnabled(
  supabase: ReturnType<typeof createSupabaseServer>,
): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("photo_app_config")
      .select("value")
      .eq("key", PHOTO_APP_CONFIG_KEY_VIBE_LEGACY_PROMPT_CHAIN_2C23)
      .maybeSingle();
    return parseBooleanConfig(data?.value, false);
  } catch {
    return false;
  }
}
