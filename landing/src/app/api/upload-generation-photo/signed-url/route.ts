import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";

const BUCKET = "web-generation-uploads";
/** Short-lived URL for <img src> in extension (no Bearer on image requests). */
const SIGNED_TTL_SEC = 60 * 60 * 24;

function isSafeStoragePath(path: string): boolean {
  if (!path || path.length > 512) return false;
  if (path.includes("..") || path.includes("\\") || path.startsWith("/")) return false;
  return true;
}

export async function GET(req: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseUserForApiRoute(req);

    if (authError || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const path = req.nextUrl.searchParams.get("path") || "";
    if (!isSafeStoragePath(path)) {
      return NextResponse.json({ error: "invalid path" }, { status: 400 });
    }

    const prefix = `${user.id}/`;
    if (!path.startsWith(prefix)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const supabase = createSupabaseServer();
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_TTL_SEC);

    if (error || !data?.signedUrl) {
      console.error("upload-generation-photo signed-url:", error?.message);
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    return NextResponse.json({
      signedUrl: data.signedUrl,
      expiresIn: SIGNED_TTL_SEC,
    });
  } catch (err) {
    console.error("upload-generation-photo signed-url error:", err);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
