import { NextRequest, NextResponse } from "next/server";
import { requireAnalyticsAdmin } from "@/lib/analytics-admin";
import {
  encodeAdminGenerationCursor, parseAdminGenerationCursor, parseAdminGenerationLimit,
  parseAdminGenerationQueueStatus, resolveAdminPublicationStatus, type AdminGenerationQueueRow,
} from "@/lib/admin-generation-queue";
import { createSupabaseServer, getStoragePublicUrl } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gate = await requireAnalyticsAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const status = parseAdminGenerationQueueStatus(req.nextUrl.searchParams.get("status"));
  if (!status) return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  const cursor = parseAdminGenerationCursor(req.nextUrl.searchParams.get("cursor"));
  const limit = parseAdminGenerationLimit(req.nextUrl.searchParams.get("limit"));
  const supabase = createSupabaseServer();
  const { data, error } = await supabase.rpc("admin_generations_queue", {
    p_status: status, p_cursor_created_at: cursor?.createdAt || null,
    p_cursor_id: cursor?.id || null, p_limit: limit,
  });
  if (error) {
    console.error("[admin.generations] queue_failed", { adminEmail: gate.email, status, message: error.message });
    return NextResponse.json({ error: "generation_queue_fetch_failed" }, { status: 500 });
  }
  const rows = (data || []) as AdminGenerationQueueRow[];
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const items = page.map((row) => {
    const publicationStatus = resolveAdminPublicationStatus(row);
    return {
      id: row.id, createdAt: row.created_at, completedAt: row.generation_completed_at,
      prompt: row.prompt_text, model: row.model, aspectRatio: row.aspect_ratio, imageSize: row.image_size,
      resultUrl: row.result_storage_bucket && row.result_storage_path
        ? getStoragePublicUrl(row.result_storage_bucket, row.result_storage_path) : null,
      ugcCardId: row.ugc_card_id, cardSlug: row.card_slug,
      cardUrl: publicationStatus === "published" && row.card_slug ? `/p/${row.card_slug}` : null,
      publicationStatus,
    };
  });
  const last = page.at(-1);
  return NextResponse.json({
    items, hasMore,
    nextCursor: hasMore && last ? encodeAdminGenerationCursor(last.created_at, last.id) : null,
  }, { headers: { "Cache-Control": "no-store" } });
}
