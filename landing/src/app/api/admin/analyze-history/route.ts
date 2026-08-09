import { NextRequest, NextResponse } from "next/server";
import { requireAnalyticsAdmin } from "@/lib/analytics-admin";
import {
  ANALYZE_HISTORY_BUCKET, encodeAnalyzeHistoryCursor, maybeCleanupAnalyzeHistory,
  parseAnalyzeHistoryCursor, parseAnalyzeHistoryLimit, type AnalyzeHistoryRow,
} from "@/lib/analyze-history";
import { createSupabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gate = await requireAnalyticsAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const supabase = createSupabaseServer();
  await maybeCleanupAnalyzeHistory(supabase);
  const limit = parseAnalyzeHistoryLimit(req.nextUrl.searchParams.get("limit"));
  const cursor = parseAnalyzeHistoryCursor(req.nextUrl.searchParams.get("cursor"));
  const source = req.nextUrl.searchParams.get("client_source")?.trim();
  let query = supabase.from("analyze_history")
    .select("id,created_at,client_source,prompt,style,locale,model,image_path,ugc_card_id")
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(limit + 1);
  if (source) query = query.eq("client_source", source);
  if (cursor) query = query.or(
    `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
  );
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "analyze_history_fetch_failed" }, { status: 500 });
  const rows = (data || []) as AnalyzeHistoryRow[];
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const cardIds = page.map((row) => row.ugc_card_id).filter((id): id is string => Boolean(id));
  const cards = new Map<string, { slug: string | null; published: boolean }>();
  if (cardIds.length) {
    const { data: cardRows } = await supabase.from("prompt_cards").select("id,slug,is_published").in("id", cardIds);
    for (const card of cardRows || []) cards.set(card.id, { slug: card.slug, published: Boolean(card.is_published) });
  }
  const items = await Promise.all(page.map(async (row) => {
    const signed = row.image_path
      ? await supabase.storage.from(ANALYZE_HISTORY_BUCKET).createSignedUrl(row.image_path, 3600)
      : null;
    const card = row.ugc_card_id ? cards.get(row.ugc_card_id) : null;
    return {
      id: row.id, created_at: row.created_at, client_source: row.client_source, prompt: row.prompt,
      style: row.style, locale: row.locale, model: row.model,
      image_url: signed?.data?.signedUrl || null, is_published: Boolean(card?.published),
      card_url: card?.published && card.slug ? `/p/${card.slug}` : null,
    };
  }));
  const last = page.at(-1);
  return NextResponse.json({
    items,
    next_cursor: hasMore && last ? encodeAnalyzeHistoryCursor(last.created_at, last.id) : null,
  }, { headers: { "Cache-Control": "no-store" } });
}
