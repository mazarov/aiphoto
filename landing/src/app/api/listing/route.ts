import { NextRequest, NextResponse } from "next/server";
import { fetchRouteCards, enrichCardsWithDetails } from "@/lib/supabase";
import { isListingSortParamValid, parseListingSort } from "@/lib/listing-sort";
import { LISTING_SEARCH_API_MAX_LIMIT } from "@/lib/listing-pagination";
import {
  logListingHybridSearch,
  searchListingCardsHybrid,
} from "@/lib/listing-hybrid-search";

const MAX_SEARCH_QUERY_LENGTH = 160;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const requestedLimit = Math.max(1, Number(sp.get("limit")) || 24);
  const offset = Math.max(0, Number(sp.get("offset")) || 0);
  const q = sp.get("q")?.trim() ?? "";
  const limit = q
    ? Math.min(LISTING_SEARCH_API_MAX_LIMIT, requestedLimit)
    : Math.min(60, requestedLimit);
  const strict = sp.get("strict") === "1";
  const sortRaw = sp.get("sort");

  if (q) {
    if (q.length < 2) {
      return NextResponse.json({
        cards: [],
        total_count: 0,
        ranked_batch_size: 0,
        has_more: false,
        query: q,
      });
    }
    if (q.length > MAX_SEARCH_QUERY_LENGTH) {
      return NextResponse.json({ error: "query too long" }, { status: 400 });
    }
    try {
      const startedAt = performance.now();
      const page = await searchListingCardsHybrid({
        query: q,
        limit,
        offset,
        headers: req.headers,
      });
      const enriched = await enrichCardsWithDetails(page.cards);
      const totalMs = performance.now() - startedAt;
      logListingHybridSearch({
        source: "api",
        queryLength: q.length,
        limit,
        offset,
        resultCount: enriched.length,
        hasMore: page.hasMore,
        outcome: page.outcome,
        fallbackReason: page.fallbackReason,
        allowlisted: page.allowlisted,
        resultCacheHit: page.resultCacheHit,
        vectorCacheHit: page.vectorCacheHit,
        textCount: page.textCount,
        visualCount: page.visualCount,
        timings: page.timings,
        totalMs,
      });
      const res = NextResponse.json({
        cards: enriched,
        total_count: offset + page.cards.length + (page.hasMore ? 1 : 0),
        ranked_batch_size: page.cards.length,
        has_more: page.hasMore,
        query: q,
        matchType: page.matchType,
      });
      res.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
      res.headers.set(
        "Server-Timing",
        [
          `search-text;dur=${page.timings.textMs.toFixed(1)}`,
          `search-embed;dur=${page.timings.embedMs.toFixed(1)}`,
          `search-vector;dur=${page.timings.vectorMs.toFixed(1)}`,
          `search-rank;dur=${page.timings.rankMs.toFixed(1)}`,
          `search-result-cache;desc=${page.resultCacheHit ? "hit" : "miss"}`,
        ].join(", "),
      );
      return res;
    } catch (err) {
      console.error("listing search error:", err);
      return NextResponse.json({ cards: [], total_count: 0, error: "failed" }, { status: 500 });
    }
  }

  if (!isListingSortParamValid(sortRaw)) {
    return NextResponse.json({ error: "invalid_sort" }, { status: 400 });
  }
  const sort = parseListingSort(sortRaw);

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
      sort,
    });
    const enriched = await enrichCardsWithDetails(result.cards);
    const res = NextResponse.json({
      cards: enriched,
      total_count: result.total_count ?? result.cards_count,
      tier_used: result.tier_used,
      /** Rows consumed in resolve_route_cards ORDER BY (before sibling expansion). Client must use this for offset, not enriched.cards.length. */
      ranked_batch_size: result.cards_count,
      sort,
    });
    // Allow CDN/Vercel edge cache to serve listing pages for 60 s;
    // stale responses acceptable for up to 5 min while revalidating in background.
    res.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    return res;
  } catch (err) {
    console.error("listing error:", err);
    return NextResponse.json({ cards: [], total_count: 0, error: "failed" }, { status: 500 });
  }
}
