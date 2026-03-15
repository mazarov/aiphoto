import { NextRequest, NextResponse } from "next/server";
import { searchCardsByText, enrichCardsWithDetails } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ cards: [], query: q || "" });
  }

  const limit = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 24));
  const offset = Math.max(0, Number(req.nextUrl.searchParams.get("offset")) || 0);

  try {
    const cards = await searchCardsByText(q, limit, offset);
    const enriched = await enrichCardsWithDetails(cards);
    const matchType = cards.length > 0 ? (cards[0] as { match_type?: string }).match_type ?? "fts" : null;
    return NextResponse.json({ cards: enriched, query: q, matchType });
  } catch (err) {
    console.error("search error:", err);
    return NextResponse.json({ cards: [], query: q, error: "search failed" }, { status: 500 });
  }
}
