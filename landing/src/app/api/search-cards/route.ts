import { NextRequest, NextResponse } from "next/server";
import { searchCardsFiltered, enrichCardsWithDetails, countCardsFiltered } from "@/lib/supabase";
import { LISTING_INFINITE_PAGE_SIZE } from "@/lib/listing-pagination";
import { isListingSortParamValid, parseListingSort } from "@/lib/listing-sort";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import { isCatalogAdminEmail } from "@/lib/catalog-admin";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const hasWarnings = (params.get("hasWarnings") || "all") as "all" | "yes" | "no";
  const scoreMin = Math.max(0, Math.min(100, Number(params.get("scoreMin")) || 0));
  const scoreMax = Math.max(0, Math.min(100, Number(params.get("scoreMax")) || 100));
  const hasRuPrompt = (params.get("hasRuPrompt") || "all") as "all" | "yes" | "no";
  const seoTag = params.get("seoTag")?.trim() || null;
  const hasBefore = (params.get("hasBefore") || "all") as "all" | "yes";
  const dataset = params.get("dataset")?.trim() || null;
  const publishedRaw = (params.get("published") || "yes").trim().toLowerCase();
  let published =
    publishedRaw === "all" || publishedRaw === "no" || publishedRaw === "yes"
      ? (publishedRaw as "all" | "yes" | "no")
      : "yes";

  if (published !== "yes") {
    const { user } = await getSupabaseUserForApiRoute(req);
    if (!isCatalogAdminEmail(user?.email)) {
      published = "yes";
    }
  }

  const sortRaw = params.get("sort");
  if (!isListingSortParamValid(sortRaw)) {
    return NextResponse.json({ error: "invalid_sort" }, { status: 400 });
  }
  const sort = parseListingSort(sortRaw);

  const limit = Math.min(
    LISTING_INFINITE_PAGE_SIZE,
    Math.max(1, Number(params.get("limit")) || LISTING_INFINITE_PAGE_SIZE)
  );
  const offset = Math.max(0, Number(params.get("offset")) || 0);
  const includeTotal = params.get("includeTotal") === "1";

  const filterParams = {
    hasWarnings,
    scoreMin,
    scoreMax,
    hasRuPrompt,
    seoTag,
    hasBefore,
    dataset,
    published,
  };

  const [{ cards, rankedBatchSize }, total] = await Promise.all([
    searchCardsFiltered({ ...filterParams, sort, limit, offset }),
    includeTotal ? countCardsFiltered(filterParams) : Promise.resolve(undefined),
  ]);

  const enriched = await enrichCardsWithDetails(cards);
  const hasMore =
    total != null
      ? offset + rankedBatchSize < total
      : rankedBatchSize === limit;

  return NextResponse.json({
    cards: enriched,
    ranked_batch_size: rankedBatchSize,
    ...(total != null ? { total } : {}),
    hasMore,
  });
}
