import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import { assembleVibeFinalPrompt, getVibeAttachReferenceImageToGeneration } from "@/lib/vibe-gemini-instructions";
import {
  LEGACY_PROMPT_ACCENTS,
  appendLegacyGroomingPolicyBlocks,
  buildLegacyVibeFullPromptBody,
  legacyStyleFromUnknownRowStyle,
} from "@/lib/vibe-legacy-prompt-chain";
import type { GroomingPolicy } from "@/lib/vibe-grooming-assembly";
import { VIBE_PROMPT_CHAIN_LEGACY_2C23 } from "@/lib/vibe-legacy-config";
import { fetchErrorDetails } from "@/lib/gemini-vibe-debug-log";
import { getStvPipelineTrace, stvLog } from "@/lib/stv-pipeline-log";

function toErrorMeta(err: unknown) {
  if (!(err instanceof Error)) return { message: String(err) };
  const withCause = err as Error & { cause?: { code?: string; errno?: number } };
  return {
    name: err.name,
    message: err.message,
    stack: err.stack,
    causeCode: withCause.cause?.code,
    causeErrno: withCause.cause?.errno,
  };
}

/**
 * No text LLM: `mergedPrompt` = all non-empty legacy style fields as labeled sections ({@link buildLegacyVibeFullPromptBody}).
 * Three `prompts` share the same body for extension triple-variant mode.
 */
export async function POST(req: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseUserForApiRoute(req);
    if (authError || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      vibeId?: string;
      style?: unknown;
      groomingPolicy?: { applyHair?: boolean; applyMakeup?: boolean };
    };
    const pipelineTrace = getStvPipelineTrace(req, body);

    const groomingPolicy: GroomingPolicy = {
      applyHair: body.groomingPolicy?.applyHair !== false,
      applyMakeup: body.groomingPolicy?.applyMakeup !== false,
    };

    const supabase = createSupabaseServer();

    type VibeRowExpand = {
      style: unknown;
      user_id: string;
      source_image_url: string | null;
      prompt_chain: string | null;
    };
    let vibeOwned: VibeRowExpand | null = null;
    let hasReferenceUrl = false;

    if (body.vibeId) {
      const { data: vibe } = await supabase
        .from("vibes")
        .select("style,user_id,source_image_url,prompt_chain")
        .eq("id", body.vibeId)
        .single();
      if (!vibe || vibe.user_id !== user.id) {
        return NextResponse.json({ error: "vibe_not_found" }, { status: 404 });
      }
      if (vibe.prompt_chain !== VIBE_PROMPT_CHAIN_LEGACY_2C23) {
        return NextResponse.json(
          {
            error: "vibe_not_legacy",
            message: "This vibe is not legacy_2c23. Upload the reference again to run extract.",
          },
          { status: 409 },
        );
      }
      vibeOwned = vibe as VibeRowExpand;
      hasReferenceUrl = Boolean(String(vibe.source_image_url || "").trim());
    }

    const legacyStyle =
      legacyStyleFromUnknownRowStyle(body.style) ?? legacyStyleFromUnknownRowStyle(vibeOwned?.style ?? null);
    if (!legacyStyle) {
      return NextResponse.json({ error: "missing_style" }, { status: 400 });
    }

    const styleBody = buildLegacyVibeFullPromptBody(legacyStyle);
    if (!styleBody) {
      return NextResponse.json({ error: "missing_style_body" }, { status: 400 });
    }

    const promptBody = appendLegacyGroomingPolicyBlocks(styleBody, groomingPolicy);

    const willAttachReferenceInline =
      (await getVibeAttachReferenceImageToGeneration(supabase)) && hasReferenceUrl;

    const prompts = LEGACY_PROMPT_ACCENTS.map((accent) => ({
      accent,
      prompt: promptBody,
    }));

    const assembled = assembleVibeFinalPrompt(promptBody, willAttachReferenceInline);
    const finalPromptPreviews = LEGACY_PROMPT_ACCENTS.map((accent) => ({
      accent,
      fullText: assembled,
    }));

    console.warn("[vibe.expand] legacy_full_style_passthrough_ok", {
      userId: user.id,
      pipelineTrace,
      vibeId: body.vibeId ?? null,
      hasReferenceUrl,
      referencePixelsInGeneration: willAttachReferenceInline,
      expandSource: "legacy_full_style_literal",
      applyHair: groomingPolicy.applyHair,
      applyMakeup: groomingPolicy.applyMakeup,
      styleBodyChars: styleBody.length,
      bodyChars: promptBody.length,
      promptsCount: prompts.length,
    });

    const mergedPrompt = promptBody;
    const finalPg = assembled;
    stvLog("vibe.expand.ok", {
      pipelineTrace,
      userId: user.id,
      vibeId: body.vibeId ?? null,
      modelUsed: "passthrough",
      llmProvider: "none",
      mergedPromptChars: mergedPrompt.length,
      finalPromptForGenerationChars: finalPg.length,
      finalPromptAssumesTwoImages: willAttachReferenceInline,
      promptsCount: prompts.length,
    });

    return NextResponse.json({
      prompts,
      mergedPrompt: promptBody,
      mergeModelUsed: "none",
      mergeOk: false,
      mergeMs: 0,
      mergeFallbackReason: null,
      modelUsed: "passthrough",
      llmProvider: "none",
      finalPromptPreviews,
      finalPromptForGeneration: assembled,
      finalPromptAssumesTwoImages: willAttachReferenceInline,
      vibeReferenceInlinePixels: willAttachReferenceInline,
      vibeGroomingControlsAvailable: false,
      legacyPromptChain: true,
    });
  } catch (err) {
    console.error("[vibe.expand] unhandled error", {
      ...toErrorMeta(err),
      ...fetchErrorDetails(err),
    });
    return NextResponse.json({ error: "expand_failed" }, { status: 500 });
  }
}
