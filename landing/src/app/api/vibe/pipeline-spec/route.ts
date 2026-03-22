import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import {
  getGeminiVibeExtractModelRuntime,
  getOpenAiVibeExtractModelRuntime,
  getVibeExtractLlmProvider,
  MIN_VIBE_SCENE_PROMPT_CHARS,
  PHOTO_APP_CONFIG_KEY_VIBE_EXTRACT_LLM,
  PHOTO_APP_CONFIG_KEY_VIBE_EXTRACT_MODEL,
  PHOTO_APP_CONFIG_KEY_VIBE_OPENAI_EXTRACT_MODEL,
} from "@/lib/vibe-gemini-instructions";
import { LEGACY_EXTRACT_PROMPT_2C23CE94, LEGACY_EXPAND_PROMPT_2C23CE94 } from "@/lib/vibe-legacy-prompt-chain";
import { PHOTO_APP_CONFIG_KEY_VIBE_LEGACY_PROMPT_CHAIN_2C23 } from "@/lib/vibe-legacy-config";

/**
 * Resolved extract model + instructions. Expand is scene passthrough (no LLM).
 */
export async function GET(request: NextRequest) {
  const { user, error: authError } = await getSupabaseUserForApiRoute(request);
  if (authError || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseServer();
  const [extractLlm, geminiExtractModel, openAiExtractModel] = await Promise.all([
    getVibeExtractLlmProvider(supabase),
    getGeminiVibeExtractModelRuntime(supabase),
    getOpenAiVibeExtractModelRuntime(supabase),
  ]);

  return NextResponse.json({
    extract: {
      llmProvider: extractLlm,
      providerConfigKey: PHOTO_APP_CONFIG_KEY_VIBE_EXTRACT_LLM,
      providerEnvKey: "VIBE_EXTRACT_LLM",
      gemini: {
        configKey: PHOTO_APP_CONFIG_KEY_VIBE_EXTRACT_MODEL,
        envKey: "GEMINI_VIBE_EXTRACT_MODEL",
        model: geminiExtractModel,
      },
      openai: {
        configKey: PHOTO_APP_CONFIG_KEY_VIBE_OPENAI_EXTRACT_MODEL,
        envKey: "VIBE_OPENAI_EXTRACT_MODEL",
        model: openAiExtractModel,
      },
      modelUsed: extractLlm === "openai" ? openAiExtractModel : geminiExtractModel,
      promptChain: "legacy_2c23",
      legacyConfigKey: PHOTO_APP_CONFIG_KEY_VIBE_LEGACY_PROMPT_CHAIN_2C23,
      instruction: LEGACY_EXTRACT_PROMPT_2C23CE94,
    },
    expand: {
      mode: "scene_literal",
      llmProvider: "none",
      modelUsed: "passthrough",
      mergedPromptSource: "all non-empty legacy style fields → labeled sections (buildLegacyVibeFullPromptBody)",
      finalPrompt:
        "assembleVibeFinalPrompt(scene, willAttachReferenceInline) — dual + grooming markers in body → extra LAST block after CRITICAL RULES",
      referenceForHistoricalPrompts: "LEGACY_EXPAND_PROMPT_2C23CE94 / merge — не используются в POST /api/vibe/expand",
      historicalAccentExpandInstruction: LEGACY_EXPAND_PROMPT_2C23CE94,
      groomingMinCharsNote: `MIN_VIBE_SCENE_PROMPT_CHARS (${MIN_VIBE_SCENE_PROMPT_CHARS}) — только для grooming-хелперов.`,
    },
  });
}
