import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import { resolveViewerDbUserId } from "@/lib/resolve-db-user-id";
import { publishPromptCard } from "@/lib/prompt-card-publication";

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
    const authorUserId = await resolveViewerDbUserId(supabase, user);
    const { data: card, error: cardErr } = await supabase
      .from("prompt_cards")
      .select("id,slug,title_ru,author_user_id,is_published")
      .eq("slug", slug)
      .maybeSingle();

    if (cardErr || !card) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    if ((card as { author_user_id?: string }).author_user_id !== authorUserId) {
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

    try {
      const result = await publishPromptCard(supabase, cardId);
      console.log("[my-cards.visibility] publish", {
        userId: user.id,
        cardId,
        slug,
        alreadyPublished: result.alreadyPublished,
      });
      return NextResponse.json({
        ok: true,
        is_published: true,
        seo_readiness_score: result.seoReadinessScore,
      });
    } catch (publishError) {
      console.error("[my-cards.visibility] publish failed", {
        cardId,
        slug,
        message:
          publishError instanceof Error
            ? publishError.message
            : String(publishError),
      });
      return NextResponse.json({ error: "publish_failed" }, { status: 502 });
    }
  } catch (err) {
    console.error("my-cards visibility error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
