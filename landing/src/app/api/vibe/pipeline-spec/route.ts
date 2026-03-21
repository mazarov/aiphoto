import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import {
  EXTRACT_STYLE_INSTRUCTION,
  EXPAND_PROMPTS_INSTRUCTION,
  getGeminiVibeExpandModelRuntime,
  getGeminiVibeExtractModelRuntime,
  PHOTO_APP_CONFIG_KEY_VIBE_EXPAND_MODEL,
  PHOTO_APP_CONFIG_KEY_VIBE_EXTRACT_MODEL,
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
  const [extractModel, expandModel] = await Promise.all([
    getGeminiVibeExtractModelRuntime(supabase),
    getGeminiVibeExpandModelRuntime(supabase),
  ]);

  return NextResponse.json({
    extract: {
      configKey: PHOTO_APP_CONFIG_KEY_VIBE_EXTRACT_MODEL,
      envKey: "GEMINI_VIBE_EXTRACT_MODEL",
      model: extractModel,
      instruction: EXTRACT_STYLE_INSTRUCTION,
    },
    expand: {
      configKey: PHOTO_APP_CONFIG_KEY_VIBE_EXPAND_MODEL,
      envKey: "GEMINI_VIBE_EXPAND_MODEL",
      model: expandModel,
      instruction: EXPAND_PROMPTS_INSTRUCTION,
    },
  });
}
