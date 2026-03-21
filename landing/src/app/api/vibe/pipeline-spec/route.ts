import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import {
  EXTRACT_STYLE_INSTRUCTION,
  EXPAND_PROMPTS_INSTRUCTION,
  getGeminiVibeExpandModelRuntime,
  getGeminiVibeExtractModelRuntime,
  getOpenAiVibeExpandModelRuntime,
  getOpenAiVibeExtractModelRuntime,
  getVibeExpandLlmProvider,
  getVibeExtractLlmProvider,
  getVibeOneShotExtractPromptEnabled,
  ONE_SHOT_EXTRACT_PROMPT_INSTRUCTION,
  PHOTO_APP_CONFIG_KEY_VIBE_EXPAND_LLM,
  PHOTO_APP_CONFIG_KEY_VIBE_EXPAND_MODEL,
  PHOTO_APP_CONFIG_KEY_VIBE_EXTRACT_LLM,
  PHOTO_APP_CONFIG_KEY_VIBE_EXTRACT_MODEL,
  PHOTO_APP_CONFIG_KEY_VIBE_ONE_SHOT_EXTRACT_PROMPT,
  PHOTO_APP_CONFIG_KEY_VIBE_OPENAI_EXPAND_MODEL,
  PHOTO_APP_CONFIG_KEY_VIBE_OPENAI_EXTRACT_MODEL,
} from "@/lib/vibe-gemini-instructions";

/**
 * Full system instructions + resolved models (for extension / docs / debugging).
 */
export async function GET(request: NextRequest) {
  const { user, error: authError } = await getSupabaseUserForApiRoute(request);
  if (authError || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseServer();
  const [
    extractLlm,
    expandLlm,
    geminiExtractModel,
    geminiExpandModel,
    openAiExtractModel,
    openAiExpandModel,
    oneShotExtractPrompt,
  ] = await Promise.all([
    getVibeExtractLlmProvider(supabase),
    getVibeExpandLlmProvider(supabase),
    getGeminiVibeExtractModelRuntime(supabase),
    getGeminiVibeExpandModelRuntime(supabase),
    getOpenAiVibeExtractModelRuntime(supabase),
    getOpenAiVibeExpandModelRuntime(supabase),
    getVibeOneShotExtractPromptEnabled(supabase),
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
      instruction: EXTRACT_STYLE_INSTRUCTION,
      oneShot: {
        enabled: oneShotExtractPrompt,
        configKey: PHOTO_APP_CONFIG_KEY_VIBE_ONE_SHOT_EXTRACT_PROMPT,
        envKey: "VIBE_ONE_SHOT_EXTRACT_PROMPT",
        instruction: ONE_SHOT_EXTRACT_PROMPT_INSTRUCTION,
      },
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
      instruction: EXPAND_PROMPTS_INSTRUCTION,
    },
  });
}
