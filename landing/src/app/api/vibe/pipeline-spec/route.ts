import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import {
  getGeminiVibeExpandModelRuntime,
  getGeminiVibeExtractModelRuntime,
  getOpenAiVibeExpandModelRuntime,
  getOpenAiVibeExtractModelRuntime,
  getVibeExpandLlmProvider,
  getVibeExtractLlmProvider,
  MIN_VIBE_SCENE_PROMPT_CHARS,
  PHOTO_APP_CONFIG_KEY_VIBE_EXPAND_LLM,
  PHOTO_APP_CONFIG_KEY_VIBE_EXPAND_MODEL,
  PHOTO_APP_CONFIG_KEY_VIBE_EXTRACT_LLM,
  PHOTO_APP_CONFIG_KEY_VIBE_EXTRACT_MODEL,
  PHOTO_APP_CONFIG_KEY_VIBE_OPENAI_EXPAND_MODEL,
  PHOTO_APP_CONFIG_KEY_VIBE_OPENAI_EXTRACT_MODEL,
} from "@/lib/vibe-gemini-instructions";
import {
  LEGACY_EXPAND_PROMPT_2C23CE94,
  LEGACY_EXTRACT_PROMPT_2C23CE94,
} from "@/lib/vibe-legacy-prompt-chain";
import { PHOTO_APP_CONFIG_KEY_VIBE_LEGACY_PROMPT_CHAIN_2C23 } from "@/lib/vibe-legacy-config";

/**
 * Resolved models + legacy instructions (for extension / docs / debugging).
 */
export async function GET(request: NextRequest) {
  const { user, error: authError } = await getSupabaseUserForApiRoute(request);
  if (authError || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseServer();
  const [extractLlm, expandLlm, geminiExtractModel, geminiExpandModel, openAiExtractModel, openAiExpandModel] =
    await Promise.all([
      getVibeExtractLlmProvider(supabase),
      getVibeExpandLlmProvider(supabase),
      getGeminiVibeExtractModelRuntime(supabase),
      getGeminiVibeExpandModelRuntime(supabase),
      getOpenAiVibeExtractModelRuntime(supabase),
      getOpenAiVibeExpandModelRuntime(supabase),
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
      llmProvider: expandLlm,
      providerConfigKey: PHOTO_APP_CONFIG_KEY_VIBE_EXPAND_LLM,
      providerEnvKey: "VIBE_EXPAND_LLM",
      gemini: {
        configKey: PHOTO_APP_CONFIG_KEY_VIBE_EXPAND_MODEL,
        envKey: "GEMINI_VIBE_EXPAND_MODEL",
        model: geminiExpandModel,
      },
      openai: {
        configKey: PHOTO_APP_CONFIG_KEY_VIBE_OPENAI_EXPAND_MODEL,
        envKey: "VIBE_OPENAI_EXPAND_MODEL",
        model: openAiExpandModel,
      },
      modelUsed: expandLlm === "openai" ? openAiExpandModel : geminiExpandModel,
      promptChain: "legacy_2c23",
      accentExpandInstruction: LEGACY_EXPAND_PROMPT_2C23CE94,
      note: "Merge step uses VIBE_MERGE_ACCENT_PROMPTS_INSTRUCTION in vibe-legacy-prompt-chain.ts.",
      groomingMinCharsNote: `MIN_VIBE_SCENE_PROMPT_CHARS (${MIN_VIBE_SCENE_PROMPT_CHARS}) applies to grooming helpers only; legacy expand does not use verbatim-from-StylePayload.`,
    },
  });
}
