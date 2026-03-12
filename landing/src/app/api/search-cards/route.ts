import { NextRequest, NextResponse } from "next/server";
import { searchCardsFiltered, enrichCardsWithDetails } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const hasWarnings = (params.get("hasWarnings") || "all") as "all" | "yes" | "no";
  const scoreMin = Math.max(0, Math.min(100, Number(params.get("scoreMin")) || 0));
  const scoreMax = Math.max(0, Math.min(100, Number(params.get("scoreMax")) || 100));
  const hasRuPrompt = (params.get("hasRuPrompt") || "all") as "all" | "yes" | "no";
  const seoTag = params.get("seoTag")?.trim() || null;
  const hasBefore = (params.get("hasBefore") || "all") as "all" | "yes";
  const dataset = params.get("dataset")?.trim() || null;
  const limit = Math.min(200, Math.max(1, Number(params.get("limit")) || 100));
  const offset = Math.max(0, Number(params.get("offset")) || 0);

  const cards = await searchCardsFiltered({
    hasWarnings,
    scoreMin,
    scoreMax,
    hasRuPrompt,
    seoTag,
    hasBefore,
    dataset,
    limit,
    offset,
  });

  const enriched = await enrichCardsWithDetails(cards);
  return NextResponse.json({ cards: enriched });
}
