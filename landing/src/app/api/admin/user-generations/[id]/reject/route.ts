import { NextRequest, NextResponse } from "next/server";
import { requireAnalyticsAdmin } from "@/lib/analytics-admin";
import { createSupabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAnalyticsAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const { id } = await params;
  try {
    const supabase = createSupabaseServer();
    const { data, error } = await supabase
      .from("landing_generations")
      .select("id,ugc_card_id,client_source")
      .eq("id", id)
      .maybeSingle();
    if (error || !data || data.client_source === "admin") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (!data.ugc_card_id) {
      return NextResponse.json({ error: "card_missing" }, { status: 409 });
    }

    const { data: updated, error: updateError } = await supabase
      .from("prompt_cards")
      .update({
        moderation_status: "rejected",
        is_published: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.ugc_card_id)
      .select("id")
      .maybeSingle();
    if (updateError || !updated) {
      console.error("[admin.user-generation.reject] failed", {
        adminEmail: gate.email,
        generationId: id,
        message: updateError?.message || "card_missing",
      });
      return NextResponse.json({ error: "reject_failed" }, { status: 500 });
    }

    console.info("[admin.user-generation.reject] success", {
      adminEmail: gate.email,
      generationId: id,
      cardId: data.ugc_card_id,
    });
    return NextResponse.json({
      ok: true,
      moderationStatus: "rejected",
      isPublished: false,
    });
  } catch (error) {
    console.error("[admin.user-generation.reject] failed", {
      adminEmail: gate.email,
      generationId: id,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "reject_failed" }, { status: 500 });
  }
}
