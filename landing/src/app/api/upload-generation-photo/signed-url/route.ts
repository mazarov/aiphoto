import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import { getStvPipelineTrace, stvLog } from "@/lib/stv-pipeline-log";
import {
  isStoragePathOwnedByAuthUser,
  USER_GENERATION_PHOTOS_BUCKET,
  USER_GENERATION_PHOTO_SIGNED_TTL_SEC,
} from "@/lib/user-generation-photos";

export async function GET(req: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseUserForApiRoute(req);

    if (authError || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const pipelineTrace = getStvPipelineTrace(req);

    const path = req.nextUrl.searchParams.get("path") || "";
    if (!path) {
      return NextResponse.json({ error: "invalid path" }, { status: 400 });
    }

    if (!isStoragePathOwnedByAuthUser(path, user.id)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const supabase = createSupabaseServer();
    const { data, error } = await supabase.storage
      .from(USER_GENERATION_PHOTOS_BUCKET)
      .createSignedUrl(path, USER_GENERATION_PHOTO_SIGNED_TTL_SEC);

    if (error || !data?.signedUrl) {
      console.error("upload-generation-photo signed-url:", error?.message);
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    stvLog("upload.signed_url_ok", {
      pipelineTrace,
      userId: user.id,
      storagePath: path,
      expiresInSec: USER_GENERATION_PHOTO_SIGNED_TTL_SEC,
    });

    return NextResponse.json({
      signedUrl: data.signedUrl,
      expiresIn: USER_GENERATION_PHOTO_SIGNED_TTL_SEC,
    });
  } catch (err) {
    console.error("upload-generation-photo signed-url error:", err);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
