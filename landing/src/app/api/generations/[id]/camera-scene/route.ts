import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer, getStoragePublicUrl } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import { resolveSharedDbUserId } from "@/lib/resolve-db-user-id";
import { landingGenerationsOwnerOrFilter } from "@/lib/landing-generations-access";
import {
  CAMERA_ORBIT_EDIT_KIND,
  CAMERA_ORBIT_NEUTRAL_POSE,
  parseCameraPose,
  resolveSceneRootId,
} from "@/lib/camera-orbit";
import { parseEnabledGenerationModels } from "@/lib/generation-model-labels";
import { isCameraOrbitUnlocked } from "@/lib/camera-orbit-access";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, error: authError } = await getSupabaseUserForApiRoute(req);
    if (authError || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const supabase = createSupabaseServer();
    const { data: flagRows } = await supabase
      .from("landing_generation_config")
      .select("key, value")
      .eq("key", "camera_orbit_enabled")
      .maybeSingle();
    if (!isCameraOrbitUnlocked(flagRows?.value, user.email)) {
      return NextResponse.json(
        {
          error: "camera_orbit_disabled",
          message: "Смена ракурса пока недоступна",
        },
        { status: 503 },
      );
    }
    const resolved = await resolveSharedDbUserId(supabase, user);
    const dbUserId = resolved?.dbUserId ?? user.id;
    const ownerFilter = landingGenerationsOwnerOrFilter(user.id, dbUserId);

    const { data: displayed, error } = await supabase
      .from("landing_generations")
      .select(
        "id,status,modality,edit_kind,scene_root_id,camera_pose,model,result_storage_bucket,result_storage_path,created_at"
      )
      .eq("id", id)
      .or(ownerFilter)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!displayed) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if ((displayed.modality || "image") !== "image") {
      return NextResponse.json(
        { error: "validation_error", message: "Смена ракурса доступна только для фото" },
        { status: 400 }
      );
    }

    const rootId = resolveSceneRootId(displayed);
    const { data: root, error: rootError } = await supabase
      .from("landing_generations")
      .select(
        "id,status,modality,edit_kind,scene_root_id,camera_pose,model,result_storage_bucket,result_storage_path,created_at"
      )
      .eq("id", rootId)
      .or(ownerFilter)
      .maybeSingle();

    if (rootError || !root) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { data: orbits } = await supabase
      .from("landing_generations")
      .select(
        "id,status,edit_kind,camera_pose,result_storage_bucket,result_storage_path,created_at"
      )
      .eq("scene_root_id", root.id)
      .eq("edit_kind", CAMERA_ORBIT_EDIT_KIND)
      .eq("status", "completed")
      .or(ownerFilter)
      .order("created_at", { ascending: true });

    const { data: configRows } = await supabase
      .from("landing_generation_config")
      .select("key, value")
      .in("key", ["models", "default_model", "camera_orbit_enabled"]);
    const config: Record<string, string> = {};
    for (const row of configRows || []) config[row.key] = row.value;
    const models = parseEnabledGenerationModels(config.models);
    const rootModel = String(root.model || "");
    const modelConfig =
      models.find((item) => item.id === rootModel)
      || models.find((item) => item.id === config.default_model)
      || models[0];

    const toShot = (
      row: {
        id: string;
        camera_pose?: unknown;
        result_storage_bucket?: string | null;
        result_storage_path?: string | null;
        created_at: string;
      },
      role: "root" | "orbit",
    ) => ({
      id: row.id,
      role,
      status: "completed" as const,
      resultUrl:
        row.result_storage_bucket && row.result_storage_path
          ? getStoragePublicUrl(row.result_storage_bucket, row.result_storage_path)
          : null,
      cameraPose:
        role === "root"
          ? CAMERA_ORBIT_NEUTRAL_POSE
          : parseCameraPose(row.camera_pose) || CAMERA_ORBIT_NEUTRAL_POSE,
      createdAt: row.created_at,
    });

    const shots = [
      toShot(root, "root"),
      ...(orbits || [])
        .filter((row) => row.id !== root.id && row.result_storage_bucket && row.result_storage_path)
        .map((row) => toShot(row, "orbit")),
    ];

    return NextResponse.json(
      {
        rootId: root.id,
        displayedId: displayed.id,
        creditCost: modelConfig?.cost ?? 5,
        cameraOrbitEnabled: isCameraOrbitUnlocked(
          config.camera_orbit_enabled,
          user.email,
        ),
        shots,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (err) {
    console.error("generations/[id]/camera-scene error:", err);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
