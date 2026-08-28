import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import { resolveSharedDbUserId } from "@/lib/resolve-db-user-id";
import {
  ensureCardForCompletedGeneration,
  getOwnedGenerationForCardAction,
} from "@/lib/generation-card-actions";
import { publishPromptCard } from "@/lib/prompt-card-publication";

export const maxDuration = 120;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startedAt = Date.now();
  let generationId: string | null = null;
  try {
    const { user, error: authError } = await getSupabaseUserForApiRoute(req);
    if (authError || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    generationId = id;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const supabase = createSupabaseServer();
    const resolved = await resolveSharedDbUserId(supabase, user);
    const generation = await getOwnedGenerationForCardAction(supabase, {
      generationId: id,
      authUserId: user.id,
      dbUserId: resolved?.dbUserId ?? user.id,
    });

    if (!generation) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (
      generation.status !== "completed" ||
      !generation.result_storage_bucket
    ) {
      return NextResponse.json(
        { error: "generation_result_not_available" },
        { status: 409 }
      );
    }

    const card = await ensureCardForCompletedGeneration(supabase, generation);
    const published = await publishPromptCard(supabase, card.cardId);

    console.log("[generations.publish] completed", {
      generationId: id,
      cardId: published.cardId,
      slug: published.slug,
      alreadyPublished: published.alreadyPublished,
      seoReadinessScore: published.seoReadinessScore,
      promptsReady: published.promptsReady,
      latencyMs: Date.now() - startedAt,
    });

    return NextResponse.json({
      ok: true,
      cardId: published.cardId,
      slug: published.slug,
      isPublished: true,
      alreadyPublished: published.alreadyPublished,
      seoReadinessScore: published.seoReadinessScore,
      promptsReady: published.promptsReady,
    });
  } catch (err) {
    console.error("[generations.publish] failed", {
      generationId,
      message: err instanceof Error ? err.message : String(err),
      latencyMs: Date.now() - startedAt,
    });
    return NextResponse.json({ error: "publish_failed" }, { status: 502 });
  }
}
