import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import { resolveSharedDbUserId } from "@/lib/resolve-db-user-id";
import {
  ensureCardForCompletedGeneration,
  getOwnedGenerationForCardAction,
} from "@/lib/generation-card-actions";
import { isPhotoshootEditKind } from "@/lib/photoshoot";
import { publishPromptCard } from "@/lib/prompt-card-publication";
import { isPublishHiddenForUser } from "@/lib/publish-access";
import { submitPromptCardForModeration } from "@/lib/submit-card-moderation";

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
    if (await isPublishHiddenForUser(supabase, [user.id, resolved?.dbUserId])) {
      return NextResponse.json({ error: "publish_hidden" }, { status: 403 });
    }
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
    if (card.isPublished && isPhotoshootEditKind(generation.edit_kind)) {
      const published = await publishPromptCard(supabase, card.cardId);
      console.log("[generations.publish] prompts refreshed", {
        generationId: id,
        cardId: published.cardId,
        slug: published.slug,
        latencyMs: Date.now() - startedAt,
      });
      return NextResponse.json({
        ok: true,
        cardId: published.cardId,
        slug: published.slug,
        isPublished: true,
        alreadyPublished: true,
        moderationStatus: "approved",
        seoReadinessScore: published.seoReadinessScore,
        promptsReady: published.promptsReady,
        reward: null,
      });
    }

    const submitted = await submitPromptCardForModeration(supabase, card.cardId);
    console.log("[generations.publish] moderation_requested", {
      generationId: id,
      cardId: submitted.cardId,
      slug: submitted.slug,
      userId: user.id,
      isPublished: submitted.isPublished,
      moderationStatus: submitted.moderationStatus,
      alreadyPublished: submitted.alreadyPublished,
      latencyMs: Date.now() - startedAt,
    });

    return NextResponse.json({
      ok: true,
      cardId: submitted.cardId,
      slug: submitted.slug,
      isPublished: submitted.isPublished,
      alreadyPublished: submitted.alreadyPublished,
      moderationStatus: submitted.moderationStatus,
      promptsReady: submitted.isPublished,
      reward: null,
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
