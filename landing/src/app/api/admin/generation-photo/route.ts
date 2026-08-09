import { NextRequest, NextResponse } from "next/server";
import { requireAnalyticsAdmin } from "@/lib/analytics-admin";
import {
  getAdminPinnedPhotoPath, getAdminPinnedPhotoSignedUrl, validateAndUploadAdminPhoto,
} from "@/lib/admin-generation-photo";
import { createSupabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gate = await requireAnalyticsAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  try {
    const supabase = createSupabaseServer();
    const path = await getAdminPinnedPhotoPath(supabase);
    if (!path) return NextResponse.json({ storagePath: null, signedUrl: null });
    return NextResponse.json(await getAdminPinnedPhotoSignedUrl(supabase, path));
  } catch (error) {
    console.error("[admin.generation-photo] read_failed", {
      adminEmail: gate.email, message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "pinned_photo_fetch_failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireAnalyticsAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  try {
    const file = (await req.formData()).get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "missing_file" }, { status: 400 });
    const supabase = createSupabaseServer();
    const path = await validateAndUploadAdminPhoto(supabase, file);
    return NextResponse.json(await getAdminPinnedPhotoSignedUrl(supabase, path));
  } catch (error) {
    const code = error instanceof Error ? error.message : "upload_failed";
    if (code === "invalid_file_type" || code === "file_too_large") {
      return NextResponse.json({ error: code }, { status: 400 });
    }
    console.error("[admin.generation-photo] upload_failed", { adminEmail: gate.email, message: code });
    return NextResponse.json({ error: "pinned_photo_upload_failed" }, { status: 500 });
  }
}
