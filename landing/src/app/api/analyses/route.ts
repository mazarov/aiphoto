import { NextRequest, NextResponse } from "next/server";
import { analyzeHistoryOwnerOrFilter } from "@/lib/analyze-history-owner";
import {
  ANALYZE_HISTORY_BUCKET,
  encodeAnalyzeHistoryCursor,
  parseAnalyzeHistoryCursor,
  parseAnalyzeHistoryLimit,
  type AnalyzeHistoryRow,
} from "@/lib/analyze-history";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import { resolveSharedDbUserId } from "@/lib/resolve-db-user-id";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { user, error: authError } = await getSupabaseUserForApiRoute(req);
  if (authError || !user || user.is_anonymous === true) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseServer();
  const resolved = await resolveSharedDbUserId(supabase, user);
  const dbUserId = resolved?.dbUserId ?? user.id;
  const ownerFilter = analyzeHistoryOwnerOrFilter(user.id, dbUserId);
  if (!ownerFilter) {
    return NextResponse.json({ error: "invalid_user" }, { status: 400 });
  }

  const limit = parseAnalyzeHistoryLimit(req.nextUrl.searchParams.get("limit"));
  const cursor = parseAnalyzeHistoryCursor(req.nextUrl.searchParams.get("cursor"));
  let query = supabase
    .from("analyze_history")
    .select(
      "id,created_at,kind,client_source,prompt,change_request,style,locale,model,image_path,ugc_card_id,user_id,credits_spent,quota_mode",
    )
    .or(ownerFilter)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);
  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    );
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: "analyze_history_fetch_failed" }, { status: 500 });
  }

  const rows = (data || []) as AnalyzeHistoryRow[];
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const items = await Promise.all(
    page.map(async (row) => {
      const signed = row.image_path
        ? await supabase.storage.from(ANALYZE_HISTORY_BUCKET).createSignedUrl(row.image_path, 3600)
        : null;
      return {
        id: row.id,
        created_at: row.created_at,
        kind: row.kind === "remix" ? "remix" : "analyze",
        prompt: row.prompt,
        change_request: row.change_request,
        image_url: signed?.data?.signedUrl || null,
      };
    }),
  );
  const last = page.at(-1);
  return NextResponse.json(
    {
      items,
      next_cursor: hasMore && last ? encodeAnalyzeHistoryCursor(last.created_at, last.id) : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
