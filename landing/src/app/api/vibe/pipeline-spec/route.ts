import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import {
  EXTRACT_STYLE_INSTRUCTION,
  EXPAND_PROMPTS_INSTRUCTION,
  getGeminiVibeExtractModel,
  getGeminiVibeExpandModel,
} from "@/lib/vibe-gemini-instructions";

/**
 * Full system instructions + resolved models (for extension / docs / debugging).
 */
export async function GET(request: NextRequest) {
  const { user, error: authError } = await getSupabaseUserForApiRoute(request);
  if (authError || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    extract: {
      envKey: "GEMINI_VIBE_EXTRACT_MODEL",
      model: getGeminiVibeExtractModel(),
      instruction: EXTRACT_STYLE_INSTRUCTION,
    },
    expand: {
      envKey: "GEMINI_VIBE_EXPAND_MODEL",
      model: getGeminiVibeExpandModel(),
      instruction: EXPAND_PROMPTS_INSTRUCTION,
    },
  });
}
