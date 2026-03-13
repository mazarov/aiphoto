import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer, enrichCardsWithDetails } from "@/lib/supabase";
import type { RouteCard } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  // Batch fetch by comma-separated IDs (for favorites page)
  const idsParam = req.nextUrl.searchParams.get("ids")?.trim();
  if (idsParam) {
    const ids = idsParam.split(",").filter((id) => id.length > 0);
    if (ids.length === 0) return NextResponse.json({ cards: [] });

    const supabase = createSupabaseServer();
    const { data } = await supabase
      .from("prompt_cards")
      .select("id,slug,title_ru,title_en,seo_tags")
      .in("id", ids)
      .eq("is_published", true);

    const rows: RouteCard[] = (data || []).map((r) => ({ ...r, relevance_score: 0 }));
    const enriched = await enrichCardsWithDetails(rows);
    return NextResponse.json({ cards: enriched });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 4) {
    return NextResponse.json({ cards: [] });
  }

  const supabase = createSupabaseServer();

  const isFullUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q);

  let rows: RouteCard[];

  if (isFullUuid) {
    const { data } = await supabase
      .from("prompt_cards")
      .select("id,slug,title_ru,title_en,seo_tags,source_dataset_slug,source_message_id,card_split_total")
      .eq("id", q)
      .limit(1);
    rows = (data || []).map((r) => ({ ...r, relevance_score: 0 }));
  } else {
    const lower = q.toLowerCase();
    const upper = lower.slice(0, -1) + String.fromCharCode(lower.charCodeAt(lower.length - 1) + 1);
    const { data } = await supabase
      .from("prompt_cards")
      .select("id,slug,title_ru,title_en,seo_tags,source_dataset_slug,source_message_id,card_split_total")
      .gte("id", lower)
      .lt("id", upper)
      .limit(10);
    rows = (data || []).map((r) => ({ ...r, relevance_score: 0 }));
  }

  if (rows.length === 0) {
    return NextResponse.json({ cards: [] });
  }

  const ids = new Set(rows.map((r) => r.id));
  const seenGroups = new Set<string>();
  for (const r of rows) {
    const meta = r as RouteCard & { source_dataset_slug?: string; source_message_id?: number; card_split_total?: number };
    if (meta.card_split_total && meta.card_split_total > 1 && meta.source_dataset_slug && meta.source_message_id != null) {
      const gk = `${meta.source_dataset_slug}::${meta.source_message_id}`;
      if (seenGroups.has(gk)) continue;
      seenGroups.add(gk);
      const { data: siblings } = await supabase
        .from("prompt_cards")
        .select("id,slug,title_ru,title_en,seo_tags")
        .eq("source_dataset_slug", meta.source_dataset_slug)
        .eq("source_message_id", meta.source_message_id);
      for (const s of siblings || []) {
        if (!ids.has(s.id)) {
          ids.add(s.id);
          rows.push({ ...s, relevance_score: 0 });
        }
      }
    }
  }

  const enriched = await enrichCardsWithDetails(rows);
  return NextResponse.json({ cards: enriched });
}
