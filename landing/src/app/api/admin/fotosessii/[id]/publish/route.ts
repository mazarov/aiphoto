import { NextRequest, NextResponse } from "next/server";
import { requireAnalyticsAdmin } from "@/lib/analytics-admin";
import {
  scenarioSlugsForSeoTags,
  validateScenarioPins,
} from "@/lib/admin-photoshoot-albums";
import {
  ensureCardForCompletedGeneration,
  OWNED_GENERATION_CARD_ACTION_SELECT,
  type OwnedGenerationForCardAction,
} from "@/lib/generation-card-actions";
import { isPhotoshootEditKind } from "@/lib/photoshoot";
import { publishPromptCard } from "@/lib/prompt-card-publication";
import { createSupabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Admin publishes a photoshoot album into `/ii-fotosessiya` and pins the
 * chosen scenarios onto the card. Body: `{ "scenarios": ["zhenskie", "studiynye"] }`.
 * Repeat calls on a published card only add scenarios — no second model pass.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAnalyticsAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const startedAt = Date.now();
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { scenarios?: unknown };
  const pins = validateScenarioPins(body.scenarios);
  if (!pins.ok) {
    return NextResponse.json({ error: pins.error }, { status: 400 });
  }

  try {
    const supabase = createSupabaseServer();
    const { data, error } = await supabase
      .from("landing_generations")
      .select(`${OWNED_GENERATION_CARD_ACTION_SELECT},client_source`)
      .eq("id", id)
      .maybeSingle();
    if (error || !data || data.client_source === "admin") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (!isPhotoshootEditKind(data.edit_kind)) {
      return NextResponse.json({ error: "not_photoshoot" }, { status: 409 });
    }
    if (data.status !== "completed") {
      return NextResponse.json({ error: "generation_not_completed" }, { status: 409 });
    }
    if (!data.requester_auth_user_id) {
      return NextResponse.json({ error: "generation_author_missing" }, { status: 409 });
    }

    const card = await ensureCardForCompletedGeneration(
      supabase,
      data as OwnedGenerationForCardAction,
    );
    const published = await publishPromptCard(supabase, card.cardId, {
      pinnedTags: pins.pins,
      extraRevalidatePaths: pins.revalidatePaths,
    });

    const { data: refreshed } = await supabase
      .from("prompt_cards")
      .select("seo_tags,subject_audience,subject_source")
      .eq("id", published.cardId)
      .maybeSingle();

    console.info("[admin.fotosessii.publish] success", {
      adminEmail: gate.email,
      generationId: id,
      cardId: published.cardId,
      slug: published.slug,
      scenarios: pins.slugs,
      alreadyPublished: published.alreadyPublished,
      latencyMs: Date.now() - startedAt,
    });
    return NextResponse.json({
      ok: true,
      alreadyPublished: published.alreadyPublished,
      cardId: published.cardId,
      slug: published.slug,
      cardUrl: `/p/${published.slug}`,
      promptsReady: published.promptsReady,
      scenarioSlugs: scenarioSlugsForSeoTags(refreshed?.seo_tags),
      subjectAudience: (refreshed?.subject_audience as string | null) ?? null,
      subjectSource: (refreshed?.subject_source as string | null) ?? null,
    });
  } catch (error) {
    console.error("[admin.fotosessii.publish] failed", {
      adminEmail: gate.email,
      generationId: id,
      scenarios: pins.slugs,
      message: error instanceof Error ? error.message : String(error),
      latencyMs: Date.now() - startedAt,
    });
    return NextResponse.json({ error: "publish_failed" }, { status: 500 });
  }
}
