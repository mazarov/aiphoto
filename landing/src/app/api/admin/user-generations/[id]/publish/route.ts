import { NextRequest, NextResponse } from "next/server";
import { requireAnalyticsAdmin } from "@/lib/analytics-admin";
import {
  ensureCardForCompletedGeneration,
  type OwnedGenerationForCardAction,
} from "@/lib/generation-card-actions";
import { publishPromptCard } from "@/lib/prompt-card-publication";
import { createSupabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAnalyticsAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const startedAt = Date.now();
  const { id } = await params;
  try {
    const supabase = createSupabaseServer();
    const { data, error } = await supabase
      .from("landing_generations")
      .select(
        "id,user_id,requester_auth_user_id,status,client_source,prompt_text,result_storage_bucket,result_storage_path,edit_kind,photoshoot_tile_paths,ugc_card_id"
      )
      .eq("id", id)
      .maybeSingle();
    if (error || !data || data.client_source === "admin") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (data.status !== "completed") {
      return NextResponse.json({ error: "generation_not_completed" }, { status: 409 });
    }
    if (!data.requester_auth_user_id) {
      return NextResponse.json({ error: "generation_author_missing" }, { status: 409 });
    }

    const card = await ensureCardForCompletedGeneration(
      supabase,
      data as OwnedGenerationForCardAction
    );
    const published = await publishPromptCard(supabase, card.cardId);
    console.info("[admin.user-generation.publish] success", {
      adminEmail: gate.email,
      generationId: id,
      requesterAuthUserId: data.requester_auth_user_id,
      cardId: published.cardId,
      slug: published.slug,
      alreadyPublished: published.alreadyPublished,
      latencyMs: Date.now() - startedAt,
    });
    return NextResponse.json({
      ok: true,
      alreadyPublished: published.alreadyPublished,
      cardId: published.cardId,
      slug: published.slug,
      cardUrl: `/p/${published.slug}`,
      seoReadinessScore: published.seoReadinessScore,
    });
  } catch (error) {
    console.error("[admin.user-generation.publish] failed", {
      adminEmail: gate.email,
      generationId: id,
      message: error instanceof Error ? error.message : String(error),
      latencyMs: Date.now() - startedAt,
    });
    return NextResponse.json({ error: "publish_failed" }, { status: 500 });
  }
}
