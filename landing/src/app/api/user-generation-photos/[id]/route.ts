import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import { USER_GENERATION_PHOTOS_BUCKET } from "@/lib/user-generation-photos";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await getSupabaseUserForApiRoute(req);
    if (authError || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "missing_id" }, { status: 400 });
    }

    const supabase = createSupabaseServer();
    const { data: photo, error: readError } = await supabase
      .from("landing_user_photos")
      .select("id,auth_user_id,storage_path")
      .eq("id", id)
      .maybeSingle();

    if (readError) {
      console.error("[user-generation-photos] delete lookup failed", readError.message);
      return NextResponse.json({ error: "delete_failed" }, { status: 500 });
    }
    if (!photo) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (photo.auth_user_id !== user.id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { error: storageError } = await supabase.storage
      .from(USER_GENERATION_PHOTOS_BUCKET)
      .remove([photo.storage_path]);
    if (storageError) {
      console.error("[user-generation-photos] storage delete failed", storageError.message);
      return NextResponse.json({ error: "delete_failed" }, { status: 500 });
    }

    const { error: deleteError } = await supabase
      .from("landing_user_photos")
      .delete()
      .eq("id", photo.id)
      .eq("auth_user_id", user.id);
    if (deleteError) {
      console.error("[user-generation-photos] row delete failed", deleteError.message);
      return NextResponse.json({ error: "delete_failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[user-generation-photos] delete error", err);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }
}
