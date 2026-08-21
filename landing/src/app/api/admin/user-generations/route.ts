import { NextRequest, NextResponse } from "next/server";
import { requireAnalyticsAdmin } from "@/lib/analytics-admin";
import {
  encodeAdminUserGenerationCursor,
  parseAdminUserGenerationClientSource,
  parseAdminUserGenerationCursor,
  parseAdminUserGenerationLimit,
  parseAdminUserGenerationPublicationFilter,
  parseAdminUserGenerationStatus,
  creditsRemainingByUserId,
  resolveUserGenerationPublicationStatus,
  sanitizeGenerationError,
  type AdminUserGenerationRow,
} from "@/lib/admin-user-generations";
import {
  isSafeStoragePath,
  USER_GENERATION_PHOTOS_BUCKET,
} from "@/lib/user-generation-photos";
import { createSupabaseServer, getStoragePublicUrl } from "@/lib/supabase";

export const dynamic = "force-dynamic";
const ADMIN_SOURCE_PREVIEW_TTL_SEC = 15 * 60;
const MAX_SOURCE_PREVIEWS = 4;

export async function GET(req: NextRequest) {
  const gate = await requireAnalyticsAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const status = parseAdminUserGenerationStatus(req.nextUrl.searchParams.get("status"));
  const publication = parseAdminUserGenerationPublicationFilter(
    req.nextUrl.searchParams.get("publication")
  );
  const clientSource = parseAdminUserGenerationClientSource(
    req.nextUrl.searchParams.get("client_source")
  );
  if (!status || !publication || clientSource === undefined) {
    return NextResponse.json({ error: "invalid_filter" }, { status: 400 });
  }

  const cursor = parseAdminUserGenerationCursor(req.nextUrl.searchParams.get("cursor"));
  const limit = parseAdminUserGenerationLimit(req.nextUrl.searchParams.get("limit"));
  const supabase = createSupabaseServer();
  const { data, error } = await supabase.rpc("admin_user_generations_queue", {
    p_status: status,
    p_client_source: clientSource,
    p_publication_status: publication,
    p_cursor_created_at: cursor?.createdAt || null,
    p_cursor_id: cursor?.id || null,
    p_limit: limit,
  });
  if (error) {
    console.error("[admin.user-generations] queue_failed", {
      adminEmail: gate.email,
      status,
      publication,
      clientSource,
      message: error.message,
    });
    return NextResponse.json({ error: "user_generations_fetch_failed" }, { status: 500 });
  }

  const rows = (data || []) as AdminUserGenerationRow[];
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const paths = [...new Set(page.flatMap((row) =>
    (row.input_photo_paths || []).filter(isSafeStoragePath).slice(0, MAX_SOURCE_PREVIEWS)
  ))];
  const signedByPath = new Map<string, string>();
  if (paths.length) {
    const { data: signed, error: signError } = await supabase.storage
      .from(USER_GENERATION_PHOTOS_BUCKET)
      .createSignedUrls(paths, ADMIN_SOURCE_PREVIEW_TTL_SEC);
    if (signError) {
      console.error("[admin.user-generations] source_preview_sign_failed", {
        adminEmail: gate.email,
        count: paths.length,
        message: signError.message,
      });
    } else {
      paths.forEach((path, index) => {
        const url = signed?.[index]?.signedUrl;
        if (url) signedByPath.set(path, url);
      });
    }
  }

  const userIds = [...new Set(page.map((row) => row.user_id).filter(Boolean))];
  const { data: creditRows, error: creditError } = userIds.length
    ? await supabase.from("landing_users").select("id, credits").in("id", userIds)
    : { data: [], error: null };
  if (creditError) {
    console.error("[admin.user-generations] credits_fetch_failed", {
      adminEmail: gate.email,
      count: userIds.length,
      message: creditError.message,
    });
  }
  const creditsByUser = creditsRemainingByUserId(creditRows);

  const extrasById = new Map<
    string,
    { requestedModel: string | null; executedModel: string | null; fallbackUsed: boolean }
  >();
  if (page.length) {
    const { data: extras, error: extrasError } = await supabase
      .from("landing_generations")
      .select("id, requested_model, executed_model, fallback_used")
      .in("id", page.map((row) => row.id));
    if (extrasError) {
      console.error("[admin.user-generations] extras_fetch_failed", {
        adminEmail: gate.email,
        message: extrasError.message,
      });
    } else {
      for (const extra of extras || []) {
        extrasById.set(extra.id, {
          requestedModel: extra.requested_model ?? null,
          executedModel: extra.executed_model ?? null,
          fallbackUsed: Boolean(extra.fallback_used),
        });
      }
    }
  }

  const items = page.map((row) => {
    const publicationStatus = resolveUserGenerationPublicationStatus(row);
    const sourcePhotoUrls = (row.input_photo_paths || [])
      .filter(isSafeStoragePath)
      .slice(0, MAX_SOURCE_PREVIEWS)
      .map((path) => signedByPath.get(path))
      .filter((url): url is string => Boolean(url));
    return {
      id: row.id,
      createdAt: row.created_at,
      completedAt: row.generation_completed_at,
      status: row.status,
      prompt: row.prompt_text,
      model: row.model,
      requestedModel: extrasById.get(row.id)?.requestedModel ?? row.model,
      executedModel: extrasById.get(row.id)?.executedModel ?? null,
      fallbackUsed: extrasById.get(row.id)?.fallbackUsed ?? false,
      aspectRatio: row.aspect_ratio,
      imageSize: row.image_size,
      creditsSpent: row.credits_spent,
      creditsRefunded: row.credits_refunded,
      creditsRemaining: creditsByUser.get(row.user_id) ?? null,
      errorType: row.error_type,
      errorMessage: sanitizeGenerationError(row.error_message),
      clientSource: row.client_source,
      requesterAuthUserId: row.requester_auth_user_id,
      userId: row.user_id,
      identityMismatch: Boolean(
        row.requester_auth_user_id && row.requester_auth_user_id !== row.user_id
      ),
      userEmail: row.user_email,
      userDisplayName: row.user_display_name,
      userProvider: row.user_provider,
      sourcePhotoUrls,
      resultUrl: row.result_storage_bucket && row.result_storage_path
        ? getStoragePublicUrl(row.result_storage_bucket, row.result_storage_path)
        : null,
      cardUrl: publicationStatus === "published" && row.card_slug
        ? `/p/${row.card_slug}`
        : null,
      publicationStatus,
      canPublish: row.status === "completed"
        && Boolean(row.requester_auth_user_id)
        && Boolean(row.result_storage_bucket && row.result_storage_path),
    };
  });
  const last = page.at(-1);

  return NextResponse.json({
    items,
    hasMore,
    nextCursor: hasMore && last
      ? encodeAdminUserGenerationCursor(last.created_at, last.id)
      : null,
  }, { headers: { "Cache-Control": "no-store" } });
}
