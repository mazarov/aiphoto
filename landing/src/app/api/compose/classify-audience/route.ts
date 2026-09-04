import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import {
  COMPOSE_EXAMPLE_MATCH_CONFIG_KEY,
  COMPOSE_EXAMPLE_MATCH_GLOBAL_DAILY_LIMIT_KEY,
  COMPOSE_EXAMPLE_MATCH_IP_DAILY_LIMIT_KEY,
  isComposeExampleAudienceTag,
} from "@/lib/compose-example-audience";
import { isComposeExampleMatchUnlocked } from "@/lib/compose-example-match-access";
import {
  ComposeAudienceClassifyError,
  classifyComposeAudienceFromImage,
} from "@/lib/compose-example-audience-gemini";
import { reserveComposeAudienceClassifyBudget } from "@/lib/compose-example-audience-rate-limit";
import {
  extensionRateLimitIpHash,
  extensionRateLimitParsedIp,
} from "@/lib/extension-rate-limit-ip";
import {
  parseAnalyzeImageBuffer,
  parseAnalyzeImageDataUrl,
} from "@/lib/image-prompt-analyze-image";
import {
  USER_GENERATION_PHOTOS_BUCKET,
  USER_GENERATION_PHOTO_ROW_SELECT,
  type UserGenerationPhotoRow,
} from "@/lib/user-generation-photos";

export const runtime = "nodejs";
export const maxDuration = 15;

const PHOTO_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_DATA_URL_CHARS = 2_000_000;

function emptyTag(extra?: Record<string, unknown>) {
  return NextResponse.json({ audienceTag: null, ...extra });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const photoIdRaw =
    typeof body.photoId === "string" ? body.photoId.trim() : "";
  const imageBase64 =
    typeof body.image_base64 === "string" ? body.image_base64.trim() : "";
  const hasPhotoId = Boolean(photoIdRaw);
  const hasImage = Boolean(imageBase64);
  if (hasPhotoId === hasImage) {
    return NextResponse.json(
      { error: hasPhotoId ? "send_one_source" : "missing_source" },
      { status: 400 },
    );
  }
  if (hasPhotoId && !PHOTO_ID_RE.test(photoIdRaw)) {
    return NextResponse.json({ error: "invalid_photo_id" }, { status: 400 });
  }
  if (hasImage && imageBase64.length > MAX_DATA_URL_CHARS) {
    return NextResponse.json({ error: "image_too_large" }, { status: 413 });
  }

  const { user } = await getSupabaseUserForApiRoute(req);
  const supabase = createSupabaseServer();
  const { data: flagRows } = await supabase
    .from("landing_generation_config")
    .select("key, value")
    .in("key", [
      COMPOSE_EXAMPLE_MATCH_CONFIG_KEY,
      COMPOSE_EXAMPLE_MATCH_IP_DAILY_LIMIT_KEY,
      COMPOSE_EXAMPLE_MATCH_GLOBAL_DAILY_LIMIT_KEY,
    ]);
  const config: Record<string, string> = {};
  for (const row of flagRows || []) {
    config[row.key] = row.value;
  }
  if (
    !isComposeExampleMatchUnlocked(
      config[COMPOSE_EXAMPLE_MATCH_CONFIG_KEY],
      user?.email,
    )
  ) {
    return emptyTag({ enabled: false });
  }

  let storagePath: string | null = null;

  if (hasPhotoId) {
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const { data: photo, error } = await supabase
      .from("landing_user_photos")
      .select(USER_GENERATION_PHOTO_ROW_SELECT)
      .eq("id", photoIdRaw)
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (error) {
      console.error("[compose-audience-classify] photo_lookup", error.message);
      return emptyTag();
    }
    if (!photo) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const row = photo as UserGenerationPhotoRow;
    if (row.audience_tagged_at) {
      return NextResponse.json({
        audienceTag: isComposeExampleAudienceTag(row.audience_tag)
          ? row.audience_tag
          : null,
        cached: true,
      });
    }
    storagePath = row.storage_path;
  }

  const ipHash = extensionRateLimitIpHash(extensionRateLimitParsedIp(req.headers));
  const allowed = await reserveComposeAudienceClassifyBudget({
    supabase,
    ipHash,
    userKey: user?.id ? `user:${user.id}` : null,
    ipMax: config[COMPOSE_EXAMPLE_MATCH_IP_DAILY_LIMIT_KEY],
    globalMax: config[COMPOSE_EXAMPLE_MATCH_GLOBAL_DAILY_LIMIT_KEY],
  });
  if (!allowed) {
    return emptyTag({ limited: true });
  }

  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    console.error("[compose-audience-classify] missing GEMINI_API_KEY");
    return emptyTag();
  }

  let parsedImage = hasImage ? parseAnalyzeImageDataUrl(imageBase64) : null;
  if (hasPhotoId && storagePath) {
    const { data: file, error: downloadError } = await supabase.storage
      .from(USER_GENERATION_PHOTOS_BUCKET)
      .download(storagePath);
    if (downloadError || !file) {
      console.error(
        "[compose-audience-classify] download_failed",
        downloadError?.message || "empty",
      );
      return emptyTag();
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    parsedImage = parseAnalyzeImageBuffer(bytes);
  }
  if (!parsedImage) {
    return emptyTag();
  }

  try {
    const classified = await classifyComposeAudienceFromImage({
      image: parsedImage,
      supabase,
      apiKey,
    });
    if (hasPhotoId && user) {
      const { error: updateError } = await supabase
        .from("landing_user_photos")
        .update({
          audience_tag: classified.tag,
          audience_confidence: classified.confidence,
          audience_tagged_at: new Date().toISOString(),
        })
        .eq("id", photoIdRaw)
        .eq("auth_user_id", user.id);
      if (updateError) {
        console.error(
          "[compose-audience-classify] cache_write_failed",
          updateError.message,
        );
      }
    }
    return NextResponse.json({
      audienceTag: classified.tag,
      cached: false,
    });
  } catch (error) {
    if (error instanceof ComposeAudienceClassifyError) {
      console.error("[compose-audience-classify]", error.code);
      return emptyTag({ error: error.code });
    }
    console.error("[compose-audience-classify] failed");
    return emptyTag();
  }
}
