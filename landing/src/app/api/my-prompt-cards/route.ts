import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer, enrichCardsWithDetails, type RouteCard } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";

export async function GET(req: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseUserForApiRoute(req);
    if (authError || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const limit = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 50));

    const supabase = createSupabaseServer();
    const { data: rows, error } = await supabase
      .from("prompt_cards")
      .select("id,slug,title_ru,title_en,seo_tags,is_published")
      .eq("author_user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const list = rows || [];
    const publishedById = new Map(list.map((r) => [r.id as string, !!(r as { is_published?: boolean }).is_published]));

    const routeCards: RouteCard[] = list
      .filter((r) => r.slug)
      .map((r) => ({
        id: r.id as string,
        slug: r.slug as string,
        title_ru: r.title_ru as string | null,
        title_en: r.title_en as string | null,
        seo_tags: r.seo_tags,
        relevance_score: 0,
      }));

    const enriched = await enrichCardsWithDetails(routeCards);
    const cards = enriched.map((c) => ({
      ...c,
      isPublished: publishedById.get(c.id) ?? true,
    }));

    return NextResponse.json({ cards });
  } catch (err) {
    console.error("my-prompt-cards error:", err);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
