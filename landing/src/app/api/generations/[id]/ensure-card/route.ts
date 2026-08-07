import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import { resolveSharedDbUserId } from "@/lib/resolve-db-user-id";
import {
  ensureCardForCompletedGeneration,
  getOwnedGenerationForCardAction,
} from "@/lib/generation-card-actions";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startedAt = Date.now();
  try {
    const { user, error: authError } = await getSupabaseUserForApiRoute(req);
    if (authError || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { id } = await params;
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
      !generation.result_storage_bucket ||
      !generation.result_storage_path
    ) {
      return NextResponse.json(
        { error: "generation_result_not_available" },
        { status: 409 }
      );
    }

    const card = await ensureCardForCompletedGeneration(supabase, generation);
    console.log("[generations.ensure-card] ready", {
      generationId: id,
      cardId: card.cardId,
      slug: card.slug,
      latencyMs: Date.now() - startedAt,
    });

    return NextResponse.json(card);
  } catch (err) {
    console.error("[generations.ensure-card] failed", {
      message: err instanceof Error ? err.message : String(err),
      latencyMs: Date.now() - startedAt,
    });
    return NextResponse.json({ error: "card_create_failed" }, { status: 500 });
  }
}
