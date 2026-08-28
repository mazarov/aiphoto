import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer, getStoragePublicUrl } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import { resolveSharedDbUserId } from "@/lib/resolve-db-user-id";
import {
  detachTerminalGenerationChildren,
  findGenerationIdsWithActiveChildren,
  landingGenerationsOwnerOrFilter,
  removeGenerationResultObjects,
} from "@/lib/landing-generations-access";
import { resolvePhotoshootUserFacingResult } from "@/lib/photoshoot";
import { GENERATIONS_API_MAX_LIMIT, takeGenerationPage } from "@/lib/generations-list";

const BULK_DELETE_MAX = 50;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseUserForApiRoute(req);

    if (authError || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const limit = Math.min(
      GENERATIONS_API_MAX_LIMIT,
      Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 20),
    );
    const offset = Math.max(0, Number(req.nextUrl.searchParams.get("offset")) || 0);

    const supabase = createSupabaseServer();
    const resolved = await resolveSharedDbUserId(supabase, user);
    const dbUserId = resolved?.dbUserId ?? user.id;
    const ownerFilter = landingGenerationsOwnerOrFilter(user.id, dbUserId);

    const { data: rows, error } = await supabase
      .from("landing_generations")
      .select(
        "id, status, prompt_text, model, executed_model, fallback_used, aspect_ratio, credits_spent, created_at, generation_completed_at, error_message, result_storage_bucket, result_storage_path, ugc_card_id, modality, result_mime_type, duration_seconds, edit_kind, photoshoot_tile_paths"
      )
      .or(ownerFilter)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { page, hasMore } = takeGenerationPage(rows || [], limit);

    const cardIds = [
      ...new Set(
        page
          .map((row) => row.ugc_card_id as string | null)
          .filter((id): id is string => Boolean(id))
      ),
    ];
    const cardsById = new Map<
      string,
      { id: string; slug: string | null; isPublished: boolean }
    >();

    if (cardIds.length > 0) {
      const { data: cards, error: cardsError } = await supabase
        .from("prompt_cards")
        .select("id, slug, is_published")
        .in("id", cardIds);

      if (cardsError) {
        console.error("generations card metadata error:", cardsError.message);
      } else {
        for (const card of cards || []) {
          cardsById.set(card.id as string, {
            id: card.id as string,
            slug: (card.slug as string | null) ?? null,
            isPublished: Boolean(card.is_published),
          });
        }
      }
    }

    const generations = page.map((g) => {
      const card = g.ugc_card_id
        ? cardsById.get(g.ugc_card_id as string) ?? null
        : null;
      const facing = resolvePhotoshootUserFacingResult({
        editKind: g.edit_kind,
        sheetPath: g.result_storage_path,
        tilePaths: g.photoshoot_tile_paths,
      });
      const bucket = g.result_storage_bucket as string | null;
      return {
        id: g.id,
        status: g.status,
        prompt: g.prompt_text,
        model: g.model,
        executedModel: g.executed_model || null,
        fallbackUsed: Boolean(g.fallback_used),
        aspectRatio: g.aspect_ratio,
        modality: g.modality || "image",
        resultMimeType: g.result_mime_type || null,
        durationSeconds: g.duration_seconds ?? null,
        editKind: g.edit_kind || null,
        creditsSpent: g.credits_spent,
        createdAt: g.created_at,
        completedAt: g.generation_completed_at,
        errorMessage: g.status === "failed" ? g.error_message : null,
        resultUrl:
          bucket && facing.resultPath
            ? getStoragePublicUrl(bucket, facing.resultPath)
            : null,
        photoshootTileUrls:
          bucket && facing.tilePaths
            ? facing.tilePaths.map((path) => getStoragePublicUrl(bucket, path))
            : null,
        cardId: card?.id ?? null,
        cardSlug: card?.slug ?? null,
        isPublished: card?.isPublished ?? false,
      };
    });

    return NextResponse.json(
      {
        generations,
        hasMore,
        nextOffset: hasMore ? offset + generations.length : null,
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (err) {
    console.error("generations list error:", err);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseUserForApiRoute(req);

    if (authError || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as { ids?: unknown } | null;
    const rawIds = Array.isArray(body?.ids) ? body.ids : null;
    if (!rawIds || rawIds.length === 0) {
      return NextResponse.json({ error: "Missing ids" }, { status: 400 });
    }
    if (rawIds.length > BULK_DELETE_MAX) {
      return NextResponse.json(
        { error: `Too many ids. Max ${BULK_DELETE_MAX}` },
        { status: 400 }
      );
    }

    const ids = [
      ...new Set(
        rawIds.filter(
          (id): id is string => typeof id === "string" && UUID_RE.test(id)
        )
      ),
    ];
    if (ids.length === 0) {
      return NextResponse.json({ error: "Invalid ids" }, { status: 400 });
    }

    const supabase = createSupabaseServer();
    const resolved = await resolveSharedDbUserId(supabase, user);
    const dbUserId = resolved?.dbUserId ?? user.id;
    const ownerFilter = landingGenerationsOwnerOrFilter(user.id, dbUserId);

    const { data: rows, error: fetchError } = await supabase
      .from("landing_generations")
      .select("id, result_storage_bucket, result_storage_path, photoshoot_tile_paths")
      .in("id", ids)
      .or(ownerFilter);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const owned = rows ?? [];
    if (owned.length === 0) {
      return NextResponse.json({ ok: true, deleted: 0 });
    }

    const ownedIds = owned.map((row) => row.id);
    const activeParents = await findGenerationIdsWithActiveChildren(supabase, ownedIds);
    if (activeParents.size > 0) {
      return NextResponse.json(
        {
          error: "generation_in_use",
          message: "Одна из генераций используется для создания следующей версии",
          blockedIds: [...activeParents],
        },
        { status: 409 }
      );
    }
    await detachTerminalGenerationChildren(supabase, ownedIds);
    const { error: deleteError } = await supabase
      .from("landing_generations")
      .delete()
      .in("id", ownedIds);

    if (deleteError) {
      console.error("generations bulk delete error:", deleteError);
      if (deleteError.code === "23503") {
        return NextResponse.json(
          {
            error: "generation_in_use",
            message: "Одна из генераций используется для создания следующей версии",
          },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: "Delete failed" }, { status: 500 });
    }

    await removeGenerationResultObjects(supabase, owned);

    return NextResponse.json({ ok: true, deleted: ownedIds.length });
  } catch (err) {
    console.error("generations bulk DELETE error:", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
