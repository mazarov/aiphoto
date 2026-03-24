import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import { classifySeoTagsForPublish } from "@/lib/seo-tags-classify";

type Ctx = { params: Promise<{ slug: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { user, error: authError } = await getSupabaseUserForApiRoute(req);
    if (authError || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { slug } = await ctx.params;
    const body = (await req.json()) as { published?: boolean };
    const published = !!body.published;

    const supabase = createSupabaseServer();
    const { data: card, error: cardErr } = await supabase
      .from("prompt_cards")
      .select("id,slug,title_ru,author_user_id,is_published")
      .eq("slug", slug)
      .maybeSingle();

    if (cardErr || !card) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    if ((card as { author_user_id?: string }).author_user_id !== user.id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const cardId = card.id as string;

    if (!published) {
      const { error: upErr } = await supabase
        .from("prompt_cards")
        .update({ is_published: false, updated_at: new Date().toISOString() })
        .eq("id", cardId);

      if (upErr) {
        console.error("[my-cards.visibility] hide failed", { cardId, message: upErr.message });
        return NextResponse.json({ error: upErr.message }, { status: 500 });
      }

      console.log("[my-cards.visibility] hide", { userId: user.id, cardId, slug });
      revalidatePath(`/p/${slug}`);
      revalidatePath("/sitemap.xml");

      return NextResponse.json({ ok: true, is_published: false });
    }

    const { data: variants } = await supabase
      .from("prompt_variants")
      .select("prompt_text_ru,prompt_text_en")
      .eq("card_id", cardId)
      .order("variant_index", { ascending: true });

    const promptTexts = (variants || [])
      .map((v) => {
        const row = v as { prompt_text_ru: string | null; prompt_text_en: string | null };
        return row.prompt_text_ru?.trim() || row.prompt_text_en?.trim() || null;
      })
      .filter((t): t is string => !!t);

    const titleRu = (card as { title_ru?: string | null }).title_ru ?? null;
    let seo_tags: Record<string, unknown>;
    let seo_readiness_score: number;
    try {
      const classified = await classifySeoTagsForPublish(titleRu, promptTexts);
      seo_tags = classified.seo_tags;
      seo_readiness_score = classified.seo_readiness_score;
    } catch (tagErr) {
      console.error("[my-cards.visibility] tagging failed", {
        cardId,
        ...tagErr instanceof Error ? { message: tagErr.message } : {},
      });
      seo_tags = {};
      seo_readiness_score = 0;
    }

    const { error: pubErr } = await supabase
      .from("prompt_cards")
      .update({
        is_published: true,
        seo_tags,
        seo_readiness_score,
        updated_at: new Date().toISOString(),
      })
      .eq("id", cardId);

    if (pubErr) {
      console.error("[my-cards.visibility] publish failed", { cardId, message: pubErr.message });
      return NextResponse.json({ error: pubErr.message }, { status: 500 });
    }

    console.log("[my-cards.visibility] publish", { userId: user.id, cardId, slug });
    revalidatePath(`/p/${slug}`);
    revalidatePath("/sitemap.xml");

    return NextResponse.json({ ok: true, is_published: true, seo_readiness_score });
  } catch (err) {
    console.error("my-cards visibility error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
