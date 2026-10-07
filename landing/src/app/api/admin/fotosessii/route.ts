import { NextRequest, NextResponse } from "next/server";
import { requireAnalyticsAdmin } from "@/lib/analytics-admin";
import {
  encodeAdminGenerationCursor,
  parseAdminGenerationCursor,
  parseAdminGenerationLimit,
} from "@/lib/admin-generation-queue";
import {
  adminPhotoshootScenarioOptions,
  parseAdminPhotoshootPublicationFilter,
  resolveAlbumPublicationStatus,
  scenarioSlugsForSeoTags,
  type AdminPhotoshootAlbumRow,
} from "@/lib/admin-photoshoot-albums";
import { sanitizeGenerationError } from "@/lib/admin-user-generations";
import {
  photoshootUserFacingMediaPaths,
  resolvePhotoshootUserFacingResult,
  usableCatalogPrompt,
} from "@/lib/photoshoot";
import { countPublishedPhotoshootAlbumsBySeoTag } from "@/lib/photoshoot-listing";
import { PROMTY_DLYA_II_FOTOSESSII_CHILDREN } from "@/lib/promty-dlya-ii-fotosessii-cluster";
import { createSupabaseServer, getStoragePublicUrl } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gate = await requireAnalyticsAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const publication = parseAdminPhotoshootPublicationFilter(
    req.nextUrl.searchParams.get("publication"),
  );
  if (!publication) {
    return NextResponse.json({ error: "invalid_filter" }, { status: 400 });
  }
  const cursor = parseAdminGenerationCursor(req.nextUrl.searchParams.get("cursor"));
  const limit = parseAdminGenerationLimit(req.nextUrl.searchParams.get("limit"));
  const withCounts = req.nextUrl.searchParams.get("counts") !== "0";

  const supabase = createSupabaseServer();
  const [queue, counts] = await Promise.all([
    supabase.rpc("admin_photoshoot_albums_queue", {
      p_publication_status: publication,
      p_cursor_completed_at: cursor?.createdAt || null,
      p_cursor_id: cursor?.id || null,
      p_limit: limit,
    }),
    withCounts
      ? Promise.all(
          PROMTY_DLYA_II_FOTOSESSII_CHILDREN.map(async (child) => {
            try {
              return await countPublishedPhotoshootAlbumsBySeoTag(
                child.dimension,
                child.tagValue,
              );
            } catch (error) {
              console.error("[admin.fotosessii] scenario_count_failed", {
                slug: child.slug,
                message: error instanceof Error ? error.message : String(error),
              });
              return null;
            }
          }),
        )
      : Promise.resolve(null),
  ]);

  if (queue.error) {
    console.error("[admin.fotosessii] queue_failed", {
      adminEmail: gate.email,
      publication,
      message: queue.error.message,
    });
    return NextResponse.json({ error: "photoshoot_albums_fetch_failed" }, { status: 500 });
  }

  const rows = (queue.data || []) as AdminPhotoshootAlbumRow[];
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);

  const items = page.map((row) => {
    const facing = resolvePhotoshootUserFacingResult({
      editKind: "photoshoot",
      sheetPath: row.result_storage_path,
      tilePaths: row.photoshoot_tile_paths,
    });
    const tilePaths = photoshootUserFacingMediaPaths(facing);
    const bucket = row.result_storage_bucket;
    const frameUrls = bucket
      ? tilePaths.map((path) => getStoragePublicUrl(bucket, path))
      : [];
    const publicationStatus = resolveAlbumPublicationStatus(row);
    return {
      id: row.id,
      completedAt: row.generation_completed_at,
      // Enqueue blob starts with PHOTOSHOOT; show it trimmed so the admin still sees the scene.
      prompt:
        usableCatalogPrompt(row.prompt_text) ||
        sanitizeGenerationError(String(row.prompt_text || "").replace(/^\s*PHOTOSHOOT\b[:\s-]*/i, "")) ||
        "",
      model: row.model,
      clientSource: row.client_source,
      userEmail: row.user_email,
      userDisplayName: row.user_display_name,
      requesterAuthUserId: row.requester_auth_user_id,
      frameUrls,
      publicationStatus,
      cardSlug: row.card_slug,
      cardUrl: publicationStatus === "published" && row.card_slug ? `/p/${row.card_slug}` : null,
      cardTitle: row.card_title_ru,
      scenarioSlugs: scenarioSlugsForSeoTags(row.card_seo_tags),
      subjectAudience: row.card_subject_audience,
      subjectSource: row.card_subject_source,
      canPublish:
        Boolean(row.requester_auth_user_id) &&
        Boolean(bucket) &&
        frameUrls.length === 4,
    };
  });
  const last = page.at(-1);

  const scenarios = adminPhotoshootScenarioOptions().map((option, index) => ({
    ...option,
    publishedCount: counts ? counts[index] : null,
  }));

  return NextResponse.json(
    {
      items,
      scenarios,
      hasMore,
      nextCursor:
        hasMore && last
          ? encodeAdminGenerationCursor(last.generation_completed_at, last.id)
          : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
