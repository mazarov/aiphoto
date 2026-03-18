import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { findTagBySlug, type Dimension } from "@/lib/tag-registry";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createSupabaseServer();
    const { data, error } = await supabase.rpc("get_tag_counts_cache");

    if (error) {
      console.error("[menu-counts] RPC error:", error.message);
      return NextResponse.json({});
    }

    const counts: Record<string, number> = {};
    for (const row of (data ?? []) as { dimension: string; tag_slug: string; count: number }[]) {
      const tag = findTagBySlug(row.dimension as Dimension, row.tag_slug);
      if (tag) {
        counts[tag.urlPath + "/"] = row.count;
      }
    }

    return NextResponse.json(counts, {
      headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800" },
    });
  } catch (err) {
    console.error("[menu-counts] unexpected error:", err);
    return NextResponse.json({});
  }
}
