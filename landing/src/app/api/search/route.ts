import { NextRequest, NextResponse } from "next/server";
import {
  createSupabaseServer,
  enrichCardsWithDetails,
  searchCardsByText,
  searchCardsByVisualEmbedding,
} from "@/lib/supabase";
import { embedSearchQueryWithGuards } from "@/lib/visual-search-guard";
import { runHybridCardSearch } from "@/lib/visual-search";

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
    const supabase = createSupabaseServer();
    const hybrid = await runHybridCardSearch({
      query: q,
      limit,
      offset,
      headers: req.headers,
      supabase,
      deps: {
        searchText: searchCardsByText,
        searchVisual: searchCardsByVisualEmbedding,
        embedQuery: embedSearchQueryWithGuards,
      },
    });
    const searchMs = performance.now() - startedAt;
    const enriched = await enrichCardsWithDetails(hybrid.cards);
    const totalMs = performance.now() - startedAt;
    const enrichMs = totalMs - searchMs;
    const res = NextResponse.json({
      cards: enriched,
      query: q,
      matchType: hybrid.matchType,
    });
    res.headers.set("Cache-Control", "public, s-maxage=30, stale-while-revalidate=120");
    res.headers.set(
      "Server-Timing",
      [
        `search-text;dur=${hybrid.timings.textMs.toFixed(1)}`,
        `search-embed;dur=${hybrid.timings.embedMs.toFixed(1)}`,
        `search-vector;dur=${hybrid.timings.vectorMs.toFixed(1)}`,
        `search-rank;dur=${hybrid.timings.rankMs.toFixed(1)}`,
        `search-enrich;dur=${enrichMs.toFixed(1)}`,
      ].join(", "),
    );

    if (totalMs >= SLOW_SEARCH_MS || hybrid.outcome === "text_fallback") {
      console.warn(
        hybrid.outcome === "text_fallback" ? "[search:fallback]" : "[search:slow]",
        {
          queryLength: q.length,
          limit,
          offset,
          resultCount: enriched.length,
          textCount: hybrid.textCount,
          visualCount: hybrid.visualCount,
          outcome: hybrid.outcome,
          fallbackReason: hybrid.fallbackReason ?? null,
          cacheHit: hybrid.cacheHit,
          circuitState: hybrid.circuitState,
          searchMs: Math.round(searchMs),
          enrichMs: Math.round(enrichMs),
          totalMs: Math.round(totalMs),
          textMs: Math.round(hybrid.timings.textMs),
          embedMs: Math.round(hybrid.timings.embedMs),
          vectorMs: Math.round(hybrid.timings.vectorMs),
          rankMs: Math.round(hybrid.timings.rankMs),
        },
      );
    }

    return res;
  } catch (err) {
    console.error("search error:", err);
    return NextResponse.json({ cards: [], query: q, error: "search failed" }, { status: 500 });
  }
}
