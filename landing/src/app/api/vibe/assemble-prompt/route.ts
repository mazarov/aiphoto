import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import { VIBE_PROMPT_CHAIN_LEGACY_2C23 } from "@/lib/vibe-legacy-config";
import { getStvPipelineTrace, stvLog } from "@/lib/stv-pipeline-log";

function toErrorMeta(err: unknown) {
  if (!(err instanceof Error)) return { message: String(err) };
  return { name: err.name, message: err.message, stack: err.stack };
}

/**
 * Legacy-only product: grooming assemble applied to modern/one-shot rows is disabled.
 * Legacy rows already get final prompts from POST /api/vibe/expand.
 */
export async function POST(req: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseUserForApiRoute(req);
    if (authError || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as { vibeId?: string };
    const pipelineTrace = getStvPipelineTrace(req, body);
    const vibeId = String(body.vibeId || "").trim();
    if (!vibeId) {
      stvLog("vibe.assemble.bad_request", { pipelineTrace, reason: "missing_vibe_id" });
      return NextResponse.json({ error: "missing_vibe_id" }, { status: 400 });
    }

    const supabase = createSupabaseServer();
    const { data: vibe, error: fetchErr } = await supabase
      .from("vibes")
      .select("user_id,prompt_chain")
      .eq("id", vibeId)
      .single();

    if (fetchErr || !vibe) {
      stvLog("vibe.assemble.not_found", { pipelineTrace, userId: user.id, vibeId });
      return NextResponse.json({ error: "vibe_not_found" }, { status: 400 });
    }

    if (vibe.user_id !== user.id) {
      stvLog("vibe.assemble.forbidden", { pipelineTrace, userId: user.id, vibeId });
      return NextResponse.json({ error: "vibe_forbidden" }, { status: 400 });
    }

    if (vibe.prompt_chain === VIBE_PROMPT_CHAIN_LEGACY_2C23) {
      stvLog("vibe.assemble.not_applicable_legacy", { pipelineTrace, userId: user.id, vibeId });
      return NextResponse.json(
        {
          error: "assemble_not_applicable_legacy",
          message: "Grooming assemble is not used for legacy_2c23 prompt chain; expand already returns final prompts.",
        },
        { status: 409 },
      );
    }

    stvLog("vibe.assemble.vibe_not_legacy", { pipelineTrace, userId: user.id, vibeId });
    return NextResponse.json(
      {
        error: "vibe_not_legacy",
        message: "This vibe was created with an older pipeline. Upload the reference again to run extract.",
      },
      { status: 409 },
    );
  } catch (err) {
    console.error("[vibe.assemble] unhandled error", toErrorMeta(err));
    return NextResponse.json({ error: "assemble_failed" }, { status: 500 });
  }
}
