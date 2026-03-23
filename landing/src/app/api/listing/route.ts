import { NextRequest, NextResponse } from "next/server";
import { fetchRouteCards, enrichCardsWithDetails } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(60, Math.max(1, Number(sp.get("limit")) || 24));
  const offset = Math.max(0, Number(sp.get("offset")) || 0);
  const strict = sp.get("strict") === "1";

  const params: Record<string, string | null> = {};
  for (const key of ["audience_tag", "style_tag", "occasion_tag", "object_tag", "doc_task_tag"]) {
    params[key] = sp.get(key) || null;
  }

  try {
    const result = await fetchRouteCards({
      ...params,
      limit,
      offset,
      min_cards: strict ? 0 : 2,
    });
    const enriched = await enrichCardsWithDetails(result.cards);
    return NextResponse.json({
      cards: enriched,
      total_count: result.total_count ?? result.cards_count,
      tier_used: result.tier_used,
      /** Rows consumed in resolve_route_cards ORDER BY (before sibling expansion). Client must use this for offset, not enriched.cards.length. */
      ranked_batch_size: result.cards_count,
    });
  } catch (err) {
    console.error("listing error:", err);
    return NextResponse.json({ cards: [], total_count: 0, error: "failed" }, { status: 500 });
  }
}
