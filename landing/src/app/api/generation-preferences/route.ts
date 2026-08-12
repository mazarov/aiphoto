import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import {
  isImageAspectRatio,
  isImageSize,
} from "@/lib/generation/image-options";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PreferencesBody = {
  model?: unknown;
  aspectRatio?: unknown;
  imageSize?: unknown;
  selectedPhotoIds?: unknown;
};

export async function GET(req: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseUserForApiRoute(req);
    if (authError || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const supabase = createSupabaseServer();
    const { data, error } = await supabase
      .from("landing_generation_preferences")
      .select("model,aspect_ratio,image_size,selected_photo_ids")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("[generation-preferences] read failed", error.message);
      return NextResponse.json({ error: "preferences_failed" }, { status: 500 });
    }

    return NextResponse.json({
      preferences: data
        ? {
            model: data.model,
            aspectRatio: data.aspect_ratio,
            imageSize: data.image_size,
            selectedPhotoIds: data.selected_photo_ids ?? [],
          }
        : null,
    });
  } catch (err) {
    console.error("[generation-preferences] read error", err);
    return NextResponse.json({ error: "preferences_failed" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseUserForApiRoute(req);
    if (authError || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as PreferencesBody;
    const model = typeof body.model === "string" ? body.model.trim() : "";
    const aspectRatio =
      typeof body.aspectRatio === "string" ? body.aspectRatio.trim() : "";
    const imageSize = typeof body.imageSize === "string" ? body.imageSize.trim() : "";
    const selectedPhotoIds = Array.isArray(body.selectedPhotoIds)
      ? [...new Set(body.selectedPhotoIds.filter((id): id is string => typeof id === "string"))]
      : [];

    if (
      !model ||
      !isImageAspectRatio(aspectRatio) ||
      !isImageSize(imageSize) ||
      selectedPhotoIds.length > 10 ||
      selectedPhotoIds.some((id) => !UUID_RE.test(id))
    ) {
      return NextResponse.json({ error: "validation_error" }, { status: 400 });
    }

    const supabase = createSupabaseServer();
    const [{ data: configRow, error: configError }, { data: ownedPhotos, error: photosError }] =
      await Promise.all([
        supabase
          .from("landing_generation_config")
          .select("value")
          .eq("key", "models")
          .maybeSingle(),
        selectedPhotoIds.length
          ? supabase
              .from("landing_user_photos")
              .select("id")
              .eq("auth_user_id", user.id)
              .in("id", selectedPhotoIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

    if (configError || photosError) {
      console.error("[generation-preferences] validation lookup failed", {
        configError: configError?.message ?? null,
        photosError: photosError?.message ?? null,
      });
      return NextResponse.json({ error: "preferences_failed" }, { status: 500 });
    }

    let enabledModels: string[] = [];
    try {
      const parsed = JSON.parse(configRow?.value || "[]") as {
        id?: unknown;
        enabled?: boolean;
      }[];
      enabledModels = parsed
        .filter((item) => item.enabled !== false && typeof item.id === "string")
        .map((item) => item.id as string);
    } catch {
      return NextResponse.json({ error: "config_error" }, { status: 503 });
    }

    if (!enabledModels.includes(model) || (ownedPhotos ?? []).length !== selectedPhotoIds.length) {
      return NextResponse.json({ error: "validation_error" }, { status: 400 });
    }

    const { error } = await supabase.from("landing_generation_preferences").upsert(
      {
        auth_user_id: user.id,
        model,
        aspect_ratio: aspectRatio,
        image_size: imageSize,
        selected_photo_ids: selectedPhotoIds,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "auth_user_id" }
    );

    if (error) {
      console.error("[generation-preferences] write failed", error.message);
      return NextResponse.json({ error: "preferences_failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[generation-preferences] write error", err);
    return NextResponse.json({ error: "preferences_failed" }, { status: 500 });
  }
}
