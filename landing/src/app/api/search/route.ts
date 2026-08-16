import { NextRequest, NextResponse } from "next/server";
import { searchCardsByText, enrichCardsWithDetails } from "@/lib/supabase";

const MAX_SEARCH_QUERY_LENGTH = 160;
const SLOW_SEARCH_MS = 750;

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ cards: [], query: q || "" });
  }
  if (q.length > MAX_SEARCH_QUERY_LENGTH) {
    return NextResponse.json(
      { cards: [], query: q, error: "query too long" },
      { status: 400 }
    );
  }

  const limit = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 24));
  const offset = Math.max(0, Number(req.nextUrl.searchParams.get("offset")) || 0);

  try {
    const startedAt = performance.now();
    const cards = await searchCardsByText(q, limit, offset);
    const searchMs = performance.now() - startedAt;
    const enriched = await enrichCardsWithDetails(cards);
    const totalMs = performance.now() - startedAt;
    const enrichMs = totalMs - searchMs;
    const matchType = cards.length > 0 ? (cards[0] as { match_type?: string }).match_type ?? "fts" : null;
    const res = NextResponse.json({ cards: enriched, query: q, matchType });
    // Short edge cache for search — queries are user-specific but results change slowly.
    res.headers.set("Cache-Control", "public, s-maxage=30, stale-while-revalidate=120");
    res.headers.set(
      "Server-Timing",
      `search-rpc;dur=${searchMs.toFixed(1)}, search-enrich;dur=${enrichMs.toFixed(1)}`
    );

    if (totalMs >= SLOW_SEARCH_MS) {
      console.warn("[search:slow]", {
        queryLength: q.length,
        limit,
        offset,
        resultCount: enriched.length,
        searchMs: Math.round(searchMs),
        enrichMs: Math.round(enrichMs),
        totalMs: Math.round(totalMs),
      });
    }

    return res;
  } catch (err) {
    console.error("search error:", err);
    return NextResponse.json({ cards: [], query: q, error: "search failed" }, { status: 500 });
  }
}
