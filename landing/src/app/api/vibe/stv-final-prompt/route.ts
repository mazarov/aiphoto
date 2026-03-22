import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import {
  assembleVibeFinalPrompt,
  getGeminiApiBaseUrlForVibeRoutes,
  getGeminiVibeExpandModelRuntime,
  getVibeAttachReferenceImageToGeneration,
} from "@/lib/vibe-gemini-instructions";
import { fetchErrorDetails } from "@/lib/gemini-vibe-debug-log";
import { LEGACY_PROMPT_ACCENTS } from "@/lib/vibe-legacy-prompt-chain";
import { VIBE_PROMPT_CHAIN_STV_ANTI_COPY_3STEP } from "@/lib/vibe-legacy-config";
import { geminiGeneratePlainText, stripLeadingMarkdownFence } from "@/lib/vibe-stv-gemini-text";
import {
  STV_FINAL_STEP3_SYSTEM,
  buildStvFinalStep3UserMessage,
} from "@/lib/vibe-stv-three-step-instructions";

function toErrorMeta(err: unknown) {
  if (!(err instanceof Error)) return { message: String(err) };
  return { name: err.name, message: err.message, stack: err.stack };
}

const MIN_SCENE_IN = 24;
const MIN_FINAL_OUT = 40;

export async function POST(req: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseUserForApiRoute(req);
    if (authError || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as { vibeId?: string; scenePrompt?: string };
    const vibeId = String(body?.vibeId || "").trim();
    const scenePrompt = String(body?.scenePrompt || "").trim();
    if (!vibeId || scenePrompt.length < MIN_SCENE_IN) {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    const supabase = createSupabaseServer();
    const { data: vibe, error: vibeError } = await supabase
      .from("vibes")
      .select("id,user_id,source_image_url,prompt_chain")
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

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "stv_llm_unconfigured" }, { status: 503 });
    }

    const modelUsed = await getGeminiVibeExpandModelRuntime(supabase);
    const baseUrl = await getGeminiApiBaseUrlForVibeRoutes(supabase);
    const userText = buildStvFinalStep3UserMessage(scenePrompt);

    const started = Date.now();
    const gen = await geminiGeneratePlainText({
      apiBaseUrl: baseUrl,
      apiKey,
      model: modelUsed,
      systemInstruction: STV_FINAL_STEP3_SYSTEM,
      userText,
      temperature: 0.35,
      timeoutMs: 90_000,
    });

    console.warn("[vibe.stv-final-prompt] gemini_done", {
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
      return NextResponse.json({ error: "stv_final_failed" }, { status: 502 });
    }

    const mergedPrompt = stripLeadingMarkdownFence(gen.text);
    if (mergedPrompt.length < MIN_FINAL_OUT) {
      console.error("[vibe.stv-final-prompt] output_too_short", {
        userId: user.id,
        vibeId,
        chars: mergedPrompt.length,
      });
      return NextResponse.json({ error: "stv_final_empty" }, { status: 502 });
    }

    const hasReferenceUrl = Boolean(String(vibe.source_image_url || "").trim());
    const willAttachReferenceInline =
      (await getVibeAttachReferenceImageToGeneration(supabase)) && hasReferenceUrl;

    const finalPromptForGeneration = assembleVibeFinalPrompt(mergedPrompt, willAttachReferenceInline);
    const prompts = LEGACY_PROMPT_ACCENTS.map((accent) => ({
      accent,
      prompt: mergedPrompt,
    }));

    return NextResponse.json({
      prompts,
      mergedPrompt,
      mergeModelUsed: modelUsed,
      mergeOk: true,
      mergeMs: Date.now() - started,
      mergeFallbackReason: null,
      modelUsed,
      llmProvider: "gemini",
      finalPromptPreviews: LEGACY_PROMPT_ACCENTS.map((accent) => ({
        accent,
        fullText: finalPromptForGeneration,
      })),
      finalPromptForGeneration,
      finalPromptAssumesTwoImages: willAttachReferenceInline,
      vibeReferenceInlinePixels: willAttachReferenceInline,
      vibeGroomingControlsAvailable: false,
      legacyPromptChain: false,
      stvAntiCopy3Step: true,
    });
  } catch (err) {
    console.error("[vibe.stv-final-prompt] unhandled", {
      ...toErrorMeta(err),
      ...fetchErrorDetails(err),
    });
    return NextResponse.json({ error: "stv_final_failed" }, { status: 500 });
  }
}
