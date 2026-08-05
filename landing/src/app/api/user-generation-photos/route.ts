import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import {
  toUserGenerationPhotos,
  type UserGenerationPhotoRow,
} from "@/lib/user-generation-photos";

const LIBRARY_LIMIT = 100;

export async function GET(req: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseUserForApiRoute(req);
    if (authError || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const supabase = createSupabaseServer();
    const { data, error } = await supabase
      .from("landing_user_photos")
      .select(
        "id,auth_user_id,storage_path,original_filename,byte_size,width,height,created_at"
      )
      .eq("auth_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(LIBRARY_LIMIT);

    if (error) {
      console.error("[user-generation-photos] list failed", error.message);
      return NextResponse.json({ error: "library_failed" }, { status: 500 });
    }

    const photos = await toUserGenerationPhotos(
      supabase,
      (data ?? []) as UserGenerationPhotoRow[]
    );
    return NextResponse.json({ photos });
  } catch (err) {
    console.error("[user-generation-photos] list error", err);
    return NextResponse.json({ error: "library_failed" }, { status: 500 });
  }
}
