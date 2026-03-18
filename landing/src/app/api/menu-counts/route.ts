import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { findTagBySlug, type Dimension } from "@/lib/tag-registry";

export const revalidate = 900; // 15 min — matches pg_cron refresh interval

export async function GET() {
  const supabase = createSupabaseServer();
  const { data, error } = await supabase.rpc("get_tag_counts_cache");

  if (error) {
    console.error("[menu-counts] get_tag_counts_cache error:", error.message);
    return NextResponse.json({}, { status: 200 });
  }

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const tag = findTagBySlug(row.dimension as Dimension, row.tag_slug);
    if (tag) {
      counts[tag.urlPath + "/"] = row.count;
    }
  }

  return NextResponse.json(counts, {
    headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800" },
  });
}
