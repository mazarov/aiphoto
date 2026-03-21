import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import {
  assembleVibeFinalPrompt,
  getVibeAttachReferenceImageToGeneration,
  getVibeOneShotExtractPromptEnabled,
} from "@/lib/vibe-gemini-instructions";
import {
  combineVibePromptBody,
  hasUsableGroomingReference,
  parseGroomingReferenceFromRow,
  type GroomingPolicy,
} from "@/lib/vibe-grooming-assembly";

const SINGLE_PROMPT_ACCENT = "scene" as const;

function toErrorMeta(err: unknown) {
  if (!(err instanceof Error)) return { message: String(err) };
  return { name: err.name, message: err.message, stack: err.stack };
}

export async function POST(req: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseUserForApiRoute(req);
    if (authError || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      vibeId?: string;
      groomingPolicy?: { applyHair?: boolean; applyMakeup?: boolean };
    };

    const vibeId = String(body.vibeId || "").trim();
    if (!vibeId) {
      return NextResponse.json({ error: "missing_vibe_id" }, { status: 400 });
    }

    const policy: GroomingPolicy = {
      applyHair: body.groomingPolicy?.applyHair !== false,
      applyMakeup: body.groomingPolicy?.applyMakeup !== false,
    };

    const supabase = createSupabaseServer();
    const { data: vibe, error: fetchErr } = await supabase
      .from("vibes")
      .select(
        "user_id,source_image_url,prefilled_generation_prompt,prompt_scene_core,grooming_reference,last_monolithic_prompt",
      )
      .eq("id", vibeId)
      .single();

    if (fetchErr || !vibe) {
      return NextResponse.json({ error: "vibe_not_found" }, { status: 400 });
    }

    if (vibe.user_id !== user.id) {
      return NextResponse.json({ error: "vibe_forbidden" }, { status: 400 });
    }

    const row = {
      prompt_scene_core: vibe.prompt_scene_core as string | null,
      grooming_reference: vibe.grooming_reference,
      last_monolithic_prompt: vibe.last_monolithic_prompt as string | null,
      prefilled_generation_prompt: vibe.prefilled_generation_prompt as string | null,
    };

    const { combinedUnprefixed, usedSplitPath } = combineVibePromptBody(row, policy);

    if (!combinedUnprefixed.trim()) {
      return NextResponse.json({ error: "assemble_requires_data" }, { status: 409 });
    }

    const hasReferenceUrl = Boolean(String(vibe.source_image_url || "").trim());
    const willAttachReferenceInline =
      (await getVibeAttachReferenceImageToGeneration(supabase)) && hasReferenceUrl;
    const oneShotExtractConfigEnabled = await getVibeOneShotExtractPromptEnabled(supabase);

    const assembled = assembleVibeFinalPrompt(
      combinedUnprefixed,
      willAttachReferenceInline,
      oneShotExtractConfigEnabled,
    );

    const groomingRef = parseGroomingReferenceFromRow(vibe.grooming_reference);
    const vibeGroomingControlsAvailable =
      usedSplitPath && hasUsableGroomingReference(groomingRef);

    console.warn("[vibe.assemble] ok", {
      userId: user.id,
      vibeId,
      usedSplitPath,
      applyHair: policy.applyHair,
      applyMakeup: policy.applyMakeup,
      combinedChars: combinedUnprefixed.length,
    });

    return NextResponse.json({
      prompts: [{ accent: SINGLE_PROMPT_ACCENT, prompt: combinedUnprefixed }],
      modelUsed: "assemble",
      llmProvider: "none",
      finalPromptPreviews: [{ accent: SINGLE_PROMPT_ACCENT, fullText: assembled }],
      finalPromptForGeneration: assembled,
      finalPromptAssumesTwoImages: willAttachReferenceInline,
      vibeReferenceInlinePixels: willAttachReferenceInline,
      vibeGroomingControlsAvailable,
    });
  } catch (err) {
    console.error("[vibe.assemble] unhandled error", toErrorMeta(err));
    return NextResponse.json({ error: "assemble_failed" }, { status: 500 });
  }
}
