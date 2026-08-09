import { NextRequest, NextResponse } from "next/server";
import { requireAnalyticsAdmin } from "@/lib/analytics-admin";
import { createSupabaseServer, getStoragePublicUrl } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAnalyticsAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { id } = await params;
  const supabase = createSupabaseServer();
  const { data: generation, error } = await supabase.from("landing_generations")
    .select("id,status,model,aspect_ratio,created_at,generation_completed_at,result_storage_bucket,result_storage_path,ugc_card_id,error_type,error_message")
    .eq("id", id).eq("client_source", "admin").maybeSingle();
  if (error || !generation) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const progress = generation.status === "completed" ? 100 : generation.status === "processing" ? 50 : 10;
  return NextResponse.json({
    id: generation.id, status: generation.status, progress, model: generation.model,
    aspectRatio: generation.aspect_ratio, createdAt: generation.created_at,
    completedAt: generation.generation_completed_at, ugcCardId: generation.ugc_card_id,
    resultUrl: generation.status === "completed" && generation.result_storage_bucket && generation.result_storage_path
      ? getStoragePublicUrl(generation.result_storage_bucket, generation.result_storage_path) : undefined,
    errorType: generation.status === "failed" ? generation.error_type : undefined,
    errorMessage: generation.status === "failed" ? generation.error_message : undefined,
  }, { headers: { "Cache-Control": "no-store" } });
}
