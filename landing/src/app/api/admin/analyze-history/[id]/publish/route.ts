import { NextRequest, NextResponse } from "next/server";
import { requireAnalyticsAdmin } from "@/lib/analytics-admin";
import { ANALYZE_HISTORY_BUCKET } from "@/lib/analyze-history";
import { publishPromptCard } from "@/lib/prompt-card-publication";
import { createSupabaseServer } from "@/lib/supabase";
import { createUgcCardForAnalyzeHistory } from "@/lib/web-ugc-card";

const PUBLIC_RESULTS_BUCKET = "web-generation-results";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAnalyticsAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { id } = await params;
  const startedAt = Date.now();
  try {
    const supabase = createSupabaseServer();
    const { data: history, error } = await supabase.from("analyze_history")
      .select("id,prompt,image_path,image_mime,ugc_card_id").eq("id", id).maybeSingle();
    if (error || !history) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const prompt = String(history.prompt || "").trim();
    if (!prompt || !history.image_path) {
      return NextResponse.json({ error: "analysis_content_missing" }, { status: 409 });
    }

    let cardId = history.ugc_card_id as string | null;
    if (cardId) {
      const { data: existing } = await supabase.from("prompt_cards")
        .select("id").eq("id", cardId).maybeSingle();
      if (!existing) {
        await supabase.from("analyze_history").update({ ugc_card_id: null }).eq("id", id).eq("ugc_card_id", cardId);
        cardId = null;
      }
    }
    if (!cardId) {
      const { data: image, error: downloadError } = await supabase.storage
        .from(ANALYZE_HISTORY_BUCKET).download(history.image_path);
      if (downloadError || !image) {
        return NextResponse.json({ error: "source_image_unavailable" }, { status: 409 });
      }
      const filename = history.image_path.split("/").pop() || `${id}.jpg`;
      const publicPath = `analyze-publications/${id}/${filename}`;
      const { error: uploadError } = await supabase.storage.from(PUBLIC_RESULTS_BUCKET).upload(publicPath, image, {
        contentType: history.image_mime || image.type || "image/jpeg", upsert: true,
      });
      if (uploadError) throw new Error(`public_image_upload_failed:${uploadError.message}`);
      const created = await createUgcCardForAnalyzeHistory(supabase, {
        analyzeHistoryId: id, authorAuthUserId: gate.userId, promptText: prompt,
        resultBucket: PUBLIC_RESULTS_BUCKET, resultPath: publicPath,
      });
      if (!created?.cardId) throw new Error("card_create_failed");
      cardId = created.cardId;
    }

    const published = await publishPromptCard(supabase, cardId);
    console.info("[admin.analyze.publish] success", {
      adminEmail: gate.email, analyzeHistoryId: id, cardId: published.cardId, slug: published.slug,
      alreadyPublished: published.alreadyPublished, latencyMs: Date.now() - startedAt,
    });
    return NextResponse.json({
      ok: true, alreadyPublished: published.alreadyPublished, cardId: published.cardId,
      slug: published.slug, cardUrl: `/p/${published.slug}`,
      seoReadinessScore: published.seoReadinessScore,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[admin.analyze.publish] failed", {
      adminEmail: gate.email, analyzeHistoryId: id, message, latencyMs: Date.now() - startedAt,
    });
    return NextResponse.json({ error: "publish_failed", message }, { status: 500 });
  }
}
