import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import { resolveSharedDbUserId } from "@/lib/resolve-db-user-id";
import {
  detachTerminalGenerationChildren,
  findGenerationIdsWithActiveChildren,
  landingGenerationsOwnerOrFilter,
  removeGenerationResultObjects,
} from "@/lib/landing-generations-access";
import { GENERATIONS_API_MAX_LIMIT } from "@/lib/generations-list";
import { listUserGenerations } from "@/lib/list-user-generations";

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
    const page = await listUserGenerations({
      supabase,
      authUserId: user.id,
      dbUserId,
      limit,
      offset,
    });

    return NextResponse.json(page, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    console.error("generations list error:", err);
    const message = err instanceof Error ? err.message : "Failed to fetch";
    return NextResponse.json({ error: message }, { status: 500 });
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
