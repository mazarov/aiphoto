import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import {
  getGeminiApiBaseUrlForVibeRoutes,
  getGeminiVibeExpandModelRuntime,
} from "@/lib/vibe-gemini-instructions";
import { fetchErrorDetails } from "@/lib/gemini-vibe-debug-log";
import { VIBE_PROMPT_CHAIN_STV_ANTI_COPY_3STEP } from "@/lib/vibe-legacy-config";
import { coerceStvAntiCopyExtractionPayload } from "@/lib/vibe-stv-extraction-payload";
import { geminiGeneratePlainText, stripLeadingMarkdownFence } from "@/lib/vibe-stv-gemini-text";
import {
  STV_STYLE_REWRITE_STEP2_SYSTEM,
  buildStvStyleRewriteUserMessage,
} from "@/lib/vibe-stv-three-step-instructions";

function toErrorMeta(err: unknown) {
  if (!(err instanceof Error)) return { message: String(err) };
  return { name: err.name, message: err.message, stack: err.stack };
}

const MIN_SCENE_PROMPT_CHARS = 24;

export async function POST(req: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseUserForApiRoute(req);
    if (authError || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as { vibeId?: string };
    const vibeId = String(body?.vibeId || "").trim();
    if (!vibeId) {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    const supabase = createSupabaseServer();
    const { data: vibe, error: vibeError } = await supabase
      .from("vibes")
      .select("id,user_id,style,prompt_chain")
      .eq("id", vibeId)
      .single();

    if (vibeError || !vibe || vibe.user_id !== user.id) {
      return NextResponse.json({ error: "vibe_not_found" }, { status: 404 });
    }

    if (vibe.prompt_chain !== VIBE_PROMPT_CHAIN_STV_ANTI_COPY_3STEP) {
      return NextResponse.json(
        {
          error: "vibe_not_stv",
          message: "Use /api/vibe/expand for legacy_2c23 vibes.",
        },
        { status: 409 },
      );
    }

    const rawStyle = vibe.style as Record<string, unknown> | null;
    const stv = rawStyle ? coerceStvAntiCopyExtractionPayload(rawStyle) : null;
    if (!stv) {
      return NextResponse.json({ error: "invalid_stv_style" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "stv_llm_unconfigured" }, { status: 503 });
    }

    const modelUsed = await getGeminiVibeExpandModelRuntime(supabase);
    const baseUrl = await getGeminiApiBaseUrlForVibeRoutes(supabase);
    const jsonText = JSON.stringify(stv);
    const userText = buildStvStyleRewriteUserMessage(jsonText);

    const started = Date.now();
    const gen = await geminiGeneratePlainText({
      apiBaseUrl: baseUrl,
      apiKey,
      model: modelUsed,
      systemInstruction: STV_STYLE_REWRITE_STEP2_SYSTEM,
      userText,
      temperature: 0.45,
      timeoutMs: 90_000,
    });

    console.warn("[vibe.stv-style-rewrite] gemini_done", {
      userId: user.id,
      vibeId,
      model: modelUsed,
      ok: gen.ok,
      httpStatus: gen.status,
      durationMs: Date.now() - started,
      textChars: gen.text.length,
      ...gen.responseSummary,
    });

    if (!gen.ok) {
      return NextResponse.json({ error: "stv_rewrite_failed" }, { status: 502 });
    }

    const scenePrompt = stripLeadingMarkdownFence(gen.text);
    if (scenePrompt.length < MIN_SCENE_PROMPT_CHARS) {
      console.error("[vibe.stv-style-rewrite] output_too_short", {
        userId: user.id,
        vibeId,
        chars: scenePrompt.length,
      });
      return NextResponse.json({ error: "stv_rewrite_empty" }, { status: 502 });
    }

    return NextResponse.json({
      scenePrompt,
      modelUsed,
      stvAntiCopy3Step: true,
    });
  } catch (err) {
    console.error("[vibe.stv-style-rewrite] unhandled", {
      ...toErrorMeta(err),
      ...fetchErrorDetails(err),
    });
    return NextResponse.json({ error: "stv_rewrite_failed" }, { status: 500 });
  }
}
